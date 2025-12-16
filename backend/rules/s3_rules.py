def detect_public_s3_bucket(policy_json):
    findings = []

    if "Statement" not in policy_json:
        return findings

    statements = policy_json["Statement"]
    if isinstance(statements, dict):
        statements = [statements]

    for stmt in statements:
        effect = stmt.get("Effect", "")
        principal = stmt.get("Principal", {})
        action = stmt.get("Action", "")
        
        # Convert to list if needed
        if isinstance(action, str):
            action = [action]
        
        # Rule 1: Public principal
        if principal == "*" or principal == {"AWS": "*"}:
            findings.append({
                "type": "S3",
                "issue": "Public S3 Bucket (Principal '*')",
                "detail": "Bucket policy grants access to everyone. Risk of data exposure.",
                "severity": "Critical",
                "nist_reference": "NIST SP 800-53 SC-28 (Protect Data at Rest)"
            })
        
        # Rule 2: Public read access
        if "s3:GetObject" in action and effect == "Allow":
            if principal == "*" or principal == {"AWS": "*"}:
                findings.append({
                    "type": "S3",
                    "issue": "S3 Public Read Access",
                    "detail": "Object read permissions are open to the public.",
                    "severity": "High",
                    "nist_reference": "CIS AWS Benchmark 3.1"
                })

    return findings
