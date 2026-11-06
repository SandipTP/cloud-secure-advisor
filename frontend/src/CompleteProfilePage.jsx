import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL, safeJson } from "./apiConfig";

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
  purple: "#8b5cf6",
  text: "#e2e8f0",
  muted: "#64748b",
  font: "'DM Mono', 'Fira Code', monospace",
  fontDisplay: "'Space Grotesk', sans-serif",
};

export default function CompleteProfilePage({ onProfileSaved }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const token = localStorage.getItem("token");

  useEffect(() => {
    async function fetchExisting() {
      if (!token) {
        navigate("/login");
        return;
      }
      try {
        setFetching(true);
        const res = await fetch(`${API_BASE_URL}/account`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          localStorage.removeItem("token");
          navigate("/login");
          return;
        }
        if (res.ok) {
          const data = await safeJson(res);
          if (data.first_name) setFirstName(data.first_name);
          if (data.last_name) setLastName(data.last_name);
          if (data.dob) setDob(data.dob);
          if (data.phone) setPhone(data.phone);
        }
      } catch (err) {
        console.warn("Could not prefill profile", err);
      } finally {
        setFetching(false);
      }
    }
    fetchExisting();
  }, [token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError("Please provide both your First Name and Last Name.");
      return;
    }

    if (!dob) {
      setError("Please select your Date of Birth.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/account`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          dob: dob,
          phone: phone.trim() || null,
        }),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || "Failed to save profile details");

      setSuccess(true);
      if (onProfileSaved) {
        onProfileSaved(data.profile || {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          dob,
          phone: phone.trim() || "",
        });
      }

      setTimeout(() => {
        navigate("/");
      }, 700);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigate("/");
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: G.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: G.fontDisplay,
    }}>
      <div style={{
        width: "100%",
        maxWidth: "480px",
        background: G.card,
        border: `1px solid ${G.border}`,
        borderRadius: "16px",
        padding: "36px 32px",
        boxShadow: "0 20px 45px rgba(0,0,0,0.45)",
      }}>
        {/* Header Badge & Title */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: "16px",
            background: `linear-gradient(135deg, ${G.accent}25, ${G.purple}25)`,
            border: `1px solid ${G.accent}45`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "26px",
            marginBottom: "16px",
          }}>
            👤
          </div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: G.text, margin: "0 0 8px 0" }}>
            Complete Your Profile
          </h1>
          <p style={{ fontSize: "13px", color: G.muted, lineHeight: 1.5, margin: 0 }}>
            Welcome to CloudSecure Advisor! Please take a moment to provide your profile details.
          </p>
        </div>

        {/* Error / Success Notifications */}
        {error && (
          <div style={{
            background: `${G.red}18`,
            border: `1px solid ${G.red}44`,
            borderRadius: "8px",
            padding: "12px 14px",
            color: G.red,
            fontSize: "13px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}>
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div style={{
            background: `${G.green}18`,
            border: `1px solid ${G.green}44`,
            borderRadius: "8px",
            padding: "12px 14px",
            color: G.green,
            fontSize: "13px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}>
            <span>✅</span>
            <span>Profile saved successfully! Redirecting...</span>
          </div>
        )}

        {fetching ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: G.muted, fontSize: "14px" }}>
            Loading your account...
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            {/* First Name & Last Name in 2 columns */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: G.muted, marginBottom: "6px", fontWeight: 500 }}>
                  First Name <span style={{ color: G.accent }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jane"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: G.muted, marginBottom: "6px", fontWeight: 500 }}>
                  Last Name <span style={{ color: G.accent }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Date of Birth */}
            <div>
              <label style={{ display: "block", fontSize: "12px", color: G.muted, marginBottom: "6px", fontWeight: 500 }}>
                Date of Birth <span style={{ color: G.accent }}>*</span>
              </label>
              <input
                type="date"
                required
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                style={{
                  ...inputStyle,
                  colorScheme: "dark",
                }}
              />
            </div>

            {/* Phone Number (Optional) */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ fontSize: "12px", color: G.muted, fontWeight: 500 }}>
                  Phone Number
                </label>
                <span style={{ fontSize: "11px", color: G.muted, fontStyle: "italic" }}>
                  Optional
                </span>
              </div>
              <input
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                type="submit"
                disabled={loading || success}
                style={{
                  background: `linear-gradient(135deg, ${G.accent}, ${G.accentDim})`,
                  color: "#000",
                  border: "none",
                  borderRadius: "8px",
                  padding: "12px 20px",
                  fontFamily: G.fontDisplay,
                  fontWeight: 700,
                  fontSize: "14px",
                  cursor: "pointer",
                  transition: "opacity 0.2s, transform 0.15s",
                }}
              >
                {loading ? "Saving Profile..." : "Save & Continue →"}
              </button>

              <button
                type="button"
                onClick={handleSkip}
                style={{
                  background: "transparent",
                  color: G.muted,
                  border: `1px solid ${G.border}`,
                  borderRadius: "8px",
                  padding: "10px 20px",
                  fontFamily: G.fontDisplay,
                  fontSize: "13px",
                  cursor: "pointer",
                  transition: "color 0.2s, border-color 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = G.text;
                  e.currentTarget.style.borderColor = G.muted;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = G.muted;
                  e.currentTarget.style.borderColor = G.border;
                }}
              >
                Skip for now &rarr;
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  background: "#111827",
  border: "1px solid #1e2d45",
  borderRadius: "8px",
  padding: "11px 14px",
  color: "#e2e8f0",
  fontSize: "13px",
  fontFamily: "'Space Grotesk', sans-serif",
  outline: "none",
  boxSizing: "border-box",
};

