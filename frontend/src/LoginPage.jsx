import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  purple: "#8b5cf6",
  text: "#e2e8f0",
  muted: "#64748b",
  font: "'DM Mono', 'Fira Code', monospace",
  fontDisplay: "'Space Grotesk', sans-serif",
};

export default function LoginPage({ onLoginSuccess, mode = "signin" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [step, setStep] = useState(1); // 1 = Request code, 2 = Verify & reset
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Reset form errors and passwords whenever route mode changes
  useEffect(() => {
    setError(null);
    setSuccessMsg(null);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
    setResetCode("");
    setStep(1);
  }, [mode]);

  const needsConfirm = mode === "register" || (mode === "forgot" && step === 2);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Please provide an email address.");
      return;
    }

    if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      setError("Please enter a valid email address.");
      return;
    }

    if (mode === "register" || (mode === "forgot" && step === 2)) {
      if (password.length < 8) {
        setError("Password must be at least 8 characters long.");
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    if (mode === "forgot" && step === 2 && !resetCode.trim()) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    setLoading(true);

    try {
      // STEP 1: Forgot Password Code Request
      if (mode === "forgot" && step === 1) {
        const response = await fetch(`${API_BASE_URL}/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanEmail }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to send reset code");

        setSuccessMsg("If an account exists with this email, a 6-digit code has been sent.");
        setStep(2);
        setPassword("");
        setConfirmPassword("");
        setLoading(false);
        return;
      }

      // STEP 2: Login, Register, or Reset Password
      const endpoint = mode === "register" ? "/signup" :
        mode === "forgot" ? "/reset-password" : "/login";

      const payload = mode === "forgot"
        ? { email: cleanEmail, password, code: resetCode.trim() }
        : { email: cleanEmail, password };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Action failed");

      if (mode === "register") {
        setSuccessMsg("Account created! Let's complete your profile...");
        setTimeout(() => {
          if (data.access_token && onLoginSuccess) {
            onLoginSuccess(data.access_token, "/complete-profile");
          } else {
            navigate("/login");
          }
        }, 700);
      } else if (mode === "forgot") {
        setSuccessMsg("Password reset successfully! Redirecting to login...");
        setTimeout(() => navigate("/login"), 1200);
      } else {
        // Successful login
        if (onLoginSuccess && data.access_token) {
          onLoginSuccess(data.access_token, "/");
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    if (mode === "signin") return "Welcome Back";
    if (mode === "register") return "Create Account";
    return step === 1 ? "Forgot Password" : "Reset Password";
  };

  const getSubtitle = () => {
    if (mode === "signin") return "Sign in to access your cloud security posture overview.";
    if (mode === "register") return "Get started with automated cloud security compliance.";
    return step === 1
      ? "Enter your email to receive a 6-digit verification code."
      : "Enter your code and choose a new secure password.";
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
        maxWidth: "420px",
        background: G.card,
        border: `1px solid ${G.border}`,
        borderRadius: "16px",
        padding: "36px 32px",
        boxShadow: "0 20px 45px rgba(0,0,0,0.5)",
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: "26px" }}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: "14px",
            background: `linear-gradient(135deg, ${G.accent}25, ${G.purple}25)`,
            border: `1px solid ${G.accent}45`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "24px",
            marginBottom: "14px",
          }}>
            🛡️
          </div>
          <div style={{ fontSize: "12px", color: G.accent, letterSpacing: "2px", fontFamily: G.font, fontWeight: 700, marginBottom: "4px" }}>
            CLOUDSECURE ADVISOR
          </div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: G.text, margin: "0 0 6px 0" }}>
            {getTitle()}
          </h1>
          <p style={{ fontSize: "13px", color: G.muted, lineHeight: 1.4, margin: 0 }}>
            {getSubtitle()}
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div style={{
            background: `${G.red}18`,
            border: `1px solid ${G.red}44`,
            borderRadius: "8px",
            padding: "12px 14px",
            color: G.red,
            fontSize: "13px",
            marginBottom: "18px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}>
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            background: `${G.green}18`,
            border: `1px solid ${G.green}44`,
            borderRadius: "8px",
            padding: "12px 14px",
            color: G.green,
            fontSize: "13px",
            marginBottom: "18px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}>
            <span>✅</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Main Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Email input */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label style={{ fontSize: "12px", color: G.muted, fontWeight: 500 }}>
                Email Address
              </label>
              {mode === "forgot" && step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={{
                    background: "none",
                    border: "none",
                    color: G.accent,
                    fontSize: "11px",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  ✎ Change email
                </button>
              )}
            </div>
            <input
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              required
              disabled={mode === "forgot" && step === 2}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                ...inputStyle,
                opacity: mode === "forgot" && step === 2 ? 0.6 : 1,
              }}
            />
          </div>

          {/* Verification Code for Forgot Password Step 2 */}
          {mode === "forgot" && step === 2 && (
            <div>
              <label style={{ display: "block", fontSize: "12px", color: G.muted, marginBottom: "6px", fontWeight: 500 }}>
                6-Digit Verification Code
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="123456"
                value={resetCode}
                required
                onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ""))}
                style={{
                  ...inputStyle,
                  fontFamily: G.font,
                  letterSpacing: "4px",
                  fontSize: "16px",
                  textAlign: "center",
                }}
              />
            </div>
          )}

          {/* Password Input (rendered for login, register, and reset step 2) */}
          {(mode !== "forgot" || step === 2) && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ fontSize: "12px", color: G.muted, fontWeight: 500 }}>
                  {mode === "forgot" ? "New Password" : "Password"}
                </label>
                {(mode === "register" || mode === "forgot") && (
                  <span style={{ fontSize: "11px", color: password.length >= 8 ? G.green : G.muted }}>
                    {password.length >= 8 ? "✓ 8+ chars" : "min 8 chars"}
                  </span>
                )}
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  placeholder="••••••••••••"
                  value={password}
                  required
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    ...inputStyle,
                    paddingRight: "60px",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={toggleButtonStyle}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          )}

          {/* Confirm Password Input (rendered for register and reset step 2) */}
          {needsConfirm && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label style={{ fontSize: "12px", color: G.muted, fontWeight: 500 }}>
                  Confirm {mode === "forgot" ? "New " : ""}Password
                </label>
                {confirmPassword && (
                  <span style={{ fontSize: "11px", color: password === confirmPassword ? G.green : G.red }}>
                    {password === confirmPassword ? "✓ Match" : "✗ Mismatch"}
                  </span>
                )}
              </div>
              <div style={{ position: "relative" }}>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  required
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    ...inputStyle,
                    paddingRight: "60px",
                    borderColor: confirmPassword && password !== confirmPassword ? G.red : G.border,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={toggleButtonStyle}
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
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
              marginTop: "4px",
              transition: "opacity 0.2s, transform 0.15s",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Processing..." :
              mode === "signin" ? "Sign In →" :
                mode === "register" ? "Create Account →" :
                  step === 1 ? "Send Reset Code →" : "Update Password →"}
          </button>
        </form>

        {/* Footer Navigation Links */}
        <div style={{
          marginTop: "24px",
          paddingTop: "20px",
          borderTop: `1px solid ${G.border}`,
          fontSize: "13px",
          display: "flex",
          justifyContent: "center",
          gap: "12px",
          alignItems: "center",
          color: G.muted,
        }}>
          {mode === "signin" ? (
            <>
              <Link to="/register" style={linkStyle}>New user? Register</Link>
              <span>&bull;</span>
              <Link to="/forgot-password" style={linkStyle}>Forgot Password?</Link>
            </>
          ) : mode === "register" ? (
            <>
              <span>Already have an account?</span>
              <Link to="/login" style={linkStyle}>Sign In</Link>
            </>
          ) : (
            <>
              <Link to="/login" style={linkStyle}>Back to Sign In</Link>
              <span>&bull;</span>
              <Link to="/register" style={linkStyle}>Create Account</Link>
            </>
          )}
        </div>
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
  transition: "border-color 0.2s",
};

const toggleButtonStyle = {
  position: "absolute",
  right: "12px",
  top: "50%",
  transform: "translateY(-50%)",
  background: "none",
  border: "none",
  color: "#00d4ff",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: "600",
  fontFamily: "'Space Grotesk', sans-serif",
  padding: 0,
};

const linkStyle = {
  color: "#00d4ff",
  textDecoration: "none",
  fontWeight: "600",
  transition: "opacity 0.2s",
};
