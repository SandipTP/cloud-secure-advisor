import { useState } from "react";

const G = {
  bg: "#0a0e1a",
  surface: "#111827",
  card: "#161d2e",
  border: "#1e2d45",
  accent: "#00d4ff",
  accentDim: "#0ea5c9",
  green: "#10b981",
  yellow: "#f59e0b",
  red: "#ef4444",
  critical: "#dc2626",
  purple: "#8b5cf6",
  text: "#e2e8f0",
  muted: "#64748b",
  font: "'DM Mono', 'Fira Code', monospace",
  fontDisplay: "'Space Grotesk', sans-serif",
};

/* ============================================================
   COMPLIANCE FRAMEWORKS & CONTROLS
============================================================ */
const _hasText = (target, query) => (target || "").toLowerCase().includes(query.toLowerCase());

const _nistHas = (ref, code) => {
  if (!ref) return false;
  const parts = ref.replace(/;/g, ",").split(",").map(p => p.trim().toUpperCase());
  return parts.includes(code.toUpperCase()) || parts.some(p => p.includes(code.toUpperCase()));
};

export const COMPLIANCE_FRAMEWORKS = {
  nist_800_53: {
    key: "nist_800_53",
    name: "NIST SP 800-53 Rev. 5",
    shortName: "NIST 800-53",
    icon: "🏛",
    color: G.accent,
    description: "Security and Privacy Controls for Federal Information Systems and Organizations",
    controls: [
      {
        id: "AC-3",
        name: "Access Enforcement",
        family: "Access Control",
        description: "Enforce approved authorizations for logical access to information and system resources in accordance with applicable access control policies.",
        remediation: "Restrict policy actions and principals. Eliminate wildcard permissions and open public bucket policies.",
        check: (f) => _nistHas(f.nist_reference, "AC-3") ||
          (["IAM", "S3", "Network"].includes(f.category) && ["wildcard", "public", "unrestricted", "allow all"].some(w => _hasText(f.issue, w))),
      },
      {
        id: "AC-6",
        name: "Principle of Least Privilege",
        family: "Access Control",
        description: "Employ the principle of least privilege, allowing only authorized accesses for users and service roles necessary to accomplish assigned tasks.",
        remediation: "Scope IAM policies down to specific actions and explicit resource ARNs. Remove administrative Action: * statements.",
        check: (f) => _nistHas(f.nist_reference, "AC-6") ||
          ["privilege", "admin", "wildcard", "full access"].some(w => _hasText(f.issue, w)),
      },
      {
        id: "AC-17",
        name: "Remote Access Management",
        family: "Access Control",
        description: "Authorize, monitor, and control all remote access sessions (SSH, RDP) into boundary systems.",
        remediation: "Restrict security group ingress rules for port 22 and port 3389 to authorized corporate IP CIDRs instead of 0.0.0.0/0.",
        check: (f) => _nistHas(f.nist_reference, "AC-17") ||
          ["ssh", "rdp", "22", "3389", "remote access"].some(w => _hasText(f.issue, w)),
      },
      {
        id: "AU-2",
        name: "Event Logging",
        family: "Audit & Accountability",
        description: "Identify and record security-relevant events across cloud services and resources.",
        remediation: "Enable CloudTrail multi-region logging and S3 server access logging.",
        check: (f) => _nistHas(f.nist_reference, "AU-2") ||
          f.category === "Logging" || ["logging", "trail", "audit log"].some(w => _hasText(f.issue, w)),
      },
      {
        id: "AU-6",
        name: "Audit Review, Analysis, and Reporting",
        family: "Audit & Accountability",
        description: "Review and analyze information system audit records for indications of unusual or suspicious activity.",
        remediation: "Configure CloudWatch metric alarms and automated alerts for unauthorized API calls and security group modifications.",
        check: (f) => _nistHas(f.nist_reference, "AU-6") ||
          f.category === "Monitoring" || ["monitoring", "metric", "alarm", "review"].some(w => _hasText(f.issue, w)),
      },
      {
        id: "AU-12",
        name: "Audit Record Generation",
        family: "Audit & Accountability",
        description: "Generate audit records containing information to establish what events occurred and the source of the events.",
        remediation: "Enable S3 object-level data event logging in CloudTrail and configure VPC Flow Logs.",
        check: (f) => _nistHas(f.nist_reference, "AU-12") ||
          ["audit record", "object-level", "record generation"].some(w => _hasText(f.issue, w)),
      },
      {
        id: "CP-9",
        name: "Information System Backup",
        family: "Contingency Planning",
        description: "Conduct regular backups of user and system data and protect backup integrity.",
        remediation: "Enable S3 bucket versioning and MFA delete to protect against accidental or malicious object deletions.",
        check: (f) => _nistHas(f.nist_reference, "CP-9") ||
          ["versioning", "backup", "retention"].some(w => _hasText(f.issue, w)),
      },
      {
        id: "IA-2",
        name: "Identification and Authentication",
        family: "Identification & Auth",
        description: "Uniquely identify and authenticate organizational users and service principals.",
        remediation: "Enforce multi-factor authentication (MFA) on root and privileged IAM accounts. Prohibit shared access keys.",
        check: (f) => _nistHas(f.nist_reference, "IA-2") ||
          ["mfa", "root account", "authentication", "credential"].some(w => _hasText(f.issue, w)),
      },
      {
        id: "IA-5",
        name: "Authenticator Management",
        family: "Identification & Auth",
        description: "Manage system authenticators, including rotating access keys and enforcing credential strength.",
        remediation: "Rotate IAM access keys every 90 days. Store secrets in AWS Secrets Manager or KMS rather than configuration files.",
        check: (f) => _nistHas(f.nist_reference, "IA-5") ||
          f.category === "Secrets" || ["key rotation", "unrotated", "hardcoded key", "secret"].some(w => _hasText(f.issue, w)),
      },
      {
        id: "SC-7",
        name: "Boundary Protection",
        family: "System Protection",
        description: "Monitor and control communications at external and internal system boundaries.",
        remediation: "Eliminate 0.0.0.0/0 ingress rules in Security Groups. Enforce strict port-level network filtering.",
        check: (f) => _nistHas(f.nist_reference, "SC-7") ||
          f.category === "Network" || ["ingress", "security group", "boundary", "0.0.0.0/0"].some(w => _hasText(f.issue, w)),
      },
      {
        id: "SC-8",
        name: "Transmission Confidentiality and Integrity",
        family: "System Protection",
        description: "Protect the confidentiality and integrity of transmitted information using encrypted protocols (TLS/HTTPS).",
        remediation: "Add an explicit Deny policy on S3 buckets for requests where aws:SecureTransport is false.",
        check: (f) => _nistHas(f.nist_reference, "SC-8") ||
          ["http", "tls", "ssl", "transit", "securetransport", "unencrypted transmission"].some(w => _hasText(f.issue, w)),
      },
      {
        id: "SC-13",
        name: "Cryptographic Protection",
        family: "System Protection",
        description: "Implement cryptographic modules and key management in accordance with applicable federal standards.",
        remediation: "Use AWS KMS Customer Managed Keys (CMK) with automated key rotation for data volume and bucket encryption.",
        check: (f) => _nistHas(f.nist_reference, "SC-13") ||
          f.category === "Encryption" || ["kms", "cmk", "cryptographic", "key management"].some(w => _hasText(f.issue, w)),
      },
      {
        id: "SC-28",
        name: "Protection of Information at Rest",
        family: "System Protection",
        description: "Protect the confidentiality and integrity of information at rest across storage volumes, databases, and buckets.",
        remediation: "Enable default server-side encryption (SSE-KMS or SSE-S3) on all S3 buckets and RDS storage instances.",
        check: (f) => _nistHas(f.nist_reference, "SC-28") ||
          ["at rest", "unencrypted bucket", "server-side encryption", "unencrypted"].some(w => _hasText(f.issue, w)),
      },
    ],
  },
  cis_aws_benchmark: {
    key: "cis_aws_benchmark",
    name: "CIS AWS Foundations Benchmark v3.0",
    shortName: "CIS AWS Benchmark",
    icon: "🛡",
    color: G.green,
    description: "Prescriptive guidance for establishing a secure baseline configuration for AWS accounts.",
    controls: [
      {
        id: "CIS 1.4",
        name: "Ensure access keys are rotated every 90 days or less",
        family: "1. IAM",
        description: "Rotating access keys periodically reduces the window of exposure for compromised credentials.",
        remediation: "Identify active access keys older than 90 days and rotate them using IAM credential lifecycle workflows.",
        check: (f) => f.category === "Secrets" || ["rotate", "key age", "hardcoded key", "90 days"].some(w => _hasText(f.issue, w)),
      },
      {
        id: "CIS 1.5",
        name: "Ensure MFA is enabled for the 'root' user account",
        family: "1. IAM",
        description: "The root account has unrestricted administrative privileges across the entire AWS account. MFA is mandatory.",
        remediation: "Enable multi-factor authentication (MFA) on the root account and eliminate root access keys.",
        check: (f) => ["root", "mfa"].some(w => _hasText(f.issue, w)),
      },
      {
        id: "CIS 1.16",
        name: "Ensure IAM policies adhere to least privilege",
        family: "1. IAM",
        description: "IAM policies must not grant wildcard 'Action: *' or 'Resource: *' permissions.",
        remediation: "Replace wildcard permissions with specific actions (e.g. s3:GetObject) and target resource ARNs.",
        check: (f) => f.category === "IAM" && ["wildcard", "least privilege", "permissive", "full admin"].some(w => _hasText(f.issue, w)),
      },
      {
        id: "CIS 2.1.1",
        name: "Ensure S3 Buckets are configured with 'Block Public Access'",
        family: "2. Storage",
        description: "S3 Block Public Access prevents accidental public exposure of buckets and objects via ACLs or bucket policies.",
        remediation: "Enable all four S3 Block Public Access settings on the bucket and account level.",
        check: (f) => f.category === "S3" && ["public", "principal: *", "unrestricted read", "unrestricted write"].some(w => _hasText(f.issue, w)),
      },
      {
        id: "CIS 2.1.2",
        name: "Ensure S3 bucket policies require requests to use HTTPS / TLS",
        family: "2. Storage",
        description: "Bucket policies must deny unencrypted HTTP traffic by checking aws:SecureTransport.",
        remediation: "Attach a bucket policy statement denying s3:* when Condition aws:SecureTransport is false.",
        check: (f) => f.category === "S3" && ["http", "tls", "ssl", "securetransport", "transit"].some(w => _hasText(f.issue, w)),
      },
      {
        id: "CIS 2.1.3",
        name: "Ensure S3 bucket server-side encryption is enabled",
        family: "2. Storage",
        description: "Enable default server-side encryption on all buckets using KMS CMK or AES256.",
        remediation: "Configure default encryption on the bucket properties using aws:kms or AES256.",
        check: (f) => f.category === "S3" && ["encryption", "unencrypted", "sse", "kms"].some(w => _hasText(f.issue, w)),
      },
      {
        id: "CIS 2.1.4",
        name: "Ensure S3 bucket versioning and lifecycle logging are enabled",
        family: "2. Storage",
        description: "Versioning preserves previous iterations of objects to prevent data loss from accidental deletion.",
        remediation: "Enable bucket versioning and configure lifecycle transition rules.",
        check: (f) => f.category === "S3" && ["versioning", "lifecycle", "logging disabled"].some(w => _hasText(f.issue, w)),
      },
      {
        id: "CIS 3.1",
        name: "Ensure CloudTrail is enabled in all regions",
        family: "3. Logging",
        description: "CloudTrail records AWS API calls and delivers log files to an Amazon S3 bucket for security analysis.",
        remediation: "Create a multi-region CloudTrail trail with log file validation enabled.",
        check: (f) => f.category === "Logging" || ["cloudtrail", "trail", "event logging"].some(w => _hasText(f.issue, w)),
      },
      {
        id: "CIS 4.1",
        name: "Ensure VPC flow logging and monitoring are enabled",
        family: "4. Monitoring",
        description: "VPC Flow Logs capture network traffic IP information for security monitoring and incident response.",
        remediation: "Enable VPC Flow Logs with delivery to CloudWatch Logs or S3.",
        check: (f) => ["Monitoring", "Config"].includes(f.category) || ["flow log", "monitoring", "metric filter"].some(w => _hasText(f.issue, w)),
      },
      {
        id: "CIS 5.1",
        name: "Ensure no security groups allow ingress from 0.0.0.0/0 to port 22",
        family: "5. Networking",
        description: "Port 22 (SSH) must not be accessible to the public internet to prevent brute-force attacks.",
        remediation: "Update security group ingress rules to allow port 22 only from trusted bastion hosts or VPN CIDRs.",
        check: (f) => f.category === "Network" && ["22", "ssh"].some(w => _hasText(f.issue, w)),
      },
      {
        id: "CIS 5.2",
        name: "Ensure no security groups allow ingress from 0.0.0.0/0 to port 3389",
        family: "5. Networking",
        description: "Port 3389 (RDP) must not be accessible to the public internet.",
        remediation: "Update security group ingress rules to restrict port 3389 to authorized administrator IP addresses.",
        check: (f) => f.category === "Network" && ["3389", "rdp"].some(w => _hasText(f.issue, w)),
      },
      {
        id: "CIS 5.3",
        name: "Ensure no security groups allow unrestricted ingress to all ports",
        family: "5. Networking",
        description: "Security group rules must specify allowed ports rather than opening all protocol ports to 0.0.0.0/0.",
        remediation: "Remove 0.0.0.0/0 ingress rules that specify port -1 or port range 0-65535.",
        check: (f) => f.category === "Network" && ["all ports", "unrestricted ingress", "open ingress"].some(w => _hasText(f.issue, w)),
      },
      {
        id: "CIS 6.1",
        name: "Ensure database storage is encrypted at rest",
        family: "6. Database",
        description: "RDS instances and database clusters must be encrypted with KMS keys.",
        remediation: "Enable storage encryption during RDS database creation or snapshot restore.",
        check: (f) => f.category === "Database" || (["database", "rds"].some(w => _hasText(f.issue, w)) && _hasText(f.issue, "encrypt")),
      },
    ],
  },
  soc2_type_ii: {
    key: "soc2_type_ii",
    name: "SOC 2 Type II (Estimated Trust Services Criteria)",
    shortName: "SOC 2 Type II",
    icon: "📋",
    color: G.purple,
    description: "AICPA Trust Services Criteria mapping for Security, Availability, and Confidentiality.",
    controls: [
      {
        id: "CC6.1",
        name: "Logical Access Controls",
        family: "Common Criteria 6",
        description: "The entity implements logical access security software, infrastructure, and architectures over protected information assets.",
        remediation: "Enforce explicit authentication, eliminate public bucket access, and restrict role assumption policies.",
        check: (f) => f.category === "IAM" || ["public bucket", "mfa", "authentication", "principal: *"].some(w => _hasText(f.issue, w)),
      },
      {
        id: "CC6.2",
        name: "Credential & Key Management",
        family: "Common Criteria 6",
        description: "The entity registers, modifies, rotates, and decommissions access credentials and cryptographic keys.",
        remediation: "Rotate access credentials and KMS customer-managed keys periodically. Prohibit plaintext keys in code.",
        check: (f) => f.category === "Secrets" || ["key", "credential", "rotate", "secret", "token"].some(w => _hasText(f.issue, w)),
      },
      {
        id: "CC6.3",
        name: "Principle of Least Privilege",
        family: "Common Criteria 6",
        description: "The entity authorizes, modifies, and removes access to data and software based on job responsibilities.",
        remediation: "Eliminate full administrative access statements (Action: * on Resource: *). Grant role-specific permissions.",
        check: (f) => ["least privilege", "wildcard", "admin", "overly permissive"].some(w => _hasText(f.issue, w)),
      },
      {
        id: "CC6.6",
        name: "Perimeter & Boundary Protection",
        family: "Common Criteria 6",
        description: "The entity implements perimeter boundary controls to restrict unauthorized network traffic from external sources.",
        remediation: "Configure restrictive firewall rules and Security Groups; block all 0.0.0.0/0 ingress to sensitive ports.",
        check: (f) => f.category === "Network" || ["ingress", "security group", "0.0.0.0/0", "boundary", "port"].some(w => _hasText(f.issue, w)),
      },
      {
        id: "CC6.7",
        name: "Data Protection & Encryption",
        family: "Common Criteria 6",
        description: "The entity protects data in transmission and data at rest using approved cryptographic mechanisms.",
        remediation: "Enforce TLS in transit for all S3 and API requests. Enable server-side encryption for data at rest.",
        check: (f) => ["Encryption", "S3"].includes(f.category) && ["encryption", "unencrypted", "tls", "ssl", "kms", "sse", "transit"].some(w => _hasText(f.issue, w)),
      },
      {
        id: "CC7.1",
        name: "Vulnerability & Configuration Management",
        family: "Common Criteria 7",
        description: "The entity identifies, assesses, and manages vulnerabilities and configuration defects in system components.",
        remediation: "Establish automated configuration compliance checks and remediate high-severity misconfigurations.",
        check: (f) => f.category === "Config" || ["configuration", "vulnerability", "misconfiguration"].some(w => _hasText(f.issue, w)),
      },
      {
        id: "CC7.2",
        name: "Security Incident & Audit Logging",
        family: "Common Criteria 7",
        description: "The entity monitors system components and operations to detect potential security incidents.",
        remediation: "Enable central audit logging via CloudTrail, S3 access logging, and automated threat alerts.",
        check: (f) => f.category === "Logging" || ["logging", "audit", "trail", "monitor"].some(w => _hasText(f.issue, w)),
      },
    ],
  },
};

/* ============================================================
   COMPLIANCE EXPORT HELPERS
============================================================ */
export function exportComplianceCSV(frameworkResults, scopeLabel) {
  const headers = ["Framework", "Control ID", "Control Name", "Family", "Status", "Violations Count", "Violating Issues", "Remediation"];
  const rows = [];
  Object.values(frameworkResults).forEach(fw => {
    fw.controls.forEach(c => {
      const issues = c.violations.map(v => `[${v.severity || "INFO"}] ${v.issue}`).join(" | ");
      rows.push([
        fw.name,
        c.id,
        c.name,
        c.family,
        c.status,
        c.violations.length,
        issues,
        c.remediation,
      ].map(v => `"${String(v || "").replace(/"/g, '""')}"`).join(","));
    });
  });
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `compliance-report-${scopeLabel.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCompliancePDF(frameworkResults, scopeLabel) {
  const fwSections = Object.values(frameworkResults).map(fw => {
    const rows = fw.controls.map(c => {
      const isFail = c.status === "FAIL";
      const badgeBg = isFail ? "#ef4444" : "#10b981";
      const violHtml = isFail && c.violations.length > 0
        ? `<div style="margin-top:6px;font-size:11px;color:#991b1b;background:#fef2f2;padding:8px 10px;border-radius:4px;border:1px solid #fecaca">
            <strong>Violating Findings (${c.violations.length}):</strong><br/>
            ${c.violations.map(v => `&bull; [${v.severity || "INFO"}] ${v.issue}${v.filename ? ` &mdash; <em>${v.filename}</em>` : ""}`).join("<br/>")}
            <div style="margin-top:6px;color:#1e40af"><strong>Remediation:</strong> ${c.remediation}</div>
           </div>`
        : "";

      return `
        <tr style="border-bottom:1px solid #e5e7eb">
          <td style="padding:10px 8px;font-family:monospace;font-weight:700;font-size:12px;white-space:nowrap;vertical-align:top">${c.id}</td>
          <td style="padding:10px 8px;vertical-align:top">
            <div style="font-weight:600;font-size:13px;color:#111">${c.name}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:2px">${c.family} &bull; ${c.description}</div>
            ${violHtml}
          </td>
          <td style="padding:10px 8px;text-align:center;vertical-align:top">
            <span style="background:${badgeBg};color:white;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700">${c.status}</span>
          </td>
        </tr>
      `;
    }).join("");

    const scoreColor = fw.score >= 80 ? "#10b981" : fw.score >= 50 ? "#f59e0b" : "#ef4444";

    return `
      <div style="margin-bottom:32px;page-break-inside:avoid">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:12px">
          <div>
            <h2 style="margin:0;font-size:17px;color:#0f172a">${fw.icon} ${fw.name}</h2>
            <div style="font-size:12px;color:#6b7280;margin-top:2px">${fw.hasData ? `${fw.passing}/${fw.total} controls passing (${fw.failing} failing)` : "Not Evaluated"}</div>
          </div>
          <div style="font-size:24px;font-weight:700;color:${scoreColor}">${fw.hasData ? `${fw.score}%` : "N/A"}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-top:8px">
          <thead>
            <tr style="background:#f1f5f9;text-align:left">
              <th style="padding:8px;font-size:11px;font-weight:700;color:#334155;width:90px">Control ID</th>
              <th style="padding:8px;font-size:11px;font-weight:700;color:#334155">Description & Remediation</th>
              <th style="padding:8px;font-size:11px;font-weight:700;color:#334155;text-align:center;width:80px">Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }).join("");

  const html = `<!DOCTYPE html><html><head><title>Cloud Compliance Audit Report</title>
  <style>
    body { font-family:system-ui,-apple-system,sans-serif; max-width:1100px; margin:0 auto; padding:40px; color:#111; line-height:1.4; }
    h1 { color:#0f172a; font-size:24px; margin-bottom:4px; }
    .meta { color:#6b7280; font-size:13px; margin-bottom:24px; }
    @media print { body { padding:15px; } }
  </style>
  </head><body>
    <h1>🛡 CloudSecure Advisor &mdash; Compliance Audit Report</h1>
    <p class="meta">Generated: ${new Date().toLocaleString()} &bull; Scope: ${scopeLabel}</p>
    ${fwSections}
  </body></html>`;

  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.print(); }, 400);
  }
}

/* ============================================================
   COMPLIANCE PANEL COMPONENT
============================================================ */
export default function CompliancePanel({ findings = [], history = [], onNavigateToScan }) {
  const [selectedScope, setSelectedScope] = useState("all");
  const [selectedFramework, setSelectedFramework] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'failing' | 'passing'
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedControls, setExpandedControls] = useState({});

  // Map upload filenames to findings for detailed violation attribution
  const uploadMap = {};
  history.forEach(h => { uploadMap[h.id] = h.filename; });

  const enrichedFindings = findings.map(f => ({
    ...f,
    filename: f.filename || uploadMap[f.upload_id] || `Scan #${f.upload_id}`,
  }));

  // Filter findings based on selected scan scope
  const activeFindings = selectedScope === "all"
    ? enrichedFindings
    : enrichedFindings.filter(f => String(f.upload_id) === String(selectedScope));

  const hasScans = history.length > 0;

  // Evaluate all frameworks against active findings
  const evaluatedFrameworks = {};
  Object.entries(COMPLIANCE_FRAMEWORKS).forEach(([key, fw]) => {
    if (!hasScans) {
      evaluatedFrameworks[key] = {
        ...fw,
        hasData: false,
        total: fw.controls.length,
        passing: 0,
        failing: 0,
        score: 0,
        status: "NO_DATA",
        controls: fw.controls.map(c => ({
          ...c,
          status: "NOT_EVALUATED",
          violations: [],
        })),
      };
      return;
    }

    const evaluatedControls = fw.controls.map(ctrl => {
      const violations = activeFindings.filter(f => {
        try {
          return ctrl.check(f);
        } catch {
          return false;
        }
      });
      return {
        ...ctrl,
        status: violations.length > 0 ? "FAIL" : "PASS",
        violations,
      };
    });

    const failing = evaluatedControls.filter(c => c.status === "FAIL").length;
    const total = evaluatedControls.length;
    const passing = total - failing;
    const score = Math.round((passing / total) * 100);

    evaluatedFrameworks[key] = {
      ...fw,
      hasData: true,
      total,
      passing,
      failing,
      score,
      status: failing === 0 ? "COMPLIANT" : (score >= 70 ? "PARTIAL" : "NON_COMPLIANT"),
      controls: evaluatedControls,
    };
  });

  const toggleControl = (id) => {
    setExpandedControls(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getScopeLabel = () => {
    if (selectedScope === "all") {
      return `All Scans (${history.length} file${history.length !== 1 ? "s" : ""}, ${activeFindings.length} issue${activeFindings.length !== 1 ? "s" : ""})`;
    }
    const h = history.find(item => String(item.id) === String(selectedScope));
    return h ? `${h.filename} (Score: ${h.score ?? "—"})` : `Scan #${selectedScope}`;
  };

  const displayedFrameworks = selectedFramework === "all"
    ? Object.values(evaluatedFrameworks)
    : [evaluatedFrameworks[selectedFramework]].filter(Boolean);

  const totalFailingAll = Object.values(evaluatedFrameworks).reduce((s, fw) => s + fw.failing, 0);
  const totalPassingAll = Object.values(evaluatedFrameworks).reduce((s, fw) => s + fw.passing, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Scope Selector & Actions Header */}
      <div style={{
        background: G.card, border: `1px solid ${G.border}`, borderRadius: "14px",
        padding: "16px 20px", display: "flex", justifyContent: "space-between",
        alignItems: "center", flexWrap: "wrap", gap: "14px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "13px", color: G.muted, fontFamily: G.fontDisplay, fontWeight: 500 }}>
            Compliance Scope:
          </span>
          <select
            value={selectedScope}
            onChange={e => setSelectedScope(e.target.value)}
            disabled={!hasScans}
            style={{
              background: G.surface, color: G.text, border: `1px solid ${G.border}`,
              borderRadius: "8px", padding: "8px 14px", fontSize: "13px",
              fontFamily: G.font, outline: "none", cursor: hasScans ? "pointer" : "not-allowed",
            }}
          >
            <option value="all">
              All Scans ({history.length} files &bull; {findings.length} findings)
            </option>
            {history.map(h => (
              <option key={h.id} value={h.id}>
                {h.filename} &mdash; Score: {h.score ?? 100} ({h.findings_count ?? 0} findings)
              </option>
            ))}
          </select>
        </div>

        {hasScans && (
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => exportComplianceCSV(evaluatedFrameworks, getScopeLabel())}
              className="btn-ghost"
              style={{ fontSize: "12px", padding: "8px 14px" }}
              title="Export all framework evaluations and remediation guidance to CSV"
            >
              ⬇ Export CSV
            </button>
            <button
              onClick={() => exportCompliancePDF(evaluatedFrameworks, getScopeLabel())}
              className="btn-ghost"
              style={{ fontSize: "12px", padding: "8px 14px" }}
              title="Open printable compliance audit report"
            >
              🖨 Print / PDF Report
            </button>
          </div>
        )}
      </div>

      {/* Empty State Banner (When no scans exist) */}
      {!hasScans && (
        <div style={{
          background: `${G.accent}08`, border: `1px solid ${G.accent}33`,
          borderRadius: "14px", padding: "36px 24px", textAlign: "center",
        }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>📋</div>
          <div style={{ fontSize: "17px", fontWeight: 700, color: G.text, marginBottom: "8px" }}>
            No Scan Data Available
          </div>
          <p style={{ color: G.muted, fontSize: "13px", maxWidth: "560px", margin: "0 auto 20px", lineHeight: 1.5 }}>
            Upload and scan your cloud infrastructure configurations (AWS IAM policies, S3 bucket policies, Security Groups)
            to automatically evaluate alignment with NIST SP 800-53, CIS AWS Benchmark, and SOC 2 Type II.
          </p>
          {onNavigateToScan && (
            <button onClick={onNavigateToScan} className="btn-primary" style={{ padding: "10px 24px" }}>
              ⟳ Scan Cloud Config Files
            </button>
          )}
        </div>
      )}

      {/* Scanned Clean State Banner (When scans exist and 0 violations in scope) */}
      {hasScans && activeFindings.length === 0 && (
        <div style={{
          background: `${G.green}12`, border: `1px solid ${G.green}44`,
          borderRadius: "12px", padding: "16px 20px", display: "flex",
          alignItems: "center", gap: "14px",
        }}>
          <span style={{ fontSize: "24px" }}>✅</span>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: G.green }}>
              100% Compliant Posture Across Scanned Files
            </div>
            <div style={{ fontSize: "12px", color: G.muted, marginTop: "2px" }}>
              Zero security misconfigurations detected in the current scope. All controls meet baseline compliance requirements.
            </div>
          </div>
        </div>
      )}

      {/* Framework Summary Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
        {Object.values(evaluatedFrameworks).map(fw => {
          const score = fw.score;
          const scoreColor = !fw.hasData ? G.muted : (score >= 80 ? G.green : score >= 50 ? G.yellow : G.red);
          const isSelected = selectedFramework === fw.key;

          return (
            <div
              key={fw.key}
              onClick={() => setSelectedFramework(prev => prev === fw.key ? "all" : fw.key)}
              className="card-hover fade-up"
              style={{
                background: G.card,
                border: `1px solid ${isSelected ? G.accent : G.border}`,
                borderRadius: "14px",
                padding: "20px",
                cursor: "pointer",
                position: "relative",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "22px" }}>{fw.icon}</span>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: G.text }}>{fw.shortName}</div>
                    <div style={{ fontSize: "11px", color: G.muted }}>
                      {fw.hasData ? `${fw.passing} of ${fw.total} passing` : "Not evaluated"}
                    </div>
                  </div>
                </div>
                <div style={{
                  fontSize: "26px", fontWeight: 700, color: scoreColor, fontFamily: G.font, lineHeight: 1,
                }}>
                  {fw.hasData ? `${score}%` : "—"}
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ height: "6px", background: G.border, borderRadius: "3px", overflow: "hidden", marginBottom: "10px" }}>
                <div style={{
                  height: "100%", width: fw.hasData ? `${score}%` : "0%", background: scoreColor,
                  borderRadius: "3px", transition: "width 0.8s ease",
                }} />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" }}>
                {fw.hasData ? (
                  fw.failing > 0 ? (
                    <span style={{ color: G.red, fontWeight: 500 }}>⚠ {fw.failing} control{fw.failing !== 1 ? "s" : ""} failing</span>
                  ) : (
                    <span style={{ color: G.green, fontWeight: 500 }}>✓ All {fw.total} controls pass</span>
                  )
                ) : (
                  <span style={{ color: G.muted }}>Upload scan to evaluate</span>
                )}
                <span style={{ color: isSelected ? G.accent : G.muted, fontSize: "11px" }}>
                  {isSelected ? "● Viewing" : "Click to view"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Control Checklist Section */}
      <div style={{
        background: G.card, border: `1px solid ${G.border}`, borderRadius: "14px", padding: "20px",
      }}>
        {/* Filter Toolbar */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: "12px", marginBottom: "20px", borderBottom: `1px solid ${G.border}`,
          paddingBottom: "16px",
        }}>
          {/* Framework tabs */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              onClick={() => setSelectedFramework("all")}
              style={{
                background: selectedFramework === "all" ? `${G.accent}22` : "transparent",
                color: selectedFramework === "all" ? G.accent : G.muted,
                border: `1px solid ${selectedFramework === "all" ? G.accent : G.border}`,
                borderRadius: "6px", padding: "6px 12px", fontSize: "12px",
                fontFamily: G.fontDisplay, fontWeight: 600, cursor: "pointer",
              }}
            >
              All Frameworks
            </button>
            {Object.values(evaluatedFrameworks).map(fw => (
              <button
                key={fw.key}
                onClick={() => setSelectedFramework(fw.key)}
                style={{
                  background: selectedFramework === fw.key ? `${fw.color}22` : "transparent",
                  color: selectedFramework === fw.key ? fw.color : G.muted,
                  border: `1px solid ${selectedFramework === fw.key ? fw.color : G.border}`,
                  borderRadius: "6px", padding: "6px 12px", fontSize: "12px",
                  fontFamily: G.fontDisplay, fontWeight: 600, cursor: "pointer",
                }}
              >
                {fw.icon} {fw.shortName} ({fw.controls.length})
              </button>
            ))}
          </div>

          {/* Status filters & Search */}
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: "4px", background: G.surface, padding: "3px", borderRadius: "8px", border: `1px solid ${G.border}` }}>
              <button
                onClick={() => setStatusFilter("all")}
                style={{
                  background: statusFilter === "all" ? G.card : "transparent",
                  color: statusFilter === "all" ? G.text : G.muted,
                  border: "none", borderRadius: "6px", padding: "5px 10px", fontSize: "11px",
                  fontFamily: G.fontDisplay, cursor: "pointer", fontWeight: 600,
                }}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter("failing")}
                style={{
                  background: statusFilter === "failing" ? `${G.red}22` : "transparent",
                  color: statusFilter === "failing" ? G.red : G.muted,
                  border: "none", borderRadius: "6px", padding: "5px 10px", fontSize: "11px",
                  fontFamily: G.fontDisplay, cursor: "pointer", fontWeight: 600,
                }}
              >
                ❌ Failing ({totalFailingAll})
              </button>
              <button
                onClick={() => setStatusFilter("passing")}
                style={{
                  background: statusFilter === "passing" ? `${G.green}22` : "transparent",
                  color: statusFilter === "passing" ? G.green : G.muted,
                  border: "none", borderRadius: "6px", padding: "5px 10px", fontSize: "11px",
                  fontFamily: G.fontDisplay, cursor: "pointer", fontWeight: 600,
                }}
              >
                ✅ Passing ({totalPassingAll})
              </button>
            </div>

            <input
              type="text"
              placeholder="🔍 Search controls..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                background: G.surface, border: `1px solid ${G.border}`, borderRadius: "8px",
                padding: "6px 12px", color: G.text, fontSize: "12px", fontFamily: G.fontDisplay,
                outline: "none", width: "180px",
              }}
            />
          </div>
        </div>

        {/* Frameworks & Controls List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
          {displayedFrameworks.map(fw => {
            const filteredControls = fw.controls.filter(ctrl => {
              if (statusFilter === "failing" && ctrl.status !== "FAIL") return false;
              if (statusFilter === "passing" && ctrl.status !== "PASS") return false;
              if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const match = ctrl.id.toLowerCase().includes(q)
                  || ctrl.name.toLowerCase().includes(q)
                  || ctrl.family.toLowerCase().includes(q)
                  || ctrl.description.toLowerCase().includes(q);
                if (!match) return false;
              }
              return true;
            });

            return (
              <div key={fw.key} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* Framework Group Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "18px" }}>{fw.icon}</span>
                    <span style={{ fontSize: "15px", fontWeight: 700, color: G.text }}>{fw.name}</span>
                    <span style={{
                      fontSize: "10px", background: `${fw.color}18`, color: fw.color,
                      border: `1px solid ${fw.color}33`, padding: "2px 6px", borderRadius: "4px",
                      fontFamily: G.font,
                    }}>
                      {fw.version || fw.key}
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", color: G.muted }}>
                    {fw.hasData ? `${fw.passing}/${fw.total} passing` : "Not evaluated"}
                  </div>
                </div>

                {filteredControls.length === 0 ? (
                  <div style={{
                    color: G.muted, fontSize: "13px", padding: "16px",
                    background: G.surface, borderRadius: "8px", textAlign: "center",
                  }}>
                    No controls match your current filter settings for this framework.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {filteredControls.map(ctrl => {
                      const isFail = ctrl.status === "FAIL";
                      const isExpanded = expandedControls[ctrl.id] !== undefined
                        ? expandedControls[ctrl.id]
                        : isFail; // Default to open for failing controls

                      return (
                        <div
                          key={ctrl.id}
                          style={{
                            background: G.surface,
                            border: `1px solid ${isFail ? `${G.red}44` : G.border}`,
                            borderRadius: "10px",
                            padding: "14px 16px",
                            transition: "border-color 0.15s",
                          }}
                        >
                          {/* Row Header */}
                          <div style={{
                            display: "flex", justifyContent: "space-between",
                            alignItems: "flex-start", gap: "12px",
                          }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                                <span style={{
                                  background: isFail ? `${G.red}22` : `${G.green}18`,
                                  color: isFail ? G.red : G.green,
                                  fontFamily: G.font, fontSize: "11px", fontWeight: 700,
                                  padding: "2px 8px", borderRadius: "4px",
                                  border: `1px solid ${isFail ? `${G.red}44` : `${G.green}33`}`,
                                }}>
                                  {ctrl.id}
                                </span>
                                <span style={{ fontSize: "14px", fontWeight: 600, color: G.text }}>
                                  {ctrl.name}
                                </span>
                                <span style={{
                                  fontSize: "11px", color: G.muted, background: G.card,
                                  padding: "1px 6px", borderRadius: "4px", border: `1px solid ${G.border}`,
                                }}>
                                  {ctrl.family}
                                </span>
                              </div>
                              <p style={{ fontSize: "12px", color: G.muted, lineHeight: 1.4 }}>
                                {ctrl.description}
                              </p>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <span style={{
                                background: isFail ? `${G.red}18` : (!fw.hasData ? `${G.muted}18` : `${G.green}18`),
                                color: isFail ? G.red : (!fw.hasData ? G.muted : G.green),
                                border: `1px solid ${isFail ? `${G.red}44` : (!fw.hasData ? `${G.muted}44` : `${G.green}33`)}`,
                                borderRadius: "6px", padding: "4px 10px", fontSize: "11px",
                                fontWeight: 700, fontFamily: G.font, letterSpacing: "0.5px",
                              }}>
                                {isFail ? `FAIL (${ctrl.violations.length})` : (!fw.hasData ? "NOT EVALUATED" : "PASS")}
                              </span>

                              {isFail && (
                                <button
                                  onClick={() => toggleControl(ctrl.id)}
                                  className="btn-ghost"
                                  style={{ padding: "4px 8px", fontSize: "11px" }}
                                  title="Toggle remediation and violating findings"
                                >
                                  {isExpanded ? "▲ Hide" : "▼ Details"}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Violating Findings & Remediation (Expanded) */}
                          {isFail && isExpanded && (
                            <div style={{
                              marginTop: "12px", paddingTop: "12px",
                              borderTop: `1px solid ${G.border}`, display: "flex",
                              flexDirection: "column", gap: "10px",
                            }}>
                              {/* Violations List */}
                              <div>
                                <div style={{ fontSize: "11px", fontWeight: 700, color: G.red, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>
                                  Violating Findings ({ctrl.violations.length})
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                  {ctrl.violations.map((v, idx) => (
                                    <div key={idx} style={{
                                      background: G.card, border: `1px solid ${G.border}`,
                                      borderRadius: "6px", padding: "8px 12px", fontSize: "12px",
                                    }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                                        <span style={{
                                          fontSize: "10px", fontWeight: 700, fontFamily: G.font,
                                          padding: "1px 6px", borderRadius: "3px",
                                          background: v.severity === "CRITICAL" ? `${G.critical}22` : `${G.red}22`,
                                          color: v.severity === "CRITICAL" ? G.critical : G.red,
                                        }}>
                                          {v.severity || "HIGH"}
                                        </span>
                                        <span style={{ fontWeight: 600, color: G.text }}>{v.issue}</span>
                                        {v.filename && (
                                          <span style={{ fontSize: "11px", color: G.muted, marginLeft: "auto", fontFamily: G.font }}>
                                            {v.filename}
                                          </span>
                                        )}
                                      </div>
                                      {v.detail && (
                                        <div style={{ fontSize: "11px", color: G.muted, marginTop: "2px" }}>
                                          {v.detail}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Actionable Remediation Guidance */}
                              <div style={{
                                background: `${G.accent}0a`, border: `1px solid ${G.accent}33`,
                                borderRadius: "8px", padding: "10px 14px",
                              }}>
                                <div style={{ fontSize: "11px", fontWeight: 700, color: G.accent, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
                                  🛠 Prescriptive Remediation
                                </div>
                                <div style={{ fontSize: "12px", color: G.text, lineHeight: 1.4 }}>
                                  {ctrl.remediation}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

