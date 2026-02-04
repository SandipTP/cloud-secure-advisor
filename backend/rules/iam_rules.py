# backend/rules/iam_rules.py

def _to_list(value): #making to a list
    if value is None:
        return []        #return empty list
    if isinstance(value, list): #if value is a list
        return value
    return [value]     #return list


def detect_overly_permissive_iam(policy_json): #detect overly permissive IAM policy
    findings = []
    seen = set() #avoid duplicate findings for same issue

    if not isinstance(policy_json, dict) or "Statement" not in policy_json:
        return findings

    statements = policy_json["Statement"]
    if isinstance(statements, dict):
        statements = [statements]

    seen = set()

    for idx, stmt in enumerate(statements):
        if not isinstance(stmt, dict):
            continue

        path = f"Statement [{idx}]"

        effect = str(stmt.get("Effect", "")).strip().lower()
        if effect != "allow":
            continue #deny statements are not risky

        actions = _to_list(stmt.get("Action", []))
        resources = _to_list(stmt.get("Resource", []))

        # Normalize action/resource to strings
        actions_str = [str(a).strip() for a in actions]
        resources_str = [str(r).strip() for r in resources]

        # Rule A: Full Administrative Access "*"
        if "*" in actions_str and "*" in resources_str:
            key = ("iam_full_admin",path)
            if key not in seen:
                findings.append({
                    "type": "iam",
                    "issue": "Full Administrative Access",
                    "detail": "Statement contains '*' Action on '*' Resource. This is equivalent to root access.",
                    "severity": "critical",
                    "nist_reference": "NIST SP 800-53 AC-6",
                    "path": path
                })
                seen.add(key)
            continue

        # Rule B: Action "*"
        if "*" in actions_str:
            key = ("iam_action_star",path)
            if key not in seen:
                findings.append({
                    "type": "iam",
                    "issue": "Overly permissive IAM action (*)",
                    "detail": "Action '*' allows all operations within a service. This violates least privilege.",
                    "severity": "high",
                    "nist_reference": "NIST SP 800-53 AC-6",
                    "path": path
                })
                seen.add(key)

        # Rule C: Resource "*"
        if "*" in resources_str:
            key = ("iam_resource_star",path)
            if key not in seen:
                findings.append({
                    "type": "iam",
                    "issue": "Overly permissive IAM resource (*)",
                    "detail": "Resource '*' grants access to all resources. This violates least privilege.",
                    "severity": "high",
                    "nist_reference": "NIST SP 800-53 AC-6",
                    "path": path
                })
                seen.add(key)

    return findings
