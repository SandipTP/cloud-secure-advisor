# backend/rules/iam_rules.py

def _to_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def detect_overly_permissive_iam(policy_json):
    """
    Detect overly permissive IAM policy statements on parsed policy structure.
    Only flags 'Allow' statements; Deny statements are not flagged.
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
            # Deny statements restrict access and do not grant risky permissions
            continue

        actions = _to_list(stmt.get("Action", []))
        resources = _to_list(stmt.get("Resource", []))

        actions_str = [str(a).strip() for a in actions]
        resources_str = [str(r).strip() for r in resources]
        actions_lower = [a.lower() for a in actions_str]

        # Rule 1: Full Administrative Access (Action "*" and Resource "*")
        if "*" in actions_str and "*" in resources_str:
            key = ("iam_full_admin", path)
            if key not in seen:
                findings.append({
                    "category": "IAM",
                    "type": "iam",
                    "issue": "Full Administrative Access",
                    "detail": "Statement contains '*' Action on '*' Resource. This is equivalent to root/administrator access.",
                    "severity": "CRITICAL",
                    "remediation": "Restrict 'Action' and 'Resource' to specific APIs and explicit resource ARNs following least privilege.",
                    "nist_reference": "AC-6 (Least Privilege), AC-3 (Access Enforcement)",
                    "path": path,
                })
                seen.add(key)
            continue

        # Rule 2: User Management Privileges ("iam:*")
        if any(a == "iam:*" for a in actions_lower):
            key = ("iam_all_iam", path)
            if key not in seen:
                findings.append({
                    "category": "IAM",
                    "type": "iam",
                    "issue": "User Management Privileges",
                    "detail": "The policy grants full 'iam:*' permissions, allowing users to modify access policies or create admin accounts.",
                    "severity": "HIGH",
                    "remediation": "Apply more granular IAM permissions instead of wildcard 'iam:*'.",
                    "nist_reference": "AC-6 (Least Privilege), AC-3 (Access Enforcement)",
                    "path": path,
                })
                seen.add(key)

        # Rule 3: PassRole Privilege Escalation ("iam:PassRole" with wildcard resource)
        if any(a == "iam:passrole" for a in actions_lower) and ("*" in resources_str or not resources_str):
            key = ("iam_passrole", path)
            if key not in seen:
                findings.append({
                    "category": "IAM",
                    "type": "iam",
                    "issue": "PassRole Privilege Escalation",
                    "detail": "Allows passing any IAM role to an AWS service without resource constraints, enabling privilege escalation.",
                    "severity": "HIGH",
                    "remediation": "Use 'Resource' constraints to strictly limit which IAM roles can be passed.",
                    "nist_reference": "AC-6 (Least Privilege), AC-3 (Access Enforcement)",
                    "path": path,
                })
                seen.add(key)

        # Rule 4: Full S3 Access ("s3:*")
        if any(a == "s3:*" for a in actions_lower) and "*" in resources_str:
            key = ("iam_s3_wildcard", path)
            if key not in seen:
                findings.append({
                    "category": "IAM",
                    "type": "iam",
                    "issue": "Full S3 Access",
                    "detail": "Grants complete control over all S3 buckets in the account via 's3:*'.",
                    "severity": "MEDIUM",
                    "remediation": "Specify only necessary actions such as s3:GetObject or s3:PutObject on specific buckets.",
                    "nist_reference": "AC-6 (Least Privilege), AC-3 (Access Enforcement)",
                    "path": path,
                })
                seen.add(key)

        # Rule 5: Action "*"
        if "*" in actions_str:
            key = ("iam_action_star", path)
            if key not in seen:
                findings.append({
                    "category": "IAM",
                    "type": "iam",
                    "issue": "Overly Permissive IAM Action (*)",
                    "detail": "Action '*' allows all operations within a service. This violates the principle of least privilege.",
                    "severity": "HIGH",
                    "remediation": "Specify explicit API actions required for the workload instead of wildcard '*'.",
                    "nist_reference": "AC-6 (Least Privilege), AC-3 (Access Enforcement)",
                    "path": path,
                })
                seen.add(key)

        # Rule 6: Resource "*"
        if "*" in resources_str:
            key = ("iam_resource_star", path)
            if key not in seen:
                findings.append({
                    "category": "IAM",
                    "type": "iam",
                    "issue": "Overly Permissive IAM Resource (*)",
                    "detail": "Resource '*' grants access to all resources. This violates the principle of least privilege.",
                    "severity": "HIGH",
                    "remediation": "Restrict 'Resource' to explicit resource ARNs rather than wildcard '*'.",
                    "nist_reference": "AC-6 (Least Privilege), AC-3 (Access Enforcement)",
                    "path": path,
                })
                seen.add(key)

    return findings
