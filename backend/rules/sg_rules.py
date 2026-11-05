# backend/rules/sg_rules.py

def detect_open_security_group(sg_json):
    """
    Detect overly permissive ingress rules in AWS Security Groups (IPv4 0.0.0.0/0 and IPv6 ::/0).
    Checks both specific sensitive ports (SSH 22, RDP 3389, HTTP 80, MySQL 3306, etc.)
    and generic unrestricted ingress.
    """
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

        # Port description
        if from_port is None and to_port is None:
            port_desc = "all ports"
            is_all_ports = True
        elif from_port == -1 or to_port == -1:
            port_desc = "all ports"
            is_all_ports = True
        elif from_port == to_port:
            port_desc = f"port {from_port}"
            is_all_ports = False
        else:
            port_desc = f"ports {from_port}-{to_port}"
            is_all_ports = False

        def port_covers(target_port):
            if is_all_ports:
                return True
            if from_port is not None and to_port is not None:
                return from_port <= target_port <= to_port
            return False

        # Specific sensitive port checks
        sensitive_ports = [
            (22, "Open SSH (Port 22)", "HIGH", "SC-7 (Boundary Protection), AC-17 (Remote Access)", "Change CidrIp to a specific trusted IP range or corporate VPN."),
            (3389, "Open RDP (Port 3389)", "HIGH", "SC-7 (Boundary Protection), AC-17 (Remote Access)", "Close port 3389 or restrict it to an authenticated bastion host."),
            (23, "Open Telnet Port", "CRITICAL", "SC-7 (Boundary Protection), SC-8 (Transmission Confidentiality and Integrity)", "Disable unencrypted Port 23 and use SSH instead."),
            (80, "Unencrypted HTTP Access", "MEDIUM", "SC-8 (Transmission Confidentiality and Integrity), SC-13 (Cryptographic Protection)", "Redirect Port 80 unencrypted HTTP traffic to Port 443 (HTTPS)."),
            (3306, "Open Database Port (3306)", "HIGH", "SC-7 (Boundary Protection), AC-3 (Access Enforcement)", "Restrict database port 3306 to internal application subnets only."),
            (27017, "Open MongoDB Port", "HIGH", "SC-7 (Boundary Protection), AC-3 (Access Enforcement)", "Restrict MongoDB port 27017 to internal application security groups."),
            (21, "Open FTP Port", "MEDIUM", "SC-7 (Boundary Protection), SC-8 (Transmission Confidentiality and Integrity)", "FTP sends credentials in plaintext. Use SFTP or FTPS instead."),
            (53, "Open DNS Port", "LOW", "SC-7 (Boundary Protection)", "Restrict DNS port 53 access to authorized DNS resolvers."),
        ]

        # IPv4 ranges
        ip_ranges = rule.get("IpRanges", []) or []
        for ipr in ip_ranges:
            if not isinstance(ipr, dict):
                continue
            cidr = ipr.get("CidrIp", "")
            if cidr == "0.0.0.0/0":
                matched_port = False
                for port_num, issue_title, p_sev, p_nist, p_rem in sensitive_ports:
                    if port_covers(port_num) and not is_all_ports:
                        matched_port = True
                        key = (f"ipv4_port_{port_num}", cidr)
                        if key not in seen:
                            findings.append({
                                "category": "Network",
                                "type": "sg",
                                "issue": issue_title,
                                "detail": f"Port {port_num} ({issue_title}) is open to the entire public internet (0.0.0.0/0).",
                                "severity": p_sev,
                                "nist_reference": p_nist,
                                "remediation": p_rem,
                            })
                            seen.add(key)

                if not matched_port:
                    key = ("ipv4_public", port_desc, str(ip_proto))
                    if key not in seen:
                        findings.append({
                            "category": "Network",
                            "type": "sg",
                            "issue": "Security Group Allows Public Ingress (IPv4)",
                            "detail": f"Ingress {port_desc} is open to the entire world (0.0.0.0/0). Protocol: {ip_proto}.",
                            "severity": "CRITICAL" if is_all_ports else "HIGH",
                            "nist_reference": "NIST SP 800-53 SC-7 (Boundary Protection)",
                            "remediation": "Restrict CidrIp to trusted IP addresses or internal security groups.",
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
                        "category": "Network",
                        "type": "sg",
                        "issue": "Security Group Allows Public Ingress (IPv6)",
                        "detail": f"Ingress {port_desc} is open to the entire world (::/0). Protocol: {ip_proto}.",
                        "severity": "CRITICAL" if is_all_ports else "HIGH",
                        "nist_reference": "NIST SP 800-53 SC-7 (Boundary Protection)",
                        "remediation": "Restrict CidrIpv6 to specific authorized IPv6 subnets.",
                    })
                    seen.add(key)

    return findings
