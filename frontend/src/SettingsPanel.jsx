import { useState, useEffect } from "react";
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

export default function SettingsPanel({ onLogout, onEmailUpdated }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Email form state
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [updatingEmail, setUpdatingEmail] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const token = localStorage.getItem("token");

  // Fetch current user profile
  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/account`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load profile");
        setProfile(data);
        setNewEmail(data.email || "");
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [token]);

  // Handle email update
  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!newEmail || !emailPassword) {
      setError("Please provide both your new email and current password.");
      return;
    }

    try {
      setUpdatingEmail(true);
      const res = await fetch(`${API_BASE_URL}/account`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: newEmail,
          current_password: emailPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update email");

      setProfile(prev => ({ ...prev, email: data.email }));
      setEmailPassword("");
      setSuccess("Account email successfully updated!");
      if (onEmailUpdated) onEmailUpdated(data.email);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingEmail(false);
    }
  };

  // Handle password update
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Please fill out all password fields.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    try {
      setUpdatingPassword(true);
      const res = await fetch(`${API_BASE_URL}/account`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to change password");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Password successfully changed!");
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingPassword(false);
    }
  };

  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setError("Please enter your current password to confirm deletion.");
      return;
    }

    try {
      setDeleting(true);
      const res = await fetch(`${API_BASE_URL}/account`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete account");

      alert("Your account and all associated scan data have been permanently deleted.");
      if (onLogout) onLogout();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0", color: G.muted }}>
        <div style={{
          width: 28, height: 28, border: `2px solid ${G.border}`,
          borderTopColor: G.accent, borderRadius: "50%",
          animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
        }} />
        Loading account details...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "900px" }}>
      {/* Notifications */}
      {error && (
        <div style={{
          background: `${G.red}18`, border: `1px solid ${G.red}44`,
          borderRadius: "10px", padding: "14px 18px", color: G.red,
          fontSize: "14px", display: "flex", alignItems: "center", gap: "10px",
        }}>
          <span>⚠</span>
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: "transparent", border: "none", color: G.red, cursor: "pointer", fontSize: "16px" }}>×</button>
        </div>
      )}

      {success && (
        <div style={{
          background: `${G.green}18`, border: `1px solid ${G.green}44`,
          borderRadius: "10px", padding: "14px 18px", color: G.green,
          fontSize: "14px", display: "flex", alignItems: "center", gap: "10px",
        }}>
          <span>✅</span>
          <span style={{ flex: 1 }}>{success}</span>
          <button onClick={() => setSuccess(null)} style={{ background: "transparent", border: "none", color: G.green, cursor: "pointer", fontSize: "16px" }}>×</button>
        </div>
      )}

      {/* Profile Overview Card */}
      <div style={{
        background: G.card, border: `1px solid ${G.border}`, borderRadius: "14px",
        padding: "24px", display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: "18px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div style={{
            width: 54, height: 54, borderRadius: "14px",
            background: `linear-gradient(135deg, ${G.accent}33, ${G.purple}33)`,
            border: `1px solid ${G.accent}55`, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: "24px", color: G.accent,
          }}>
            👤
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: G.text, margin: 0 }}>
                {profile?.email || "Account User"}
              </h2>
              <span style={{
                background: `${G.accent}14`, color: G.accent, border: `1px solid ${G.accent}33`,
                borderRadius: "4px", padding: "2px 8px", fontSize: "10px", fontFamily: G.font, fontWeight: 700,
              }}>
                USER #{profile?.id || "—"}
              </span>
            </div>
            <div style={{ fontSize: "12px", color: G.muted, marginTop: "4px", fontFamily: G.fontDisplay }}>
              Member since: {profile?.created_at || "Recent"} &bull; Authentication: Salted Bcrypt &bull; JWT Auth
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "18px" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "20px", fontWeight: 700, color: G.accent, fontFamily: G.font }}>
              {profile?.total_scans ?? 0}
            </div>
            <div style={{ fontSize: "11px", color: G.muted }}>Files Scanned</div>
          </div>
          <div style={{ width: 1, background: G.border, height: "36px" }} />
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "20px", fontWeight: 700, color: profile?.total_findings > 0 ? G.yellow : G.green, fontFamily: G.font }}>
              {profile?.total_findings ?? 0}
            </div>
            <div style={{ fontSize: "11px", color: G.muted }}>Findings Detected</div>
          </div>
        </div>
      </div>

      {/* Grid: Edit Email & Change Password */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {/* Update Email Section */}
        <div style={{
          background: G.card, border: `1px solid ${G.border}`, borderRadius: "14px",
          padding: "24px", display: "flex", flexDirection: "column", gap: "16px",
        }}>
          <div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: G.text, marginBottom: "4px" }}>
              Update Email Address
            </div>
            <div style={{ fontSize: "12px", color: G.muted }}>
              Change the email address used to log into CloudSecure Advisor.
            </div>
          </div>

          <form onSubmit={handleUpdateEmail} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: G.muted, marginBottom: "6px" }}>
                New Email Address
              </label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="your.email@example.com"
                style={{
                  width: "100%", background: G.surface, border: `1px solid ${G.border}`,
                  borderRadius: "8px", padding: "10px 14px", color: G.text,
                  fontSize: "13px", fontFamily: G.fontDisplay, outline: "none",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", color: G.muted, marginBottom: "6px" }}>
                Current Password (to confirm change)
              </label>
              <input
                type="password"
                required
                value={emailPassword}
                onChange={e => setEmailPassword(e.target.value)}
                placeholder="••••••••••••"
                style={{
                  width: "100%", background: G.surface, border: `1px solid ${G.border}`,
                  borderRadius: "8px", padding: "10px 14px", color: G.text,
                  fontSize: "13px", fontFamily: G.fontDisplay, outline: "none",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={updatingEmail || !newEmail || newEmail === profile?.email}
              className="btn-primary"
              style={{ marginTop: "4px" }}
            >
              {updatingEmail ? "Updating Email..." : "Update Email Address"}
            </button>
          </form>
        </div>

        {/* Change Password Section */}
        <div style={{
          background: G.card, border: `1px solid ${G.border}`, borderRadius: "14px",
          padding: "24px", display: "flex", flexDirection: "column", gap: "16px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: G.text, marginBottom: "4px" }}>
                Change Password
              </div>
              <div style={{ fontSize: "12px", color: G.muted }}>
                Enforce credential security with at least 8 characters.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowPasswords(prev => !prev)}
              style={{
                background: "transparent", border: "none", color: G.muted,
                fontSize: "12px", cursor: "pointer", textDecoration: "underline",
              }}
            >
              {showPasswords ? "Hide" : "Show"}
            </button>
          </div>

          <form onSubmit={handleUpdatePassword} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: G.muted, marginBottom: "6px" }}>
                Current Password
              </label>
              <input
                type={showPasswords ? "text" : "password"}
                required
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="••••••••••••"
                style={{
                  width: "100%", background: G.surface, border: `1px solid ${G.border}`,
                  borderRadius: "8px", padding: "10px 14px", color: G.text,
                  fontSize: "13px", fontFamily: G.fontDisplay, outline: "none",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", color: G.muted, marginBottom: "6px" }}>
                New Password (min 8 chars)
              </label>
              <input
                type={showPasswords ? "text" : "password"}
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                style={{
                  width: "100%", background: G.surface, border: `1px solid ${G.border}`,
                  borderRadius: "8px", padding: "10px 14px", color: G.text,
                  fontSize: "13px", fontFamily: G.fontDisplay, outline: "none",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", color: G.muted, marginBottom: "6px" }}>
                Confirm New Password
              </label>
              <input
                type={showPasswords ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                style={{
                  width: "100%", background: G.surface, border: `1px solid ${G.border}`,
                  borderRadius: "8px", padding: "10px 14px", color: G.text,
                  fontSize: "13px", fontFamily: G.fontDisplay, outline: "none",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={updatingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="btn-primary"
              style={{ marginTop: "4px" }}
            >
              {updatingPassword ? "Changing Password..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>

      {/* Danger Zone: Delete Account */}
      <div style={{
        background: `${G.red}08`, border: `1px solid ${G.red}44`,
        borderRadius: "14px", padding: "24px", display: "flex",
        justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px",
      }}>
        <div>
          <div style={{ fontSize: "15px", fontWeight: 700, color: G.red, marginBottom: "4px" }}>
            Danger Zone &mdash; Delete Account
          </div>
          <div style={{ fontSize: "12px", color: G.muted, maxWidth: "560px", lineHeight: 1.4 }}>
            Permanently delete your user profile and all associated data, including uploaded cloud configs,
            scan history, and compliance findings. This action cannot be undone.
          </div>
        </div>

        <button
          onClick={() => setShowDeleteModal(true)}
          className="btn-danger"
          style={{ padding: "10px 20px", fontSize: "13px", fontWeight: 600 }}
        >
          Delete Account
        </button>
      </div>

      {/* Confirmation Modal for Account Deletion */}
      {showDeleteModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0, 0, 0, 0.8)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px",
        }}>
          <div style={{
            background: G.card, border: `1px solid ${G.red}`, borderRadius: "16px",
            padding: "28px", maxWidth: "460px", width: "100%", display: "flex",
            flexDirection: "column", gap: "18px", boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ fontSize: "28px" }}>⚠️</div>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: 700, color: G.red, margin: 0 }}>
                  Confirm Account Deletion
                </h3>
                <div style={{ fontSize: "12px", color: G.muted, marginTop: "2px" }}>
                  This permanently removes your account and all scans.
                </div>
              </div>
            </div>

            <p style={{ fontSize: "13px", color: G.text, lineHeight: 1.5 }}>
              To confirm, please enter your current account password:
            </p>

            <input
              type="password"
              placeholder="Enter your password"
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
              style={{
                background: G.surface, border: `1px solid ${G.border}`,
                borderRadius: "8px", padding: "10px 14px", color: G.text,
                fontSize: "14px", outline: "none", width: "100%",
              }}
            />

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "6px" }}>
              <button
                type="button"
                onClick={() => { setShowDeleteModal(false); setDeletePassword(""); }}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting || !deletePassword}
                onClick={handleDeleteAccount}
                style={{
                  background: G.red, color: "#fff", border: "none",
                  borderRadius: "8px", padding: "10px 20px",
                  fontSize: "13px", fontWeight: 700, cursor: "pointer",
                }}
              >
                {deleting ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
