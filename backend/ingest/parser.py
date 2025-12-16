import json
import yaml
from rules.iam_rules import detect_overly_permissive_iam
from rules.s3_rules import detect_public_s3_bucket
from rules.sg_rules import detect_open_security_group


def parse_config(filepath):
    if filepath.endswith(".json"):
        with open(filepath, "r") as f:
            data = json.load(f)

        findings = []

        # IAM rules
        if "Statement" in data:
            findings.extend(detect_overly_permissive_iam(data))

        # S3 rules
        if "Statement" in data:
            findings.extend(detect_public_s3_bucket(data))

        # Security Group rules
        if "IpPermissions" in data:
            findings.extend(detect_open_security_group(data))

        return {
            "raw_config": data,
            "findings": findings
        }

    if filepath.endswith(".yaml") or filepath.endswith(".yml"):
        with open(filepath, "r") as f:
            data = yaml.safe_load(f)

        return {
            "raw_config": data,
            "findings": []
        }

    return {"error": "Unsupported file type"}
