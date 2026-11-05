import { useState, useEffect, useCallback } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import LoginPage from "./LoginPage";
import FindingsPage from "./FindingsPage";
import CompliancePanel from "./CompliancePanel";
import { API_BASE_URL } from "./apiConfig";

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

const injectGlobalStyles = () => {
  if (document.getElementById("csa-global-styles")) return;
  const style = document.createElement("style");
  style.id = "csa-global-styles";
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${G.bg}; color: ${G.text}; font-family: ${G.fontDisplay}; min-height: 100vh; }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: ${G.bg}; }
    ::-webkit-scrollbar-thumb { background: ${G.border}; border-radius: 3px; }
    
    @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(0,212,255,0.3); } 70% { box-shadow: 0 0 0 10px rgba(0,212,255,0); } 100% { box-shadow: 0 0 0 0 rgba(0,212,255,0); } }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    @keyframes scan-line { 0% { top: 0; } 100% { top: 100%; } }
    @keyframes count-up { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
    
    .fade-up { animation: fadeUp 0.4s ease forwards; }
    .card-hover { transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s; }
    .card-hover:hover { border-color: ${G.accent}44 !important; transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,212,255,0.08); }
    
    input[type="file"]::file-selector-button {
      background: ${G.accent}22;
      color: ${G.accent};
      border: 1px solid ${G.accent}44;
      border-radius: 6px;
      padding: 6px 14px;
      font-family: ${G.fontDisplay};
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s;
    }
    input[type="file"]::file-selector-button:hover { background: ${G.accent}33; }
    input[type="file"] { color: ${G.muted}; font-size: 13px; }
    
    .btn-primary {
      background: linear-gradient(135deg, ${G.accent}, ${G.accentDim});
      color: #000;
      border: none;
      border-radius: 8px;
      padding: 10px 20px;
      font-family: ${G.fontDisplay};
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.15s;
    }
    .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
    .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
    
    .btn-ghost {
      background: transparent;
      color: ${G.muted};
      border: 1px solid ${G.border};
      border-radius: 8px;
      padding: 8px 16px;
      font-family: ${G.fontDisplay};
      font-size: 13px;
      cursor: pointer;
      transition: color 0.2s, border-color 0.2s;
    }
    .btn-ghost:hover { color: ${G.text}; border-color: ${G.muted}; }

    .btn-danger {
      background: transparent;
      color: ${G.red};
      border: 1px solid ${G.red}44;
      border-radius: 6px;
      padding: 6px 12px;
      font-family: ${G.fontDisplay};
      font-size: 12px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-danger:hover { background: ${G.red}18; }

    .tab { background: transparent; border: none; padding: 10px 20px; font-family: ${G.fontDisplay}; font-size: 14px; font-weight: 500; cursor: pointer; color: ${G.muted}; border-bottom: 2px solid transparent; transition: color 0.2s, border-color 0.2s; }
    .tab.active { color: ${G.accent}; border-bottom-color: ${G.accent}; }

    .score-ring { transition: stroke-dashoffset 1s ease; }
  `;
  document.head.appendChild(style);
};

/* ============================================================
   SIDEBAR NAV
============================================================ */
function Sidebar({ activeTab, setActiveTab, handleLogout }) {
  const navItems = [
    { id: "dashboard", icon: "⬡", label: "Dashboard" },
    { id: "scan", icon: "⟳", label: "Scan Files" },
    { id: "history", icon: "◷", label: "History" },
    { id: "compliance", icon: "⬜", label: "Compliance" },
  ];

  return (
    <aside style={{
      width: "220px", minHeight: "100vh", background: G.surface,
      borderRight: `1px solid ${G.border}`, display: "flex",
      flexDirection: "column", padding: "24px 0", position: "fixed",
      left: 0, top: 0, bottom: 0, zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: "0 24px 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: 36, height: 36, borderRadius: "10px",
            background: `linear-gradient(135deg, ${G.accent}22, ${G.purple}22)`,
            border: `1px solid ${G.accent}44`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "16px",
          }}>🛡</div>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: G.text, letterSpacing: "0.5px" }}>CloudSecure</div>
            <div style={{ fontSize: "10px", color: G.accent, letterSpacing: "2px", fontFamily: G.font }}>ADVISOR</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px", padding: "0 12px" }}>
        {navItems.map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} style={{
            display: "flex", alignItems: "center", gap: "12px",
            padding: "10px 12px", borderRadius: "8px", border: "none",
            background: activeTab === item.id ? `${G.accent}14` : "transparent",
            color: activeTab === item.id ? G.accent : G.muted,
            fontFamily: G.fontDisplay, fontSize: "14px", fontWeight: activeTab === item.id ? 600 : 400,
            cursor: "pointer", transition: "all 0.15s", textAlign: "left", width: "100%",
            borderLeft: activeTab === item.id ? `2px solid ${G.accent}` : "2px solid transparent",
          }}>
            <span style={{ fontSize: "16px" }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Logout */}
      <div style={{ padding: "12px" }}>
        <button onClick={handleLogout} style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "10px 12px", borderRadius: "8px", border: "none",
          background: "transparent", color: G.muted, fontFamily: G.fontDisplay,
          fontSize: "14px", cursor: "pointer", transition: "color 0.15s", width: "100%",
        }}
          onMouseEnter={e => e.currentTarget.style.color = G.red}
          onMouseLeave={e => e.currentTarget.style.color = G.muted}
        >
          <span>↩</span> Sign Out
        </button>
      </div>
    </aside>
  );
}

/* ============================================================
   STAT CARD
============================================================ */
function StatCard({ label, value, sub, color, icon, delay = 0 }) {
  return (
    <div className="card-hover fade-up" style={{
      background: G.card, border: `1px solid ${G.border}`, borderRadius: "14px",
      padding: "20px 24px", animationDelay: `${delay}ms`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: "11px", color: G.muted, letterSpacing: "1px", textTransform: "uppercase", fontFamily: G.font, marginBottom: "8px" }}>{label}</div>
          <div style={{ fontSize: "32px", fontWeight: 700, color: color || G.text, lineHeight: 1, fontFamily: G.font }}>{value}</div>
          {sub && <div style={{ fontSize: "12px", color: G.muted, marginTop: "6px" }}>{sub}</div>}
        </div>
        <div style={{ fontSize: "24px", opacity: 0.6 }}>{icon}</div>
      </div>
    </div>
  );
}

/* ============================================================
   MINI BAR CHART (SVG)
============================================================ */
function BarChart({ data, colors }) {
  const max = Math.max(...data.map(d => d.value), 1);
  const W = 360, H = 120, barW = Math.floor((W - (data.length - 1) * 8) / data.length);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 30}`} style={{ overflow: "visible" }}>
      {data.map((d, i) => {
        const bh = Math.max((d.value / max) * H, 2);
        const x = i * (barW + 8);
        const y = H - bh;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bh} rx={4}
              fill={colors[i % colors.length]} opacity={0.85} />
            {d.value > 0 && (
              <text x={x + barW / 2} y={y - 5} textAnchor="middle"
                fill={colors[i % colors.length]} fontSize="11" fontFamily={G.font}>{d.value}</text>
            )}
            <text x={x + barW / 2} y={H + 18} textAnchor="middle"
              fill={G.muted} fontSize="10" fontFamily={G.fontDisplay}>{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ============================================================
   DONUT CHART (SVG)
============================================================ */
function DonutChart({ segments, size = 120 }) {
  const r = 44, cx = size / 2, cy = size / 2;
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  let offset = 0;
  const circumference = 2 * Math.PI * r;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={G.border} strokeWidth="14" />
      {segments.map((seg, i) => {
        const dash = (seg.value / total) * circumference;
        const gap = circumference - dash;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={seg.color} strokeWidth="14"
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset * circumference / total}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: "stroke-dasharray 0.8s ease" }}
          />
        );
        offset += seg.value;
        return el;
      })}
      <text x={cx} y={cy - 6} textAnchor="middle" fill={G.text} fontSize="18" fontWeight="700" fontFamily={G.font}>{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill={G.muted} fontSize="9" fontFamily={G.fontDisplay}>ISSUES</text>
    </svg>
  );
}

/* ============================================================
   SCORE GAUGE
============================================================ */
function ScoreGauge({ score }) {
  const color = score >= 80 ? G.green : score >= 50 ? G.yellow : G.red;
  const r = 52, cx = 70, cy = 70;
  const circumference = Math.PI * r;
  const dash = (score / 100) * circumference;

  return (
    <svg width="140" height="90" viewBox="0 0 140 90">
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={G.border} strokeWidth="14" strokeLinecap="round" />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
        style={{ transition: "stroke-dasharray 1s ease, stroke 0.5s" }}
      />
      <text x={cx} y={cy - 8} textAnchor="middle" fill={color} fontSize="26" fontWeight="700" fontFamily={G.font}>{score}</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fill={G.muted} fontSize="10" fontFamily={G.fontDisplay}>SECURITY SCORE</text>
    </svg>
  );
}

/* ============================================================
   EXPORT HELPERS
============================================================ */
function exportCSV(findings, filename = "findings.csv") {
  const headers = ["Severity", "Category", "Issue", "Detail", "Remediation", "NIST Reference"];
  const rows = findings.map(f => [
    f.severity, f.category, f.issue, f.detail, f.remediation, f.nist_reference
  ].map(v => `"${(v || "").replace(/"/g, '""')}"`).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportPDF(findings, uploadInfo = "") {
  const sev = (s) => ({ CRITICAL: "#dc2626", HIGH: "#ef4444", MEDIUM: "#f59e0b", LOW: "#3b82f6" }[s?.toUpperCase()] || "#6b7280");
  const rows = findings.map(f => `
    <tr style="border-bottom:1px solid #e5e7eb">
      <td style="padding:10px 8px"><span style="background:${sev(f.severity)};color:white;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700">${f.severity?.toUpperCase() || ""}</span></td>
      <td style="padding:10px 8px;font-size:13px;color:#111">${f.issue || ""}</td>
      <td style="padding:10px 8px;font-size:12px;color:#374151">${f.detail || ""}</td>
      <td style="padding:10px 8px;font-size:11px;color:#6b7280">${f.nist_reference || ""}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html><html><head><title>Security Findings Report</title>
  <style>body{font-family:system-ui,sans-serif;max-width:1100px;margin:0 auto;padding:40px;color:#111}
  h1{color:#0f172a;font-size:24px;margin-bottom:4px} table{width:100%;border-collapse:collapse}
  th{background:#0f172a;color:white;padding:10px 8px;text-align:left;font-size:12px;font-weight:600}
  tr:nth-child(even){background:#f9fafb} .meta{color:#6b7280;font-size:13px;margin-bottom:24px}</style>
  </head><body>
  <h1>🛡 Cloud Security Findings Report</h1>
  <p class="meta">Generated: ${new Date().toLocaleString()} ${uploadInfo ? "| " + uploadInfo : ""}</p>
  <table><thead><tr><th>Severity</th><th>Issue</th><th>Detail</th><th>NIST Ref</th></tr></thead>
  <tbody>${rows}</tbody></table></body></html>`;

  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  setTimeout(() => { w.print(); }, 400);
}

/* ============================================================
   DASHBOARD TAB
============================================================ */
function DashboardTab({ allFindings, historyList }) {
  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  allFindings.forEach(f => {
    const k = f.severity?.toUpperCase();
    if (counts[k] !== undefined) counts[k]++;
  });

  const categories = {};
  allFindings.forEach(f => {
    const cat = f.category || "General";
    categories[cat] = (categories[cat] || 0) + 1;
  });

  const catData = Object.entries(categories).map(([label, value]) => ({ label, value }));
  const catColors = [G.accent, G.purple, G.green, G.yellow, G.red, "#f97316", "#06b6d4"];

  const avgScore = historyList.length > 0
    ? Math.round(historyList.reduce((s, r) => s + (r.score ?? 100), 0) / historyList.length)
    : 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Stat row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
        <StatCard label="Total Issues" value={allFindings.length} icon="⚠" color={G.text} delay={0} />
        <StatCard label="Critical" value={counts.CRITICAL} icon="🔴" color={G.critical} delay={60} />
        <StatCard label="High" value={counts.HIGH} icon="🟠" color={G.red} delay={120} />
        <StatCard label="Files Scanned" value={historyList.length} icon="📂" color={G.accent} delay={180} />
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
        {/* Severity donut */}
        <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: "14px", padding: "20px" }}>
          <div style={{ fontSize: "12px", color: G.muted, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "16px" }}>Severity Mix</div>
          <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
            <DonutChart segments={[
              { value: counts.CRITICAL, color: G.critical },
              { value: counts.HIGH, color: G.red },
              { value: counts.MEDIUM, color: G.yellow },
              { value: counts.LOW, color: G.accent },
            ]} size={110} />
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[["CRITICAL", G.critical], ["HIGH", G.red], ["MEDIUM", G.yellow], ["LOW", G.accent]].map(([s, c]) => (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
                  <span style={{ fontSize: "11px", color: G.muted, fontFamily: G.font }}>{s}</span>
                  <span style={{ fontSize: "11px", color: G.text, marginLeft: "auto", fontFamily: G.font }}>{counts[s]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Category bar */}
        <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: "14px", padding: "20px" }}>
          <div style={{ fontSize: "12px", color: G.muted, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "16px" }}>By Category</div>
          {catData.length > 0
            ? <BarChart data={catData} colors={catColors} />
            : <div style={{ color: G.muted, fontSize: "13px", paddingTop: "20px", textAlign: "center" }}>No data yet</div>
          }
        </div>

        {/* Score gauge */}
        <div style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: "14px", padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: "12px", color: G.muted, letterSpacing: "1px", textTransform: "uppercase", marginBottom: "8px" }}>Avg. Security Score</div>
          <ScoreGauge score={avgScore} />
          <div style={{ fontSize: "12px", color: G.muted, marginTop: "4px" }}>
            {avgScore >= 80 ? "✅ Good posture" : avgScore >= 50 ? "⚠ Needs attention" : "🔴 Critical risk"}
          </div>
        </div>
      </div>

      {allFindings.length === 0 && historyList.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px", color: G.muted, fontSize: "14px" }}>
          Upload and scan cloud config files to see your dashboard metrics
        </div>
      )}
    </div>
  );
}

/* ============================================================
   SCAN TAB (Supports JSON and YAML)
============================================================ */
function ScanTab({ onScanComplete }) {
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState(() => {
    const s = sessionStorage.getItem("batchResults");
    return s ? JSON.parse(s) : [];
  });
  const [summary, setSummary] = useState(() => {
    const s = sessionStorage.getItem("batchSummary");
    return s ? JSON.parse(s) : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const navigate = useNavigate();

  const handleUpload = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      Array.from(fileList).forEach(f => formData.append("files", f));

      const res = await fetch(`${API_BASE_URL}/upload/batch`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Server Error");

      const resList = data?.results || [];
      setResults(resList);
      const totalFindings = resList.reduce((s, r) => s + (r.findings_count || 0), 0);
      const newSummary = { totalFiles: resList.length, totalFindings };
      setSummary(newSummary);
      sessionStorage.setItem("batchResults", JSON.stringify(resList));
      sessionStorage.setItem("batchSummary", JSON.stringify(newSummary));

      if (onScanComplete) onScanComplete(resList);
      if (resList.length === 1) navigate(`/findings/${resList[0].upload_id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (s) => s >= 80 ? G.green : s >= 50 ? G.yellow : G.red;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
        style={{
          background: dragOver ? `${G.accent}08` : G.card,
          border: `2px dashed ${dragOver ? G.accent : G.border}`,
          borderRadius: "16px", padding: "40px", textAlign: "center",
          transition: "all 0.2s", cursor: "pointer",
        }}
      >
        <div style={{ fontSize: "36px", marginBottom: "12px" }}>☁</div>
        <div style={{ fontSize: "16px", fontWeight: 600, color: G.text, marginBottom: "6px" }}>
          Drop cloud config files here
        </div>
        <div style={{ fontSize: "13px", color: G.muted, marginBottom: "20px" }}>
          Supports AWS IAM policies, S3 bucket policies, Security Groups (.json, .yaml, .yml)
        </div>
        <label style={{ cursor: "pointer" }}>
          <input type="file" accept=".json,.yaml,.yml" multiple style={{ display: "none" }}
            onChange={e => { setFiles([...e.target.files]); handleUpload(e.target.files); }} />
          <span className="btn-primary" style={{ padding: "10px 24px", display: "inline-block" }}>
            {loading ? "⟳ Scanning..." : "Select Files"}
          </span>
        </label>
        {files.length > 0 && (
          <div style={{ marginTop: "10px", fontSize: "12px", color: G.accent, fontFamily: G.font }}>
            {files.map(f => f.name).join(", ")}
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: `${G.red}14`, border: `1px solid ${G.red}44`, borderRadius: "10px", padding: "12px 16px", color: G.red, fontSize: "14px" }}>
          ⚠ {error}
        </div>
      )}

      {summary && (
        <div style={{ background: `${G.accent}08`, border: `1px solid ${G.accent}22`, borderRadius: "12px", padding: "14px 20px", display: "flex", gap: "24px", alignItems: "center" }}>
          <div><span style={{ color: G.accent, fontWeight: 700, fontFamily: G.font, fontSize: "20px" }}>{summary.totalFiles}</span><span style={{ color: G.muted, fontSize: "13px" }}> files scanned</span></div>
          <div style={{ width: 1, height: 24, background: G.border }} />
          <div><span style={{ color: summary.totalFindings > 0 ? G.red : G.green, fontWeight: 700, fontFamily: G.font, fontSize: "20px" }}>{summary.totalFindings}</span><span style={{ color: G.muted, fontSize: "13px" }}> issues found</span></div>
        </div>
      )}

      {/* Results */}
      {results.map((r, i) => (
        <div key={i} className="card-hover fade-up" style={{
          background: G.card, border: `1px solid ${G.border}`, borderRadius: "12px",
          padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center",
          animationDelay: `${i * 60}ms`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ width: 42, height: 42, borderRadius: "10px", background: `${G.accent}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>📄</div>
            <div>
              <div style={{ fontWeight: 600, color: G.text, fontSize: "15px", fontFamily: G.font }}>{r.filename}</div>
              <div style={{ fontSize: "12px", color: G.muted, marginTop: "2px" }}>{r.findings_count} finding{r.findings_count !== 1 ? "s" : ""} detected</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "22px", fontWeight: 700, color: scoreColor(r.score ?? 100), fontFamily: G.font }}>{r.score}</div>
              <div style={{ fontSize: "11px", color: G.muted }}>score</div>
            </div>
            <button onClick={() => navigate(`/findings/${r.upload_id}`)} className="btn-primary">
              View Details →
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   HISTORY TAB
============================================================ */
function HistoryTab({ history, loading, onDelete, allFindings }) {
  const [deleting, setDeleting] = useState(null);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this scan and all its findings?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`${API_BASE_URL}/history/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!res.ok) throw new Error("Delete failed");
      if (onDelete) onDelete(id);
    } catch (e) {
      alert("Delete failed.");
    } finally {
      setDeleting(null);
    }
  };

  const filtered = history.filter(h =>
    !search || h.filename?.toLowerCase().includes(search.toLowerCase())
  );

  const scoreColor = (s) => s >= 80 ? G.green : s >= 50 ? G.yellow : G.red;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Controls */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <input
          placeholder="🔍  Search by filename..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, background: G.card, border: `1px solid ${G.border}`, borderRadius: "8px",
            padding: "10px 14px", color: G.text, fontFamily: G.fontDisplay, fontSize: "14px", outline: "none",
          }}
          onFocus={e => e.target.style.borderColor = G.accent}
          onBlur={e => e.target.style.borderColor = G.border}
        />
        {allFindings.length > 0 && (
          <>
            <button className="btn-ghost" onClick={() => exportCSV(allFindings, "all-findings.csv")} style={{ whiteSpace: "nowrap" }}>
              ⬇ CSV
            </button>
            <button className="btn-ghost" onClick={() => exportPDF(allFindings)} style={{ whiteSpace: "nowrap" }}>
              ⬇ PDF
            </button>
          </>
        )}
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "40px", color: G.muted }}>
          <div style={{ width: 24, height: 24, border: `2px solid ${G.border}`, borderTopColor: G.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
          Loading history...
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px", color: G.muted, fontSize: "14px" }}>
          {search ? "No scans match your search" : "No scan history yet — upload some files!"}
        </div>
      )}

      {filtered.map((h, i) => (
        <div key={h.id} className="card-hover fade-up" style={{
          background: G.card, border: `1px solid ${G.border}`, borderRadius: "12px",
          padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center",
          animationDelay: `${i * 40}ms`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ width: 38, height: 38, borderRadius: "8px", background: `${G.purple}14`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>📁</div>
            <div>
              <div style={{ fontWeight: 600, color: G.text, fontSize: "14px", fontFamily: G.font }}>{h.filename}</div>
              <div style={{ fontSize: "11px", color: G.muted, marginTop: "2px" }}>
                {h.timestamp || "—"} &nbsp;·&nbsp; {h.findings_count ?? 0} finding{h.findings_count !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            {h.score !== undefined && (
              <div style={{ fontSize: "18px", fontWeight: 700, color: scoreColor(h.score), fontFamily: G.font }}>
                {h.score}
              </div>
            )}
            <button onClick={() => navigate(`/findings/${h.id}`)} className="btn-ghost" style={{ padding: "7px 14px" }}>
              View →
            </button>
            <button
              onClick={() => handleDelete(h.id)}
              disabled={deleting === h.id}
              className="btn-danger"
            >
              {deleting === h.id ? "..." : "Delete"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   MAIN UPLOAD MANAGER
============================================================ */
function UploadManager({ handleLogout }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [allFindings, setAllFindings] = useState([]);
  const [historyList, setHistoryList] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => { injectGlobalStyles(); }, []);

  // Centralized data loading: fetches history & findings on mount
  const loadUserData = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      setLoadingData(true);
      const [histRes, findRes] = await Promise.all([
        fetch(`${API_BASE_URL}/history`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/findings`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (histRes.ok) {
        const histData = await histRes.json();
        setHistoryList(Array.isArray(histData) ? histData : []);
      }
      if (findRes.ok) {
        const findData = await findRes.json();
        setAllFindings(Array.isArray(findData) ? findData : []);
      }
    } catch (e) {
      console.error("Failed to load user scans", e);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const handleScanComplete = () => {
    // Refresh user data immediately so dashboard and history show updated counts
    loadUserData();
  };

  const handleDeleteHistory = (deletedId) => {
    setHistoryList(prev => prev.filter(h => h.id !== deletedId));
    setAllFindings(prev => prev.filter(f => f.upload_id !== deletedId));
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: G.bg }}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} handleLogout={handleLogout} />

      {/* Main content */}
      <main style={{ marginLeft: "220px", flex: 1, padding: "32px 36px", minHeight: "100vh" }}>
        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ fontSize: "22px", fontWeight: 700, color: G.text }}>
            {activeTab === "dashboard" && "Security Dashboard"}
            {activeTab === "scan" && "Scan Files"}
            {activeTab === "history" && "Scan History"}
            {activeTab === "compliance" && "Compliance Overview"}
          </div>
          <div style={{ fontSize: "13px", color: G.muted, marginTop: "4px" }}>
            {activeTab === "dashboard" && "Overview of your cloud security posture"}
            {activeTab === "scan" && "Upload cloud config files for analysis"}
            {activeTab === "history" && "All previous scans and their findings"}
            {activeTab === "compliance" && "NIST, CIS, and SOC 2 alignment status"}
          </div>
        </div>

        {activeTab === "dashboard" && (
          <DashboardTab allFindings={allFindings} historyList={historyList} />
        )}
        {activeTab === "scan" && (
          <ScanTab onScanComplete={handleScanComplete} />
        )}
        {activeTab === "history" && (
          <HistoryTab
            history={historyList}
            loading={loadingData}
            onDelete={handleDeleteHistory}
            allFindings={allFindings}
          />
        )}
        {activeTab === "compliance" && (
          <CompliancePanel
            findings={allFindings}
            history={historyList}
            onNavigateToScan={() => setActiveTab("scan")}
          />
        )}
      </main>
    </div>
  );
}

/* ============================================================
   MAIN APP ROUTER
============================================================ */
export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const navigate = useNavigate();

  useEffect(() => { injectGlobalStyles(); }, []);

  const updateToken = (newToken) => {
    if (newToken) {
      localStorage.setItem("token", newToken);
      setToken(newToken);
      navigate("/");
    } else {
      localStorage.removeItem("token");
      setToken(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    navigate("/login");
  };

  return (
    <Routes>
      <Route path="/login" element={!token ? <LoginPage mode="signin" onLoginSuccess={updateToken} /> : <Navigate to="/" />} />
      <Route path="/register" element={!token ? <LoginPage mode="register" onLoginSuccess={updateToken} /> : <Navigate to="/" />} />
      <Route path="/forgot-password" element={<LoginPage mode="forgot" />} />
      <Route path="/" element={token ? <UploadManager handleLogout={handleLogout} /> : <Navigate to="/login" />} />
      <Route path="/findings/:uploadId" element={token ? <FindingsPage /> : <Navigate to="/login" />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
