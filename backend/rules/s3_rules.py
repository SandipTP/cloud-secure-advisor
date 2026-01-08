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
    findings = []

    if not isinstance(policy_json, dict) or "Statement" not in policy_json:
        return findings

    statements = policy_json["Statement"]
    if isinstance(statements, dict):
        statements = [statements]

    seen = set()  # prevent duplicate findings

    for stmt in statements:
        if not isinstance(stmt, dict):
            continue

        effect = str(stmt.get("Effect", "")).strip()
        principal = stmt.get("Principal", {})
        actions = _to_list(stmt.get("Action", []))

        public = _is_public_principal(principal)
        allow = (effect.lower() == "allow")

        # Rule A: Public principal (high-level warning)
        if public:
            key = ("public_principal",)
            if key not in seen:
                findings.append({
                    "type": "s3",
                    "issue": "Public S3 access (Principal '*')",
                    "detail": "Bucket policy grants access to everyone. Risk of data exposure.",
                    "severity": "critical",
                    "nist_reference": "NIST SP 800-53 SC-28"
                })
                seen.add(key)

        # Rule B: Public read access specifically (more specific)
        # If Action includes s3:GetObject and it is Allow + public principal
        actions_lower = [str(a).lower() for a in actions]
        if allow and public and "s3:getobject" in actions_lower:
            key = ("public_read_getobject",)
            if key not in seen:
                findings.append({
                    "type": "s3",
                    "issue": "S3 public read access (s3:GetObject)",
                    "detail": "Object read permissions are open to the public (Allow + public Principal).",
                    "severity": "high",
                    "nist_reference": "CIS AWS Benchmark 3.1"
                })
                seen.add(key)

    return findings
