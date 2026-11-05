import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "./apiConfig";

export default function LoginPage({ onLoginSuccess, mode = "signin" }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState(null);
    const [resetCode, setResetCode] = useState("");
    const [step, setStep] = useState(1); // 1 = Request, 2 = Verify/Reset
    const navigate = useNavigate();
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const needsConfirm = mode === "register" || (mode === "forgot" && step === 2);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMsg(null);

        if (needsConfirm && password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setLoading(true);

        try {
            // STEP 1: Handling the "Forgot Password" Email Request
            if (mode === "forgot" && step === 1) {
                const response = await fetch(`${API_BASE_URL}/forgot-password`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email }),
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || "Failed to send code");

                setSuccessMsg("If the email is valid, a 6-digit code has been sent.");
                setStep(2);
                setConfirmPassword("");
                setLoading(false);
                return;
            }

            // STEP 2: Logic for Signup, Login, or Resetting the Password
            const endpoint = mode === "register" ? "/signup" :
                mode === "forgot" ? "/reset-password" : "/login";

            const payload = mode === "forgot"
                ? { email, password, code: resetCode }
                : { email, password };

            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Action failed");

            if (mode === "register") {
                setSuccessMsg("Account created! Directing you to complete your profile...");
                setTimeout(() => {
                    if (data.access_token && onLoginSuccess) {
                        onLoginSuccess(data.access_token, "/complete-profile");
                    } else {
                        navigate("/login");
                    }
                }, 700);
            } else if (mode === "forgot") {
                setSuccessMsg("Password reset successfully! Redirecting to login...");
                setTimeout(() => navigate("/login"), 1500);
            } else {
                // Successful Login
                onLoginSuccess(data.access_token);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={containerStyle}>
            <div style={cardStyle}>
                <h2 style={{ marginBottom: "1.5rem" }}>
                    {mode === "signin" ? "Sign In" : mode === "register" ? "Create Account" : "Reset Password"}
                </h2>

                <form onSubmit={handleSubmit}>
                    <input
                        type="email"
                        placeholder="Email Address"
                        value={email}
                        required
                        onChange={(e) => setEmail(e.target.value)}
                        style={inputStyle}
                        disabled={mode === "forgot" && step === 2}
                    />

                    {mode === "forgot" && step === 2 && (
                        <input
                            type="text"
                            placeholder="6-Digit Code"
                            value={resetCode}
                            required
                            onChange={(e) => setResetCode(e.target.value)}
                            style={inputStyle}
                        />
                    )}

                    {(mode !== "forgot" || step === 2) && (
                        <div style={{ position: "relative", width: "100%" }}>
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder={mode === "forgot" ? "New Password" : "Password"}
                                value={password}
                                required
                                onChange={(e) => setPassword(e.target.value)}
                                style={inputStyle}
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} style={toggleButtonStyle}>
                                {showPassword ? "Hide" : "Show"}
                            </button>
                        </div>
                    )}

                    {needsConfirm && (
                        <div style={{ position: "relative", width: "100%" }}>
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder={mode === "forgot" ? "Confirm New Password" : "Confirm Password"}
                                value={confirmPassword}
                                required
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                style={{
                                    ...inputStyle,
                                    borderColor: confirmPassword && password !== confirmPassword ? "red" : "#ccc",
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                style={toggleButtonStyle}
                            >
                                {showConfirmPassword ? "Hide" : "Show"}
                            </button>
                            {confirmPassword && password !== confirmPassword && (
                                <p style={{ color: "red", fontSize: "12px", marginTop: "-10px", marginBottom: "10px", textAlign: "left" }}>
                                    Passwords do not match
                                </p>
                            )}
                        </div>
                    )}

                    <button type="submit" disabled={loading} style={buttonStyle}>
                        {loading ? "Processing..." :
                            mode === "signin" ? "Login" :
                                mode === "register" ? "Sign Up" :
                                    step === 1 ? "Send Reset Code" : "Update Password"}
                    </button>
                </form>

                <div style={linkContainerStyle}>
                    {mode === "signin" ? (
                        <>
                            <Link to="/register" style={linkStyle}>New user? Register</Link>
                            <span style={{ margin: "0 10px", color: "#ccc" }}>|</span>
                            <Link to="/forgot-password" style={linkStyle}>Forgot Password?</Link>
                        </>
                    ) : (
                        <Link to="/login" style={linkStyle} onClick={() => { setStep(1); setConfirmPassword(""); }}>
                            Already have an account? Sign In
                        </Link>
                    )}
                </div>

                {error && <p style={{ color: "red", marginTop: "1rem", fontSize: "14px" }}>{error}</p>}
                {successMsg && <p style={{ color: "green", marginTop: "1rem", fontSize: "14px" }}>{successMsg}</p>}
            </div>
        </div>
    );
}

const toggleButtonStyle = { position: "absolute", right: "10px", top: "12px", background: "none", border: "none", color: "#1a73e8", cursor: "pointer", fontSize: "12px", fontWeight: "600", zIndex: 2 };
const containerStyle = { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", fontFamily: "sans-serif", backgroundColor: "#f8f9fa" };
const cardStyle = { padding: "2.5rem", border: "1px solid #ddd", borderRadius: "12px", width: "100%", maxWidth: "400px", textAlign: "center", backgroundColor: "#fff", boxShadow: "0 10px 25px rgba(0,0,0,0.05)" };
const inputStyle = { width: "100%", padding: "12px", marginBottom: "15px", borderRadius: "6px", border: "1px solid #ccc", boxSizing: "border-box", fontSize: "16px" };
const buttonStyle = { width: "100%", padding: "12px", backgroundColor: "#000", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "16px", fontWeight: "bold" };
const linkContainerStyle = { marginTop: "1.5rem", fontSize: "14px", display: "flex", justifyContent: "center", gap: "10px", alignItems: "center" };
const linkStyle = { color: "#007bff", textDecoration: "none", fontWeight: "500" };
