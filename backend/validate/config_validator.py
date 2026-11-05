# backend/validate/config_validator.py

def validate_iam_policy(policy_json):
    """
    Validates that policy_json conforms to standard AWS IAM / resource policy format.
    Returns None if valid, or an error string if invalid.
    """
    if not isinstance(policy_json, dict):
        return "Policy must be a JSON/YAML object"

    if "Statement" not in policy_json:
        return "Missing required field: Statement"

    stmts = policy_json["Statement"]
    if not isinstance(stmts, (list, dict)):
        return "Statement must be a list or object"

    if isinstance(stmts, dict):
        stmts = [stmts]

    for i, stmt in enumerate(stmts):
        if not isinstance(stmt, dict):
            return f"Statement[{i}] must be an object"

        if "Effect" not in stmt:
            return f"Statement[{i}] missing required Effect"

        effect = str(stmt["Effect"]).strip().lower()
        if effect not in ("allow", "deny"):
            return f"Statement[{i}] Effect must be 'Allow' or 'Deny'"

        if "Action" not in stmt and "NotAction" not in stmt:
            return f"Statement[{i}] missing Action or NotAction"

        if "Resource" not in stmt and "NotResource" not in stmt and "Principal" not in stmt:
            return f"Statement[{i}] missing Resource or Principal"

    return None
