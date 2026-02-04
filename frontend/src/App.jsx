import { useState } from "react";

function App() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const findings = result?.parsed_output?.findings || [];
  const counts = findings.reduce(
    (acc, f) => {
      acc.total += 1;
      acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    },
    { total: 0 }
  );
  const getSeverityColor = (severity) => {
    switch (severity) {
      case "critical":
        return "#d9534f";
      case "high":
        return "#f0ad4e";
      default:
        return "#5bc0de";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://127.0.0.1:5000/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError("Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Cloud Secure Advisor</h1>

      <form onSubmit={handleSubmit}>
        <input
          type="file"
          accept=".json"
          onChange={(e) => {
            setFile(e.target.files[0]);
            setResult(null);
            setError(null);
          }}
        />
        <button type="submit" disabled={loading}>
          {loading ? "Uploading..." : "Upload"}
        </button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {findings.length > 0 && (
        <div style={{ marginTop: "2rem", marginBottom: "1rem" }}>
          <h2>Findings Summary</h2>
          <p><strong>Total:</strong> {counts.total}</p>
          <p style={{ color: "#d9534f" }}>
            <strong>Critical:</strong> {counts.critical || 0}
          </p>
          <p style={{ color: "#f0ad4e" }}>
            <strong>High:</strong> {counts.high || 0}
          </p>
        </div>
      )}

      {result?.parsed_output?.findings && (
        <div style={{ marginTop: "2rem" }}>
          <h2>Findings</h2>

          {result.parsed_output.findings.map((f, idx) => (
            <div
              key={idx}
              style={{
                border: "1px solid #ddd",
                borderLeft: `6px solid ${getSeverityColor(f.severity)}`,
                padding: "1rem",
                marginBottom: "1rem",
                borderRadius: "4px",
              }}
            >
              <h3>{f.issue}</h3>
              <p><strong>Severity:</strong> {f.severity}</p>
              <p>{f.detail}</p>
              <p><strong>Standard:</strong> {f.nist_reference}</p>
            </div>
          ))}
        </div>
      )}

    </div>

  );
}

export default App;
