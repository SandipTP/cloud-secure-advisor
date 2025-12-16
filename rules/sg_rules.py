def detect_open_security_group(sg_json):
    findings = []

    # Typical AWS security group structure:
    # { "IpPermissions": [ { "FromPort": 22, "IpRanges": [{"CidrIp": "0.0.0.0/0"}] } ] }

    if "IpPermissions" not in sg_json:
        return findings

    for rule in sg_json["IpPermissions"]:
        from_port = rule.get("FromPort", "Unknown")
        ip_ranges = rule.get("IpRanges", [])

        for ip_range in ip_ranges:
            cidr = ip_range.get("CidrIp", "")

            if cidr == "0.0.0.0/0":
                findings.append({
                    "type": "SecurityGroup",
                    "issue": "Security group allows public ingress",
                    "detail": f"Port {from_port} is open to the world (0.0.0.0/0).",
                    "severity": "Critical",
                    "nist_reference": "NIST SP 800-53 SC-7 (Boundary Protection)"
                })

    return findings
