/**
 * api.js — Shared API configuration for all frontend pages.
 *
 * Sets window.API_BASE so every fetch() always hits the Express server.
 *
 * Express serves both the frontend (static files) AND the API from the same origin,
 * so session cookies work reliably in all environments:
 * - Localhost: http://localhost:5000 (frontend and API on same origin)
 * - Production (Render): https://your-app.onrender.com (frontend and API on same origin)
 */

(function () {
  // Always use relative URLs — Express serves both frontend and API from the same origin.
  // This ensures cookies and sessions work correctly in all environments.
  window.API_BASE = '';
})();
