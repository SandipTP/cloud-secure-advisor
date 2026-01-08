# backend/ingest/parser.py

import json
import yaml
from pathlib import Path

from rules.iam_rules import detect_overly_permissive_iam
from rules.s3_rules import detect_public_s3_bucket
from rules.sg_rules import detect_open_security_group


SUPPORTED_JSON = {".json"}
SUPPORTED_YAML = {".yaml", ".yml"}


def _ensure_finding_shape(finding: dict) -> dict:
    """
    Make sure every finding has the exact keys that database.save_findings()
    expects, so we never crash with KeyError.
    """
    return {
        "type": finding.get("type", "unknown"),
        "issue": finding.get("issue", ""),
        "detail": finding.get("detail", ""),
        "severity": finding.get("severity", "low"),
        "nist_reference": finding.get("nist_reference", ""),
    }


def parse_config(filepath: str) -> dict:
    """
    Parse a JSON/YAML config file and run rule checks.

    Returns a dict with a consistent shape:
    {
      "raw_config": <dict|list|...>,
      "findings": [ {type, issue, detail, severity, nist_reference}, ... ],
      "file_type": "json" | "yaml",
      "resource_hints": [ ... ],   # optional helper info
      "error": <string or None>
    }
    """
    path = Path(filepath)
    ext = path.suffix.lower()

    if ext in SUPPORTED_JSON:
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            return {"error": f"Failed to read JSON: {e}", "raw_config": None, "findings": []}

        findings = []
        resource_hints = []

        # ---- Detect likely config type & run matching rules ----
        # IAM policy docs commonly have "Statement"
        if isinstance(data, dict) and "Statement" in data:
            resource_hints.append("iam_policy_or_s3_bucket_policy")

            # IAM rules (overly permissive policy)
            findings.extend(detect_overly_permissive_iam(data))

            # S3 bucket policy rules (public access)
            findings.extend(detect_public_s3_bucket(data))

        # Security Group JSON commonly has IpPermissions
        if isinstance(data, dict) and "IpPermissions" in data:
            resource_hints.append("security_group")
            findings.extend(detect_open_security_group(data))

        # normalize findings shape (protect DB insert)
        findings = [_ensure_finding_shape(f) for f in findings]

        return {
            "file_type": "json",
            "raw_config": data,
            "findings": findings,
            "resource_hints": resource_hints,
            "error": None,
        }

    if ext in SUPPORTED_YAML:
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
        except Exception as e:
            return {"error": f"Failed to read YAML: {e}", "raw_config": None, "findings": []}

        # For now: no YAML rules applied (future expansion)
        return {
            "file_type": "yaml",
            "raw_config": data,
            "findings": [],
            "resource_hints": [],
            "error": None,
        }

    return {
        "file_type": None,
        "raw_config": None,
        "findings": [],
        "resource_hints": [],
        "error": "Unsupported file type (only .json, .yaml, .yml are supported).",
    }
