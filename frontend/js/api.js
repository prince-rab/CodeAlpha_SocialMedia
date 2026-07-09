/**
 * api.js — Shared API configuration for all frontend pages.
 *
 * Sets window.API_BASE so every fetch() always hits the Express
 * server on port 5000, regardless of which port serves the HTML.
 *
 * Best practice: open the app at http://localhost:5000 directly —
 * Express serves the frontend AND the API from the same origin,
 * so session cookies work with no cross-origin issues.
 */

(function () {
  // Must match PORT in backend/.env (default 5000)
  const EXPRESS_PORT = 5000;

  const currentPort = parseInt(window.location.port, 10) || 80;

  if (currentPort === EXPRESS_PORT) {
    // Same origin — use relative URLs, cookies travel fine.
    window.API_BASE = '';
  } else {
    // Different port (e.g. Live Server on 5500).
    // Point API calls at Express. Note: sessions may not persist across
    // origins unless the browser allows it — always prefer localhost:5000.
    window.API_BASE = `http://localhost:${EXPRESS_PORT}`;
    console.warn(
      `[SocialSphere] Page is on port ${currentPort}. ` +
      `API calls go to http://localhost:${EXPRESS_PORT}. ` +
      `Open http://localhost:${EXPRESS_PORT} directly for full session support.`
    );
  }
})();
