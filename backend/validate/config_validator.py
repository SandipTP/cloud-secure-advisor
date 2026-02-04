def validate_iam_policy(policy_json):
    # Must be a JSON object
    if not isinstance(policy_json, dict):
        return "Policy must be a JSON object"

    # Must contain Statement
    if "Statement" not in policy_json:
        return "Missing required field: Statement"

    stmts = policy_json["Statement"]

    # Statement must be list or dict
    if not isinstance(stmts, (list, dict)):
        return "Statement must be a list or object"

    # Normalize to list for validation
    if isinstance(stmts, dict):
        stmts = [stmts]

    # Validate each statement
    for i, stmt in enumerate(stmts):
        if not isinstance(stmt, dict):
            return f"Statement[{i}] must be an object"

        if "Effect" not in stmt:
            return f"Statement[{i}] missing Effect"

        if "Action" not in stmt:
            return f"Statement[{i}] missing Action"

        if "Resource" not in stmt:
            return f"Statement[{i}] missing Resource"

    return None  # valid
