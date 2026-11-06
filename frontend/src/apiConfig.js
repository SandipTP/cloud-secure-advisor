// frontend/src/apiConfig.js

/**
 * Centralized API configuration.
 * Resolves API URL from VITE_API_URL environment variable, defaulting to http://127.0.0.1:5000.
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

/**
 * Safely parses JSON from a fetch Response.
 * If the response returns HTML (e.g. 404/500/proxy page) or invalid JSON,
 * returns a structured object with a human-readable error instead of throwing SyntaxError.
 */
export async function safeJson(response) {
  const contentType = response.headers?.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      // Fall through to text handling
    }
  }

  try {
    const text = await response.text();
    if (!response.ok) {
      if (text.trim().startsWith("<")) {
        return {
          error: `Server endpoint returned ${response.status} ${response.statusText}. Please verify the backend service is running with the latest updates.`
        };
      }
      return { error: text || `Request failed with status ${response.status}` };
    }
    return {};
  } catch {
    return { error: `Network error (${response.status || "Unknown"})` };
  }
}

export default API_BASE_URL;
