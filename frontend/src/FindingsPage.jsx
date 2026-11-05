import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "./apiConfig";

/* ============================================================
   DESIGN TOKENS
============================================================ */
const G = {
    bg: "#0a0e1a",
    surface: "#111827",
    card: "#161d2e",
    border: "#1e2d45",
    accent: "#00d4ff",
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

const SEV_CONFIG = {
    CRITICAL: { color: G.critical, bg: "#dc262614", icon: "🔴" },
    HIGH: { color: G.red, bg: "#ef444414", icon: "🟠" },
    MEDIUM: { color: G.yellow, bg: "#f59e0b14", icon: "🟡" },
    LOW: { color: "#3b82f6", bg: "#3b82f614", icon: "🔵" },
};

/* ============================================================
   MARKDOWN → REACT PARSER
   Handles: **bold**, `code`, numbered sections, bullet lists.
============================================================ */
function parseMarkdown(raw) {
    if (!raw) return null;

    // Strip markdown links -> keep text only; remove bare URLs
    const cleaned = raw
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/\(https?:\/\/[^\s)]+\)/g, "")
        .replace(/https?:\/\/\S+/g, "");

    const lines = cleaned.split("\n");
    const nodes = [];
    let i = 0;

    // Inline formatting: **bold** and `code`
    const inline = (str, key) => {
        const parts = [];
        const re = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
        let last = 0, m;
        while ((m = re.exec(str)) !== null) {
            if (m.index > last) parts.push(str.slice(last, m.index));
            if (m[2]) parts.push(<strong key={`b${m.index}`}>{m[2]}</strong>);
            else if (m[3]) parts.push(<code key={`c${m.index}`}>{m[3]}</code>);
            last = m.index + m[0].length;
        }
        if (last < str.length) parts.push(str.slice(last));
        return <span key={key}>{parts.length ? parts : str}</span>;
    };

    while (i < lines.length) {
        const line = lines[i].trim();
        if (!line) { i++; continue; }

        // Numbered heading: "1. **Title**" or "1. **Title**: rest..."
        const numMatch = line.match(/^(\d+)\.\s+\*\*([^*]+)\*\*:?\s*(.*)?$/);
        if (numMatch) {
            const [, num, title, rest] = numMatch;
            nodes.push(
                <div key={`h${i}`} style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginTop: "14px", marginBottom: "4px" }}>
                    <div style={{
                        minWidth: 24, height: 24, borderRadius: "50%",
                        background: `${G.purple}25`, border: `1px solid ${G.purple}55`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "11px", fontWeight: 700, color: G.purple, flexShrink: 0, marginTop: "2px",
                    }}>{num}</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: "14px", color: G.text, marginBottom: rest ? "4px" : 0 }}>
                            {title.replace(/:$/, "")}
                        </div>
                        {rest && (
                            <div className="ai-body" style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: 1.65 }}>
                                {inline(rest, `r${i}`)}
                            </div>
                        )}
                    </div>
                </div>
            );
            i++; continue;
        }

        // Bullet list
        if (/^[*\-]\s/.test(line)) {
            const items = [];
            while (i < lines.length && /^[*\-]\s/.test(lines[i].trim())) {
                items.push(lines[i].trim().replace(/^[*\-]\s+/, ""));
                i++;
            }
            nodes.push(
                <ul className="ai-body" key={`ul${i}`} style={{ margin: "6px 0 6px 36px", padding: 0 }}>
                    {items.map((item, bi) => (
                        <li key={bi}>{inline(item, `li${bi}`)}</li>
                    ))}
                </ul>
            );
            continue;
        }

        // Plain paragraph line
        nodes.push(
            <div className="ai-body" key={`p${i}`} style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: 1.7, marginBottom: "2px" }}>
                {inline(line, `pl${i}`)}
            </div>
        );
        i++;
    }

    return nodes;
}

/* ============================================================
   AI SUMMARY PANEL
============================================================ */
function AISummaryPanel({ markdown, onClose }) {
    const riskMatch = (markdown || "").match(/executive risk level[:\s*]+(critical|high|medium|low)/i);
    const riskLevel = riskMatch ? riskMatch[1].toUpperCase() : null;
    const riskColor = { CRITICAL: G.critical, HIGH: G.red, MEDIUM: G.yellow, LOW: G.green }[riskLevel] || G.purple;

    return (
        <div style={{
            background: "linear-gradient(160deg, #0f172a 0%, #12111f 100%)",
            border: `1px solid ${G.purple}44`,
            borderRadius: "14px",
            marginBottom: "20px",
            animation: "fadeUp 0.4s ease",
            overflow: "hidden",
            boxShadow: `0 0 40px rgba(139,92,246,0.07), 0 4px 24px rgba(0,0,0,0.3)`,
        }}>
            {/* Header */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 20px",
                borderBottom: `1px solid ${G.purple}25`,
                background: `${G.purple}08`,
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                        width: 30, height: 30, borderRadius: "8px",
                        background: `${G.purple}20`, border: `1px solid ${G.purple}40`,
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px",
                    }}>✨</div>
                    <div>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: G.text, lineHeight: 1 }}>AI Executive Summary</div>
                        <div style={{ fontSize: "10px", color: G.muted, fontFamily: G.font, marginTop: "3px" }}>Cloud Architecture Review</div>
                    </div>
                    {riskLevel && (
                        <span style={{
                            background: `${riskColor}18`, color: riskColor,
                            border: `1px solid ${riskColor}44`,
                            borderRadius: "5px", padding: "3px 10px",
                            fontSize: "11px", fontWeight: 700, fontFamily: G.font, letterSpacing: "0.5px",
                        }}>
                            {riskLevel} RISK
                        </span>
                    )}
                </div>
                <button
                    onClick={onClose}
                    style={{ background: "none", border: "none", color: G.muted, cursor: "pointer", fontSize: "18px", lineHeight: 1, padding: "4px 8px", borderRadius: "5px" }}
                    onMouseEnter={e => e.currentTarget.style.color = G.text}
                    onMouseLeave={e => e.currentTarget.style.color = G.muted}
                >✕</button>
            </div>

            {/* Body */}
            <div style={{ padding: "16px 22px 22px" }}>
                {parseMarkdown(markdown)}
            </div>
        </div>
    );
}

/* ============================================================
   EXPORT HELPERS
============================================================ */
function exportCSV(findings, filename = "findings.csv") {
    const headers = ["Severity", "Category", "Issue", "Detail", "Remediation", "NIST Reference"];
    const rows = findings.map(f =>
        [f.severity, f.category, f.issue, f.detail, f.remediation, f.nist_reference]
            .map(v => `"${(v || "").replace(/"/g, '""')}"`)
            .join(",")
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: filename });
    a.click(); URL.revokeObjectURL(a.href);
}

function exportPDF(findings, uploadId) {
    const sevColor = s => ({ CRITICAL: "#dc2626", HIGH: "#ef4444", MEDIUM: "#f59e0b", LOW: "#3b82f6" }[s?.toUpperCase()] || "#6b7280");
    const rows = findings.map(f => `
    <tr>
      <td><span style="background:${sevColor(f.severity)};color:white;padding:3px 9px;border-radius:4px;font-size:11px;font-weight:700">${f.severity?.toUpperCase() || ""}</span></td>
      <td style="color:#6b7280;font-size:12px">${f.category || ""}</td>
      <td style="font-weight:600">${f.issue || ""}</td>
      <td style="font-size:12px;color:#374151">${f.detail || ""}</td>
      <td style="font-size:11px;color:#374151">${f.remediation || ""}</td>
      <td style="font-size:11px;color:#6b7280">${f.nist_reference || ""}</td>
    </tr>`).join("");

    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    findings.forEach(f => { if (counts[f.severity?.toUpperCase()] !== undefined) counts[f.severity.toUpperCase()]++; });

    const html = `<!DOCTYPE html><html><head><title>Security Report - Upload #${uploadId}</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:1200px;margin:0 auto;padding:40px;color:#111;font-size:13px}
    h1{font-size:22px;color:#0f172a;margin-bottom:4px}
    .meta{color:#6b7280;font-size:12px;margin-bottom:20px}
    .stats{display:flex;gap:20px;margin-bottom:28px}
    .stat{text-align:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 22px}
    .stat .n{font-size:26px;font-weight:700}
    .stat .l{font-size:11px;color:#6b7280;margin-top:2px}
    table{width:100%;border-collapse:collapse}
    th{background:#0f172a;color:white;padding:10px 10px;text-align:left;font-size:11px;letter-spacing:0.5px}
    td{padding:10px;border-bottom:1px solid #f1f5f9;vertical-align:top}
    tr:nth-child(even) td{background:#fafafa}
  </style></head><body>
  <h1>🛡 Cloud Security Findings Report</h1>
  <p class="meta">Upload #${uploadId} &nbsp;|&nbsp; Generated: ${new Date().toLocaleString()} &nbsp;|&nbsp; ${findings.length} total findings</p>
  <div class="stats">
    <div class="stat"><div class="n" style="color:#dc2626">${counts.CRITICAL}</div><div class="l">CRITICAL</div></div>
    <div class="stat"><div class="n" style="color:#ef4444">${counts.HIGH}</div><div class="l">HIGH</div></div>
    <div class="stat"><div class="n" style="color:#f59e0b">${counts.MEDIUM}</div><div class="l">MEDIUM</div></div>
    <div class="stat"><div class="n" style="color:#3b82f6">${counts.LOW}</div><div class="l">LOW</div></div>
  </div>
  <table><thead><tr><th>Severity</th><th>Category</th><th>Issue</th><th>Detail</th><th>Remediation</th><th>NIST Ref</th></tr></thead>
  <tbody>${rows}</tbody></table></body></html>`;

    const w = window.open("", "_blank");
    w.document.write(html); w.document.close();
    setTimeout(() => w.print(), 400);
}

/* ============================================================
   FINDING CARD
============================================================ */
function FindingCard({ f, idx }) {
    const [expanded, setExpanded] = useState(false);
    const sev = f.severity?.toUpperCase() || "LOW";
    const cfg = SEV_CONFIG[sev] || SEV_CONFIG.LOW;

    return (
        <div
            onClick={() => setExpanded(v => !v)}
            style={{
                background: G.card, border: `1px solid ${expanded ? G.accent + "44" : G.border}`,
                borderRadius: "12px", overflow: "hidden",
                transition: "border-color 0.2s, box-shadow 0.2s",
                boxShadow: expanded ? `0 4px 24px rgba(0,212,255,0.06)` : "none",
                cursor: "pointer",
                animation: `fadeUp 0.35s ease ${idx * 40}ms both`,
            }}
        >
            {/* Header row */}
            <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px" }}>
                <span style={{
                    background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}44`,
                    borderRadius: "6px", padding: "4px 10px", fontSize: "11px", fontWeight: 700,
                    fontFamily: G.font, letterSpacing: "0.5px", minWidth: "78px", textAlign: "center",
                    whiteSpace: "nowrap",
                }}>
                    {cfg.icon} {sev}
                </span>

                {f.category && (
                    <span style={{
                        background: `${G.purple}18`, color: G.purple, border: `1px solid ${G.purple}30`,
                        borderRadius: "5px", padding: "3px 8px", fontSize: "10px", fontFamily: G.font,
                        whiteSpace: "nowrap",
                    }}>
                        {f.category}
                    </span>
                )}

                <span style={{ flex: 1, fontWeight: 600, fontSize: "14px", color: G.text }}>{f.issue}</span>

                {f.nist_reference && (
                    <span style={{ fontSize: "10px", color: G.muted, fontFamily: G.font, textAlign: "right", maxWidth: "180px", lineHeight: 1.4 }}>
                        {f.nist_reference.split(",")[0].trim()}
                    </span>
                )}

                <span style={{ color: G.muted, fontSize: "12px", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
            </div>

            {/* Expanded detail */}
            {expanded && (
                <div style={{ borderTop: `1px solid ${G.border}`, padding: "16px 18px", display: "flex", flexDirection: "column", gap: "14px" }}>
                    {f.detail && (
                        <div>
                            <div style={{ fontSize: "11px", color: G.muted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px", fontFamily: G.font }}>Detail</div>
                            <div style={{ fontSize: "13px", color: G.text, lineHeight: 1.6, fontFamily: G.font }}>{f.detail}</div>
                        </div>
                    )}
                    {f.remediation && (
                        <div style={{ background: `${G.green}08`, border: `1px solid ${G.green}25`, borderRadius: "8px", padding: "12px 14px" }}>
                            <div style={{ fontSize: "11px", color: G.green, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px", fontFamily: G.font }}>✅ Remediation</div>
                            <div style={{ fontSize: "13px", color: G.text, lineHeight: 1.6, fontFamily: G.font }}>{f.remediation}</div>
                        </div>
                    )}
                    {f.nist_reference && (
                        <div>
                            <div style={{ fontSize: "11px", color: G.muted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px", fontFamily: G.font }}>NIST 800-53 Controls</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                {f.nist_reference.split(",").map((ref, i) => (
                                    <span key={i} style={{
                                        background: `${G.accent}10`, color: G.accent, border: `1px solid ${G.accent}22`,
                                        borderRadius: "5px", padding: "3px 8px", fontSize: "11px", fontFamily: G.font,
                                    }}>{ref.trim()}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ============================================================
   FINDINGS PAGE
============================================================ */
const FindingsPage = () => {
    const { uploadId } = useParams();
    const navigate = useNavigate();

    const [findings, setFindings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [aiSummary, setAiSummary] = useState("");
    const [aiLoading, setAiLoading] = useState(false);

    // Filters
    const [search, setSearch] = useState("");
    const [severityFilter, setSeverityFilter] = useState("ALL");
    const [categoryFilter, setCategoryFilter] = useState("ALL");
    const [sortBy, setSortBy] = useState("severity");

    useEffect(() => {
        const fetchFindings = async () => {
            try {
                const token = localStorage.getItem("token");
                const res = await fetch(`${API_BASE_URL}/findings/${uploadId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                setFindings(Array.isArray(data) ? data : []);
            } catch (e) {
                console.error("Failed to fetch findings", e);
            } finally {
                setLoading(false);
            }
        };
        fetchFindings();
    }, [uploadId]);

    const generateAIReport = async () => {
        setAiLoading(true);
        setAiSummary("");
        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/findings/${uploadId}/ai-summary`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "Failed to generate AI report");
            setAiSummary(typeof data.summary === "string" ? data.summary : JSON.stringify(data.summary));
        } catch (e) {
            alert(e.message || "Failed to generate AI report.");
        } finally {
            setAiLoading(false);
        }
    };

    // Severity sort order
    const sevOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const categories = ["ALL", ...Array.from(new Set(findings.map(f => f.category).filter(Boolean)))];

    const filtered = findings
        .filter(f => {
            const sev = f.severity?.toUpperCase();
            if (severityFilter !== "ALL" && sev !== severityFilter) return false;
            if (categoryFilter !== "ALL" && f.category !== categoryFilter) return false;
            if (search) {
                const q = search.toLowerCase();
                return (f.issue || "").toLowerCase().includes(q) ||
                    (f.detail || "").toLowerCase().includes(q) ||
                    (f.nist_reference || "").toLowerCase().includes(q) ||
                    (f.category || "").toLowerCase().includes(q);
            }
            return true;
        })
        .sort((a, b) => {
            if (sortBy === "severity") return (sevOrder[a.severity?.toUpperCase()] ?? 9) - (sevOrder[b.severity?.toUpperCase()] ?? 9);
            if (sortBy === "category") return (a.category || "").localeCompare(b.category || "");
            return 0;
        });

    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    findings.forEach(f => { const k = f.severity?.toUpperCase(); if (counts[k] !== undefined) counts[k]++; });

    if (loading) return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: G.bg }}>
            <div style={{ textAlign: "center" }}>
                <div style={{ width: 32, height: 32, border: `2px solid ${G.border}`, borderTopColor: G.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                <div style={{ color: G.muted, fontFamily: G.fontDisplay, fontSize: "14px" }}>Loading findings...</div>
            </div>
        </div>
    );

    return (
        <div style={{ minHeight: "100vh", background: G.bg, fontFamily: G.fontDisplay }}>
            {/* Top bar */}
            <div style={{ background: G.surface, borderBottom: `1px solid ${G.border}`, padding: "14px 32px", display: "flex", alignItems: "center", gap: "16px", position: "sticky", top: 0, zIndex: 50 }}>
                <button onClick={() => navigate(-1)} className="btn-ghost" style={{ padding: "7px 12px" }}>← Back</button>

                <div style={{ flex: 1 }}>
                    <span style={{ color: G.muted, fontSize: "12px", fontFamily: G.font }}>SCAN #{uploadId}</span>
                    <span style={{ color: G.text, fontSize: "14px", fontWeight: 600, marginLeft: "12px" }}>
                        {findings.length} finding{findings.length !== 1 ? "s" : ""} detected
                    </span>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                    <button className="btn-ghost" onClick={() => exportCSV(findings, `scan-${uploadId}-findings.csv`)}>⬇ CSV</button>
                    <button className="btn-ghost" onClick={() => exportPDF(findings, uploadId)}>⬇ PDF</button>
                    <button className="btn-primary" onClick={generateAIReport} disabled={aiLoading}>
                        {aiLoading ? (
                            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ width: 12, height: 12, border: "1.5px solid #000", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                                Analyzing...
                            </span>
                        ) : "✨ AI Report"}
                    </button>
                </div>
            </div>

            <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "28px 24px" }}>
                {/* Severity summary pills */}
                <div style={{ display: "flex", gap: "10px", marginBottom: "24px", flexWrap: "wrap" }}>
                    {[["ALL", G.accent, `All (${findings.length})`], ["CRITICAL", G.critical, `🔴 Critical (${counts.CRITICAL})`], ["HIGH", G.red, `🟠 High (${counts.HIGH})`], ["MEDIUM", G.yellow, `🟡 Medium (${counts.MEDIUM})`], ["LOW", "#3b82f6", `🔵 Low (${counts.LOW})`]].map(([key, color, label]) => (
                        <button key={key} className={`filter-btn ${severityFilter === key ? "active" : ""}`}
                            onClick={() => setSeverityFilter(key)}
                            style={{ borderColor: severityFilter === key ? color : undefined, color: severityFilter === key ? color : undefined, background: severityFilter === key ? `${color}10` : undefined }}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {/* Search + Sort + Category */}
                <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
                    <input
                        placeholder="🔍  Search issues, details, NIST controls..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            flex: 1, minWidth: "240px", background: G.card, border: `1px solid ${G.border}`, borderRadius: "8px",
                            padding: "9px 14px", color: G.text, fontFamily: G.fontDisplay, fontSize: "13px", outline: "none",
                            transition: "border-color 0.2s",
                        }}
                    />
                    <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                        {categories.map(c => <option key={c} value={c}>{c === "ALL" ? "All Categories" : c}</option>)}
                    </select>
                    <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
                        <option value="severity">Sort: Severity</option>
                        <option value="category">Sort: Category</option>
                    </select>
                </div>

                {/* Render AISummaryPanel instead of raw pre */}
                {aiSummary && (
                    <AISummaryPanel markdown={aiSummary} onClose={() => setAiSummary("")} />
                )}

                {/* Results count */}
                {(search || severityFilter !== "ALL" || categoryFilter !== "ALL") && (
                    <div style={{ fontSize: "12px", color: G.muted, marginBottom: "12px", fontFamily: G.font }}>
                        Showing {filtered.length} of {findings.length} findings
                        <button onClick={() => { setSearch(""); setSeverityFilter("ALL"); setCategoryFilter("ALL"); }}
                            style={{ marginLeft: "10px", background: "none", border: "none", color: G.accent, cursor: "pointer", fontSize: "12px" }}>
                            ✕ Clear filters
                        </button>
                    </div>
                )}

                {/* Findings list */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {filtered.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "48px", color: G.muted, fontSize: "14px" }}>
                            {findings.length === 0 ? "✅ No security issues found in this scan." : "No findings match your current filters."}
                        </div>
                    ) : (
                        filtered.map((f, idx) => <FindingCard key={f.id} f={f} idx={idx} />)
                    )}
                </div>
            </div>
        </div>
    );
};

export default FindingsPage;
