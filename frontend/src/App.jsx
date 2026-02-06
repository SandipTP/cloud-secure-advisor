import { useState } from "react";

function App() {
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleBatchUpload = async (e) => {
    e.preventDefault();
    if (files.length === 0) {
      setError("Please select at least one file");
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);
    setSummary(null);

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });

    try {
      const response = await fetch("http://127.0.0.1:5000/upload/batch", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      setResults(data.results || []);

      // ---- Batch summary ----
      let totalFindings = 0;
      data.results.forEach(r => {
        totalFindings += r.findings_count || 0;
      });

      setSummary({
        totalFiles: data.total_files,
        totalFindings
      });

    } catch (err) {
      setError("Batch upload failed");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto" }}>
      <h1>Cloud Secure Advisor</h1>

      <form onSubmit={handleBatchUpload}>
        <input
          type="file"
          accept=".json"
          multiple
          onChange={(e) => {
            setFiles([...e.target.files]);
            setResults(null);
            setSummary(null);
            setError(null);
          }}
        />

        <br /><br />

        <button type="submit" disabled={loading}>
          {loading ? "Uploading..." : "Upload Files"}
        </button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {summary && (
        <div style={{ marginTop: "2rem", marginBottom: "1rem" }}>
          <h2>Summary</h2>
          <p><strong>Total Files:</strong> {summary.totalFiles}</p>
          <p><strong>Total Findings:</strong> {summary.totalFindings}</p>
        </div>
      )}

      {Array.isArray(results) && results.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h2>Batch Results</h2>

          {results.map((r, idx) => (
            <div
              key={idx}
              style={{
                border: "1px solid #ddd",
                padding: "1rem",
                marginBottom: "1rem",
                borderRadius: "4px",
              }}
            >
              <h3>{r.filename}</h3>
              <p><strong>Status:</strong> {r.status}</p>
              <p><strong>Findings Count:</strong> {r.findings_count}</p>
              {r.error && <p style={{ color: "red" }}>{r.error}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;