def detect_overly_permissive_iam(policy_json):
    findings = []

    if "Statement" not in policy_json:
        return findings

    for stmt in policy_json["Statement"]:
        action = stmt.get("Action", "")
        resource = stmt.get("Resource", "")

        if action == "*" or action == ["*"]:
            findings.append({
                "type": "IAM",
                "issue": "Overly permissive IAM action",
                "detail": "Action '*' allows all IAM actions.",
                "severity": "High",
                "nist_reference": "NIST SP 800-53 AC-6"
            })

        if resource == "*" or resource == ["*"]:
            findings.append({
                "type": "IAM",
                "issue": "Overly permissive IAM resource",
                "detail": "Resource '*' allows access to all resources.",
                "severity": "High",
                "nist_reference": "NIST SP 800-53 AC-6"
            })

    return findings
