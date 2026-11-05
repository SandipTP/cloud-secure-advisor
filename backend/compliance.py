"""
Compliance Evaluation Engine for CloudSecure Advisor.
Supports NIST SP 800-53 Rev. 5, CIS AWS Foundations Benchmark v3.0,
and SOC 2 Type II (Estimated Trust Services Criteria Mapping).
"""

from typing import List, Dict, Any, Optional


def _matches_text(pattern: str, text: Optional[str]) -> bool:
    if not text:
        return False
    return pattern.lower() in text.lower()


def _nist_has(ref: Optional[str], code: str) -> bool:
    if not ref:
        return False
    # nist_reference may be e.g. "AC-3, AC-6"
    tokens = [t.strip().upper() for t in ref.replace(";", ",").split(",")]
    return code.upper() in tokens or any(code.upper() in t for t in tokens)


# ============================================================
# Framework Definitions
# ============================================================

FRAMEWORK_DEFINITIONS = {
    "nist_800_53": {
        "name": "NIST SP 800-53 Rev. 5",
        "short_name": "NIST 800-53",
        "icon": "🏛",
        "version": "Rev. 5",
        "description": "National Institute of Standards and Technology Security and Privacy Controls for Federal Information Systems.",
        "controls": [
            {
                "id": "AC-3",
                "name": "Access Enforcement",
                "family": "Access Control",
                "description": "Enforce approved authorizations for logical access to information and system resources in accordance with applicable access control policies.",
                "remediation": "Restrict policy actions and principals. Eliminate wildcard permissions and open public bucket policies.",
                "check": lambda f: _nist_has(f.get("nist_reference"), "AC-3")
                or (f.get("category") in ("IAM", "S3", "Network") and any(
                    _matches_text(w, f.get("issue")) for w in ("wildcard", "public", "unrestricted", "allow all")
                )),
            },
            {
                "id": "AC-6",
                "name": "Principle of Least Privilege",
                "family": "Access Control",
                "description": "Employ the principle of least privilege, allowing only authorized accesses for users and service roles necessary to accomplish assigned tasks.",
                "remediation": "Scope IAM policies down to specific actions and explicit resource ARNs. Remove administrative Action: * statements.",
                "check": lambda f: _nist_has(f.get("nist_reference"), "AC-6")
                or any(_matches_text(w, f.get("issue")) for w in ("privilege", "admin", "wildcard", "full access")),
            },
            {
                "id": "AC-17",
                "name": "Remote Access Management",
                "family": "Access Control",
                "description": "Authorize, monitor, and control all remote access sessions (SSH, RDP) into boundary systems.",
                "remediation": "Restrict security group ingress rules for port 22 and port 3389 to authorized corporate IP CIDRs instead of 0.0.0.0/0.",
                "check": lambda f: _nist_has(f.get("nist_reference"), "AC-17")
                or any(_matches_text(w, f.get("issue")) for w in ("ssh", "rdp", "22", "3389", "remote access")),
            },
            {
                "id": "AU-2",
                "name": "Event Logging",
                "family": "Audit & Accountability",
                "description": "Identify and record security-relevant events across cloud services and resources.",
                "remediation": "Enable CloudTrail multi-region logging and S3 server access logging.",
                "check": lambda f: _nist_has(f.get("nist_reference"), "AU-2")
                or f.get("category") == "Logging"
                or any(_matches_text(w, f.get("issue")) for w in ("logging", "trail", "audit log")),
            },
            {
                "id": "AU-6",
                "name": "Audit Review, Analysis, and Reporting",
                "family": "Audit & Accountability",
                "description": "Review and analyze information system audit records for indications of unusual or suspicious activity.",
                "remediation": "Configure CloudWatch metric alarms and automated alerts for unauthorized API calls and security group modifications.",
                "check": lambda f: _nist_has(f.get("nist_reference"), "AU-6")
                or f.get("category") == "Monitoring"
                or any(_matches_text(w, f.get("issue")) for w in ("monitoring", "metric", "alarm", "review")),
            },
            {
                "id": "AU-12",
                "name": "Audit Record Generation",
                "family": "Audit & Accountability",
                "description": "Generate audit records containing information to establish what events occurred and the source of the events.",
                "remediation": "Enable S3 object-level data event logging in CloudTrail and configure VPC Flow Logs.",
                "check": lambda f: _nist_has(f.get("nist_reference"), "AU-12")
                or any(_matches_text(w, f.get("issue")) for w in ("audit record", "object-level", "record generation")),
            },
            {
                "id": "CP-9",
                "name": "Information System Backup",
                "family": "Contingency Planning",
                "description": "Conduct regular backups of user and system data and protect backup integrity.",
                "remediation": "Enable S3 bucket versioning and MFA delete to protect against accidental or malicious object deletions.",
                "check": lambda f: _nist_has(f.get("nist_reference"), "CP-9")
                or any(_matches_text(w, f.get("issue")) for w in ("versioning", "backup", "retention")),
            },
            {
                "id": "IA-2",
                "name": "Identification and Authentication",
                "family": "Identification & Auth",
                "description": "Uniquely identify and authenticate organizational users and service principals.",
                "remediation": "Enforce multi-factor authentication (MFA) on root and privileged IAM accounts. Prohibit shared access keys.",
                "check": lambda f: _nist_has(f.get("nist_reference"), "IA-2")
                or any(_matches_text(w, f.get("issue")) for w in ("mfa", "root account", "authentication", "credential")),
            },
            {
                "id": "IA-5",
                "name": "Authenticator Management",
                "family": "Identification & Auth",
                "description": "Manage system authenticators, including rotating access keys and enforcing credential strength.",
                "remediation": "Rotate IAM access keys every 90 days. Store secrets in AWS Secrets Manager or KMS rather than configuration files.",
                "check": lambda f: _nist_has(f.get("nist_reference"), "IA-5")
                or f.get("category") == "Secrets"
                or any(_matches_text(w, f.get("issue")) for w in ("key rotation", "unrotated", "hardcoded key", "secret")),
            },
            {
                "id": "SC-7",
                "name": "Boundary Protection",
                "family": "System Protection",
                "description": "Monitor and control communications at external and internal system boundaries.",
                "remediation": "Eliminate 0.0.0.0/0 ingress rules in Security Groups. Enforce strict port-level network filtering.",
                "check": lambda f: _nist_has(f.get("nist_reference"), "SC-7")
                or f.get("category") == "Network"
                or any(_matches_text(w, f.get("issue")) for w in ("ingress", "security group", "boundary", "0.0.0.0/0")),
            },
            {
                "id": "SC-8",
                "name": "Transmission Confidentiality and Integrity",
                "family": "System Protection",
                "description": "Protect the confidentiality and integrity of transmitted information using encrypted protocols (TLS/HTTPS).",
                "remediation": "Add an explicit Deny policy on S3 buckets for requests where aws:SecureTransport is false.",
                "check": lambda f: _nist_has(f.get("nist_reference"), "SC-8")
                or any(_matches_text(w, f.get("issue")) for w in ("http", "tls", "ssl", "transit", "securetransport", "unencrypted transmission")),
            },
            {
                "id": "SC-13",
                "name": "Cryptographic Protection",
                "family": "System Protection",
                "description": "Implement cryptographic modules and key management in accordance with applicable federal standards.",
                "remediation": "Use AWS KMS Customer Managed Keys (CMK) with automated key rotation for data volume and bucket encryption.",
                "check": lambda f: _nist_has(f.get("nist_reference"), "SC-13")
                or f.get("category") == "Encryption"
                or any(_matches_text(w, f.get("issue")) for w in ("kms", "cmk", "cryptographic", "key management")),
            },
            {
                "id": "SC-28",
                "name": "Protection of Information at Rest",
                "family": "System Protection",
                "description": "Protect the confidentiality and integrity of information at rest across storage volumes, databases, and buckets.",
                "remediation": "Enable default server-side encryption (SSE-KMS or SSE-S3) on all S3 buckets and RDS storage instances.",
                "check": lambda f: _nist_has(f.get("nist_reference"), "SC-28")
                or any(_matches_text(w, f.get("issue")) for w in ("at rest", "unencrypted bucket", "server-side encryption", "unencrypted")),
            },
        ],
    },
    "cis_aws_benchmark": {
        "name": "CIS AWS Foundations Benchmark v3.0",
        "short_name": "CIS AWS Benchmark",
        "icon": "🛡",
        "version": "v3.0.0",
        "description": "Industry consensus guidance for establishing a secure configuration posture for Amazon Web Services.",
        "controls": [
            {
                "id": "CIS 1.4",
                "name": "Ensure access keys are rotated every 90 days or less",
                "family": "1. IAM",
                "description": "Rotating access keys periodically reduces the window of exposure for compromised credentials.",
                "remediation": "Identify active access keys older than 90 days and rotate them using IAM credential lifecycle workflows.",
                "check": lambda f: f.get("category") == "Secrets"
                or any(_matches_text(w, f.get("issue")) for w in ("rotate", "key age", "hardcoded key", "90 days")),
            },
            {
                "id": "CIS 1.5",
                "name": "Ensure MFA is enabled for the 'root' user account",
                "family": "1. IAM",
                "description": "The root account has full administrative privileges across the entire AWS account. Hardware or virtual MFA is mandatory.",
                "remediation": "Enable multi-factor authentication (MFA) on the root account and eliminate root access keys.",
                "check": lambda f: any(_matches_text(w, f.get("issue")) for w in ("root", "mfa")),
            },
            {
                "id": "CIS 1.16",
                "name": "Ensure IAM policies adhere to least privilege",
                "family": "1. IAM",
                "description": "IAM policies must not grant wildcard 'Action: *' or 'Resource: *' permissions.",
                "remediation": "Replace wildcard permissions with specific actions (e.g. s3:GetObject) and target resource ARNs.",
                "check": lambda f: f.get("category") == "IAM"
                and any(_matches_text(w, f.get("issue")) for w in ("wildcard", "least privilege", "permissive", "full admin")),
            },
            {
                "id": "CIS 2.1.1",
                "name": "Ensure S3 Buckets are configured with 'Block Public Access'",
                "family": "2. Storage",
                "description": "S3 Block Public Access prevents accidental public exposure of buckets and objects via ACLs or bucket policies.",
                "remediation": "Enable all four S3 Block Public Access settings on the bucket and account level.",
                "check": lambda f: f.get("category") == "S3"
                and any(_matches_text(w, f.get("issue")) for w in ("public", "principal: *", "unrestricted read", "unrestricted write")),
            },
            {
                "id": "CIS 2.1.2",
                "name": "Ensure S3 bucket policies require requests to use HTTPS / TLS",
                "family": "2. Storage",
                "description": "Bucket policies must deny unencrypted HTTP traffic by checking aws:SecureTransport.",
                "remediation": "Attach a bucket policy statement denying s3:* when Condition aws:SecureTransport is false.",
                "check": lambda f: f.get("category") == "S3"
                and any(_matches_text(w, f.get("issue")) for w in ("http", "tls", "ssl", "securetransport", "transit")),
            },
            {
                "id": "CIS 2.1.3",
                "name": "Ensure S3 bucket server-side encryption is enabled",
                "family": "2. Storage",
                "description": "Enable default server-side encryption on all buckets using KMS CMK or AES256.",
                "remediation": "Configure default encryption on the bucket properties using aws:kms or AES256.",
                "check": lambda f: f.get("category") == "S3"
                and any(_matches_text(w, f.get("issue")) for w in ("encryption", "unencrypted", "sse", "kms")),
            },
            {
                "id": "CIS 2.1.4",
                "name": "Ensure S3 bucket versioning and lifecycle logging are enabled",
                "family": "2. Storage",
                "description": "Versioning preserves previous iterations of objects to prevent data loss from accidental deletion.",
                "remediation": "Enable bucket versioning and configure lifecycle transition rules.",
                "check": lambda f: f.get("category") == "S3"
                and any(_matches_text(w, f.get("issue")) for w in ("versioning", "lifecycle", "logging disabled")),
            },
            {
                "id": "CIS 3.1",
                "name": "Ensure CloudTrail is enabled in all regions",
                "family": "3. Logging",
                "description": "CloudTrail records AWS API calls and delivers log files to an Amazon S3 bucket for security analysis.",
                "remediation": "Create a multi-region CloudTrail trail with log file validation enabled.",
                "check": lambda f: f.get("category") == "Logging"
                or any(_matches_text(w, f.get("issue")) for w in ("cloudtrail", "trail", "event logging")),
            },
            {
                "id": "CIS 4.1",
                "name": "Ensure VPC flow logging and monitoring are enabled",
                "family": "4. Monitoring",
                "description": "VPC Flow Logs capture network traffic IP information for security monitoring and incident response.",
                "remediation": "Enable VPC Flow Logs with delivery to CloudWatch Logs or S3.",
                "check": lambda f: f.get("category") in ("Monitoring", "Config")
                or any(_matches_text(w, f.get("issue")) for w in ("flow log", "monitoring", "metric filter")),
            },
            {
                "id": "CIS 5.1",
                "name": "Ensure no security groups allow ingress from 0.0.0.0/0 to port 22",
                "family": "5. Networking",
                "description": "Port 22 (SSH) must not be accessible to the public internet to prevent brute-force attacks.",
                "remediation": "Update security group ingress rules to allow port 22 only from trusted bastion hosts or VPN CIDRs.",
                "check": lambda f: f.get("category") == "Network"
                and any(_matches_text(w, f.get("issue")) for w in ("22", "ssh")),
            },
            {
                "id": "CIS 5.2",
                "name": "Ensure no security groups allow ingress from 0.0.0.0/0 to port 3389",
                "family": "5. Networking",
                "description": "Port 3389 (RDP) must not be accessible to the public internet.",
                "remediation": "Update security group ingress rules to restrict port 3389 to authorized administrator IP addresses.",
                "check": lambda f: f.get("category") == "Network"
                and any(_matches_text(w, f.get("issue")) for w in ("3389", "rdp")),
            },
            {
                "id": "CIS 5.3",
                "name": "Ensure no security groups allow unrestricted ingress to all ports",
                "family": "5. Networking",
                "description": "Security group rules must specify allowed ports rather than opening all protocol ports to 0.0.0.0/0.",
                "remediation": "Remove 0.0.0.0/0 ingress rules that specify port -1 or port range 0-65535.",
                "check": lambda f: f.get("category") == "Network"
                and any(_matches_text(w, f.get("issue")) for w in ("all ports", "unrestricted ingress", "open ingress")),
            },
            {
                "id": "CIS 6.1",
                "name": "Ensure database storage is encrypted at rest",
                "family": "6. Database",
                "description": "RDS instances and database clusters must be encrypted with KMS keys.",
                "remediation": "Enable storage encryption during RDS database creation or snapshot restore.",
                "check": lambda f: f.get("category") == "Database"
                or (any(_matches_text(w, f.get("issue")) for w in ("database", "rds")) and "encrypt" in (f.get("issue") or "").lower()),
            },
        ],
    },
    "soc2_type_ii": {
        "name": "SOC 2 Type II (Estimated Trust Services Criteria)",
        "short_name": "SOC 2 Type II",
        "icon": "📋",
        "version": "2017 TSC",
        "description": "AICPA Trust Services Criteria mapping for Security, Availability, and Confidentiality.",
        "controls": [
            {
                "id": "CC6.1",
                "name": "Logical Access Controls",
                "family": "Common Criteria 6",
                "description": "The entity implements logical access security software, infrastructure, and architectures over protected information assets.",
                "remediation": "Enforce explicit authentication, eliminate public bucket access, and restrict role assumption policies.",
                "check": lambda f: f.get("category") == "IAM"
                or any(_matches_text(w, f.get("issue")) for w in ("public bucket", "mfa", "authentication", "principal: *")),
            },
            {
                "id": "CC6.2",
                "name": "Credential & Key Management",
                "family": "Common Criteria 6",
                "description": "The entity registers, modifies, rotates, and decommissions access credentials and cryptographic keys.",
                "remediation": "Rotate access credentials and KMS customer-managed keys periodically. Prohibit plaintext keys in code.",
                "check": lambda f: f.get("category") == "Secrets"
                or any(_matches_text(w, f.get("issue")) for w in ("key", "credential", "rotate", "secret", "token")),
            },
            {
                "id": "CC6.3",
                "name": "Principle of Least Privilege",
                "family": "Common Criteria 6",
                "description": "The entity authorizes, modifies, and removes access to data and software based on job responsibilities.",
                "remediation": "Eliminate full administrative access statements (Action: * on Resource: *). Grant role-specific permissions.",
                "check": lambda f: any(_matches_text(w, f.get("issue")) for w in ("least privilege", "wildcard", "admin", "overly permissive")),
            },
            {
                "id": "CC6.6",
                "name": "Perimeter & Boundary Protection",
                "family": "Common Criteria 6",
                "description": "The entity implements perimeter boundary controls to restrict unauthorized network traffic from external sources.",
                "remediation": "Configure restrictive firewall rules and Security Groups; block all 0.0.0.0/0 ingress to sensitive ports.",
                "check": lambda f: f.get("category") == "Network"
                or any(_matches_text(w, f.get("issue")) for w in ("ingress", "security group", "0.0.0.0/0", "boundary", "port")),
            },
            {
                "id": "CC6.7",
                "name": "Data Protection & Encryption",
                "family": "Common Criteria 6",
                "description": "The entity protects data in transmission and data at rest using approved cryptographic mechanisms.",
                "remediation": "Enforce TLS in transit for all S3 and API requests. Enable server-side encryption for data at rest.",
                "check": lambda f: f.get("category") in ("Encryption", "S3") and any(
                    _matches_text(w, f.get("issue")) for w in ("encryption", "unencrypted", "tls", "ssl", "kms", "sse", "transit")
                ),
            },
            {
                "id": "CC7.1",
                "name": "Vulnerability & Configuration Management",
                "family": "Common Criteria 7",
                "description": "The entity identifies, assesses, and manages vulnerabilities and configuration defects in system components.",
                "remediation": "Establish automated configuration compliance checks and remediate high-severity misconfigurations.",
                "check": lambda f: f.get("category") == "Config"
                or any(_matches_text(w, f.get("issue")) for w in ("configuration", "vulnerability", "misconfiguration")),
            },
            {
                "id": "CC7.2",
                "name": "Security Incident & Audit Logging",
                "family": "Common Criteria 7",
                "description": "The entity monitors system components and operations to detect potential security incidents.",
                "remediation": "Enable central audit logging via CloudTrail, S3 access logging, and automated threat alerts.",
                "check": lambda f: f.get("category") == "Logging"
                or any(_matches_text(w, f.get("issue")) for w in ("logging", "audit", "trail", "monitor")),
            },
        ],
    },
}


# ============================================================
# Compliance Evaluation Function
# ============================================================

def evaluate_compliance(findings: List[Dict[str, Any]], has_scans: bool = True) -> Dict[str, Any]:
    """
    Evaluates a set of findings against NIST 800-53, CIS AWS Benchmark, and SOC 2 Type II.

    Args:
        findings: List of finding dictionaries (category, issue, severity, detail, nist_reference, remediation, filename)
        has_scans: Whether any scans exist in scope. If False, compliance is unassessed (0% / No data).

    Returns:
        Structured compliance dictionary with framework-level summaries and control-level details.
    """
    if not has_scans:
        frameworks_out = {}
        for fw_key, fw in FRAMEWORK_DEFINITIONS.items():
            frameworks_out[fw_key] = {
                "key": fw_key,
                "name": fw["name"],
                "short_name": fw["short_name"],
                "icon": fw["icon"],
                "version": fw["version"],
                "description": fw["description"],
                "has_data": False,
                "total_controls": len(fw["controls"]),
                "passing_controls": 0,
                "failing_controls": 0,
                "compliance_score": 0,
                "status": "NO_DATA",
                "controls": [
                    {
                        "id": c["id"],
                        "name": c["name"],
                        "family": c["family"],
                        "description": c["description"],
                        "remediation": c["remediation"],
                        "status": "NOT_EVALUATED",
                        "violations_count": 0,
                        "violating_findings": [],
                    }
                    for c in fw["controls"]
                ],
            }
        return {
            "has_data": False,
            "overall_score": 0,
            "total_findings": 0,
            "message": "No scan data available. Upload and scan configuration files to assess compliance.",
            "frameworks": frameworks_out,
        }

    frameworks_out = {}
    total_passing_all = 0
    total_controls_all = 0

    for fw_key, fw in FRAMEWORK_DEFINITIONS.items():
        evaluated_controls = []
        failing_count = 0

        for ctrl in fw["controls"]:
            violating_findings = []
            for f in findings:
                try:
                    if ctrl["check"](f):
                        violating_findings.append({
                            "id": f.get("id"),
                            "upload_id": f.get("upload_id"),
                            "category": f.get("category"),
                            "issue": f.get("issue"),
                            "severity": f.get("severity"),
                            "detail": f.get("detail"),
                            "remediation": f.get("remediation") or ctrl["remediation"],
                            "nist_reference": f.get("nist_reference"),
                            "filename": f.get("filename"),
                        })
                except Exception:
                    pass

            is_failing = len(violating_findings) > 0
            if is_failing:
                failing_count += 1

            evaluated_controls.append({
                "id": ctrl["id"],
                "name": ctrl["name"],
                "family": ctrl["family"],
                "description": ctrl["description"],
                "remediation": ctrl["remediation"],
                "status": "FAIL" if is_failing else "PASS",
                "violations_count": len(violating_findings),
                "violating_findings": violating_findings,
            })

        total = len(fw["controls"])
        passing = total - failing_count
        score = round((passing / total) * 100) if total > 0 else 100
        status_label = "COMPLIANT" if failing_count == 0 else ("PARTIAL" if score >= 70 else "NON_COMPLIANT")

        total_passing_all += passing
        total_controls_all += total

        frameworks_out[fw_key] = {
            "key": fw_key,
            "name": fw["name"],
            "short_name": fw["short_name"],
            "icon": fw["icon"],
            "version": fw["version"],
            "description": fw["description"],
            "has_data": True,
            "total_controls": total,
            "passing_controls": passing,
            "failing_controls": failing_count,
            "compliance_score": score,
            "status": status_label,
            "controls": evaluated_controls,
        }

    overall_score = round((total_passing_all / total_controls_all) * 100) if total_controls_all > 0 else 100

    return {
        "has_data": True,
        "overall_score": overall_score,
        "total_findings": len(findings),
        "message": "All scanned files evaluated successfully." if len(findings) == 0 else f"{len(findings)} findings evaluated across compliance frameworks.",
        "frameworks": frameworks_out,
    }
