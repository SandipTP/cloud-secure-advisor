# backend/rules/sg_rules.py

def detect_open_security_group(sg_json):
    findings = []

    if not isinstance(sg_json, dict) or "IpPermissions" not in sg_json:
        return findings

    permissions = sg_json.get("IpPermissions", [])
    if not isinstance(permissions, list):
        return findings

    seen = set()

    for rule in permissions:
        if not isinstance(rule, dict):
            continue

        from_port = rule.get("FromPort")
        to_port = rule.get("ToPort")
        ip_proto = rule.get("IpProtocol", "")

        # Port display
        if from_port is None and to_port is None:
            port_desc = "all ports"
        elif from_port == -1 or to_port == -1:
            port_desc = "all ports"
        elif from_port == to_port:
            port_desc = f"port {from_port}"
        else:
            port_desc = f"ports {from_port}-{to_port}"

        # IPv4 ranges
        ip_ranges = rule.get("IpRanges", []) or []
        for ipr in ip_ranges:
            if not isinstance(ipr, dict):
                continue
            cidr = ipr.get("CidrIp", "")
            if cidr == "0.0.0.0/0":
                key = ("ipv4_public", port_desc, str(ip_proto))
                if key not in seen:
                    findings.append({
                        "type": "sg",
                        "issue": "Security group allows public ingress (IPv4)",
                        "detail": f"Ingress {port_desc} is open to the world (0.0.0.0/0). Protocol: {ip_proto}.",
                        "severity": "critical",
                        "nist_reference": "NIST SP 800-53 SC-7"
                    })
                    seen.add(key)

        # IPv6 ranges
        ipv6_ranges = rule.get("Ipv6Ranges", []) or []
        for ipr6 in ipv6_ranges:
            if not isinstance(ipr6, dict):
                continue
            cidr6 = ipr6.get("CidrIpv6", "")
            if cidr6 == "::/0":
                key = ("ipv6_public", port_desc, str(ip_proto))
                if key not in seen:
                    findings.append({
                        "type": "sg",
                        "issue": "Security group allows public ingress (IPv6)",
                        "detail": f"Ingress {port_desc} is open to the world (::/0). Protocol: {ip_proto}.",
                        "severity": "critical",
                        "nist_reference": "NIST SP 800-53 SC-7"
                    })
                    seen.add(key)

    return findings
