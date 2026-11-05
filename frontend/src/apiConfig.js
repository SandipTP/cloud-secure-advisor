// frontend/src/apiConfig.js

/**
 * Centralized API configuration.
 * Resolves API URL from VITE_API_URL environment variable, defaulting to http://127.0.0.1:5000.
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

export default API_BASE_URL;

