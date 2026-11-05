# backend/rules/s3_rules.py

def _is_public_principal(principal):
    """
    AWS bucket policy Principal can be:
    - "*" (string)
    - {"AWS": "*"} (dict)
    - {"AWS": ["*", "arn:..."]} (dict with list)
    """
    if principal == "*":
        return True

    if isinstance(principal, dict):
        aws = principal.get("AWS")
        if aws == "*":
            return True
        if isinstance(aws, list) and "*" in aws:
            return True

    return False


def _to_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def detect_public_s3_bucket(policy_json):
    """
    Detect public S3 bucket access in bucket policies.
    Only flags 'Allow' statements. Deny statements (such as KMS enforcement policies) are safe.
    """
    findings = []

    if not isinstance(policy_json, dict) or "Statement" not in policy_json:
        return findings

    statements = policy_json["Statement"]
    if isinstance(statements, dict):
        statements = [statements]
    elif not isinstance(statements, list):
        return findings

    seen = set()

    for idx, stmt in enumerate(statements):
        if not isinstance(stmt, dict):
            continue

        path = f"Statement[{idx}]"

        effect = str(stmt.get("Effect", "")).strip().lower()
        if effect != "allow":
            # Deny statements (e.g., denying non-KMS traffic) do not make buckets public!
            continue

        principal = stmt.get("Principal", {})
        public = _is_public_principal(principal)
        if not public:
            continue

        actions = _to_list(stmt.get("Action", []))
        actions_lower = [str(a).lower() for a in actions]

        # Rule 1: Public read access specifically (s3:GetObject)
        if "s3:getobject" in actions_lower:
            key = ("public_read_getobject", path)
            if key not in seen:
                findings.append({
                    "category": "S3",
                    "type": "s3",
                    "issue": "S3 Public Read Access (s3:GetObject)",
                    "detail": "Object read permissions are open to the public (Allow with public Principal '*').",
                    "severity": "HIGH",
                    "remediation": "Restrict 'Principal' to authenticated account ARNs and enable S3 Block Public Access.",
                    "nist_reference": "AC-3 (Access Enforcement), SC-7 (Boundary Protection)",
                    "path": path,
                })
                seen.add(key)
            continue

        # Rule 2: General public principal warning
        key = ("public_principal", path)
        if key not in seen:
            findings.append({
                "category": "S3",
                "type": "s3",
                "issue": "Public S3 Bucket Access",
                "detail": "Bucket policy grants access to everyone (Principal '*'). High risk of data exposure.",
                "severity": "CRITICAL",
                "remediation": "Restrict 'Principal' to specific AWS Account ARNs or IAM users.",
                "nist_reference": "AC-3 (Access Enforcement), SC-7 (Boundary Protection)",
                "path": path,
            })
            seen.add(key)

    return findings
