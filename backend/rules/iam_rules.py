# backend/rules/iam_rules.py

def _to_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def detect_overly_permissive_iam(policy_json):
    findings = []

    if not isinstance(policy_json, dict) or "Statement" not in policy_json:
        return findings

    statements = policy_json["Statement"]
    if isinstance(statements, dict):
        statements = [statements]

    seen = set()  # avoid duplicates

    for stmt in statements:
        if not isinstance(stmt, dict):
            continue

        effect = str(stmt.get("Effect", "")).strip().lower()
        if effect and effect != "allow":
            # If Effect is explicitly Deny, don't flag it.
            continue

        actions = _to_list(stmt.get("Action", []))
        resources = _to_list(stmt.get("Resource", []))

        # Normalize action/resource to strings
        actions_str = [str(a).strip() for a in actions]
        resources_str = [str(r).strip() for r in resources]

        # Rule A: Action "*"
        if "*" in actions_str:
            key = ("iam_action_star",)
            if key not in seen:
                findings.append({
                    "type": "iam",
                    "issue": "Overly permissive IAM action (*)",
                    "detail": "Action '*' allows all actions. This violates least privilege.",
                    "severity": "high",
                    "nist_reference": "NIST SP 800-53 AC-6"
                })
                seen.add(key)

        # Rule B: Resource "*"
        if "*" in resources_str:
            key = ("iam_resource_star",)
            if key not in seen:
                findings.append({
                    "type": "iam",
                    "issue": "Overly permissive IAM resource (*)",
                    "detail": "Resource '*' grants access to all resources. This violates least privilege.",
                    "severity": "high",
                    "nist_reference": "NIST SP 800-53 AC-6"
                })
                seen.add(key)

    return findings
