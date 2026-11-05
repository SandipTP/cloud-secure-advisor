# backend/ingest/parser.py

import os
import json
import yaml
from pathlib import Path

# Relative imports or package imports
try:
    from rules.iam_rules import detect_overly_permissive_iam
    from rules.s3_rules import detect_public_s3_bucket
    from rules.sg_rules import detect_open_security_group
    from validate.config_validator import validate_iam_policy
except ImportError:
    from ..rules.iam_rules import detect_overly_permissive_iam
    from ..rules.s3_rules import detect_public_s3_bucket
    from ..rules.sg_rules import detect_open_security_group
    from ..validate.config_validator import validate_iam_policy


SUPPORTED_JSON = {".json"}
SUPPORTED_YAML = {".yaml", ".yml"}

PENALTY = {
    "CRITICAL": 25,
    "HIGH": 15,
    "MEDIUM": 10,
    "LOW": 5,
}

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_RULES_PATH = os.path.join(_BASE_DIR, "rules.json")


def load_fallback_rules():
    """Load the pattern-based rules.json rules list."""
    if os.path.exists(_RULES_PATH):
        try:
            with open(_RULES_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[WARN] Could not load rules.json: {e}")
    return []


FALLBACK_RULES = load_fallback_rules()


def _ensure_finding_shape(finding: dict) -> dict:
    """
    Ensure every finding has consistent fields matching the Finding DB model.
    """
    sev = str(finding.get("severity", "LOW")).upper()
    return {
        "category": finding.get("category", "General"),
        "issue": finding.get("issue", "Unknown Security Issue"),
        "detail": finding.get("detail", ""),
        "severity": sev if sev in PENALTY else "LOW",
        "nist_reference": finding.get("nist_reference", ""),
        "remediation": finding.get("remediation", ""),
    }


def _find_structures(data):
    """
    Find all Statement objects and IpPermissions objects in data (recursively),
    supporting top-level policies, CloudFormation templates, and wrapped configs.
    """
    statement_docs = []
    sg_docs = []

    def _traverse(node):
        if isinstance(node, dict):
            if "Statement" in node and isinstance(node["Statement"], (list, dict)):
                statement_docs.append(node)
            if "IpPermissions" in node and isinstance(node["IpPermissions"], list):
                sg_docs.append(node)
            for v in node.values():
                _traverse(v)
        elif isinstance(node, list):
            for item in node:
                _traverse(item)

    _traverse(data)
    return statement_docs, sg_docs


def parse_config(filepath: str, raw_content: str = None) -> dict:
    """
    Parse a JSON or YAML configuration file and execute structured rule analysis,
    supplemented by pattern-based rules as fallback.

    Returns:
    {
      "file_type": "json" | "yaml",
      "raw_config": <str>,
      "findings": [ {category, issue, detail, severity, nist_reference, remediation}, ... ],
      "score": <int 0-100>,
      "error": <str or None>
    }
    """
    path = Path(filepath)
    ext = path.suffix.lower()

    if ext not in SUPPORTED_JSON and ext not in SUPPORTED_YAML:
        return {
            "file_type": None,
            "raw_config": raw_content or "",
            "findings": [],
            "score": 100,
            "error": f"Unsupported file type '{ext}'. Allowed types: .json, .yaml, .yml",
        }

    # Read content if not provided
    if raw_content is None:
        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                raw_content = f.read()
        except Exception as e:
            return {
                "file_type": None,
                "raw_config": "",
                "findings": [],
                "score": 100,
                "error": f"Failed to read file: {e}",
            }

    parsed_data = None
    file_type = "json" if ext in SUPPORTED_JSON else "yaml"

    if ext in SUPPORTED_JSON:
        try:
            parsed_data = json.loads(raw_content)
        except Exception as e:
            # Fall back to pattern scanning if JSON syntax is slightly malformed
            print(f"[WARN] Failed to parse JSON AST: {e}. Falling back to pattern rules.")
    elif ext in SUPPORTED_YAML:
        try:
            parsed_data = yaml.safe_load(raw_content)
        except Exception as e:
            print(f"[WARN] Failed to parse YAML AST: {e}. Falling back to pattern rules.")

    findings = []
    seen_issues = set()
    ran_structured_iam = False
    ran_structured_s3 = False
    ran_structured_sg = False

    if parsed_data is not None:
        statement_docs, sg_docs = _find_structures(parsed_data)

        # 1. Structured IAM & S3 analysis
        for sdoc in statement_docs:
            val_err = validate_iam_policy(sdoc)
            if val_err:
                # Still attempt scanning but note validation if helpful
                pass

            iam_findings = detect_overly_permissive_iam(sdoc)
            for f in iam_findings:
                key = (f.get("category", "IAM"), f.get("issue"))
                if key not in seen_issues:
                    findings.append(_ensure_finding_shape(f))
                    seen_issues.add(key)
            if iam_findings or "Statement" in sdoc:
                ran_structured_iam = True

            s3_findings = detect_public_s3_bucket(sdoc)
            for f in s3_findings:
                key = (f.get("category", "S3"), f.get("issue"))
                if key not in seen_issues:
                    findings.append(_ensure_finding_shape(f))
                    seen_issues.add(key)
            if s3_findings or "Statement" in sdoc:
                ran_structured_s3 = True

        # 2. Structured Security Group analysis
        for sgdoc in sg_docs:
            sg_findings = detect_open_security_group(sgdoc)
            for f in sg_findings:
                key = (f.get("category", "Network"), f.get("issue"))
                if key not in seen_issues:
                    findings.append(_ensure_finding_shape(f))
                    seen_issues.add(key)
            ran_structured_sg = True

    # 3. Supplemental & Fallback Pattern Rules from rules.json
    content_norm = "".join(raw_content.split())
    rules_list = FALLBACK_RULES or load_fallback_rules()

    for rule in rules_list:
        pat = rule.get("pattern")
        if not pat:
            continue

        cat = rule.get("category", "")
        issue = rule.get("issue", "")

        # Skip rules already covered by structured analysis to prevent false positives:
        # If we ran structured S3 analysis on statements, do NOT do naive substring matching
        # on '"Principal": "*"' (which incorrectly flags Deny statements like secure_s3_kms_deny.json)
        if ran_structured_s3 and issue in ("Public Bucket Access", "S3 Public Read Access"):
            continue

        # If we ran structured IAM analysis on statements, avoid duplicate or inaccurate IAM wildcard matches
        if ran_structured_iam and issue in ("Wildcard Administrator Access", "User Management Privileges", "PassRole Privilege Escalation", "Full S3 Access"):
            continue

        # If we ran structured SG analysis, avoid duplicate port matches
        if ran_structured_sg and cat == "Network":
            continue

        pat_norm = "".join(pat.split())
        if pat_norm in content_norm:
            key = (cat, issue)
            if key not in seen_issues:
                findings.append(_ensure_finding_shape({
                    "category": cat,
                    "issue": issue,
                    "detail": rule.get("detail", ""),
                    "severity": rule.get("severity", "MEDIUM"),
                    "nist_reference": rule.get("nist_reference", ""),
                    "remediation": rule.get("remediation", ""),
                }))
                seen_issues.add(key)

    # 4. Compute composite security score
    total_penalty = sum(PENALTY.get(f["severity"], 5) for f in findings)
    score = max(100 - total_penalty, 0)

    return {
        "file_type": file_type,
        "raw_config": raw_content,
        "findings": findings,
        "score": score,
        "error": None,
    }
