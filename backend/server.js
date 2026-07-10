/**
 * Social Media Platform — Express.js + Supabase
 * Entry point: server.js
 *
 * Startup checklist (printed to console):
 *  ✅ / ❌  Each required env var
 *  ✅ / ⚠️  Session store (PostgreSQL or in-memory fallback)
 */

require('dotenv').config();

const express    = require('express');
const session    = require('express-session');
const fileUpload = require('express-fileupload');
const cors       = require('cors');
const path       = require('path');
const fs         = require('fs');

// Route modules
const authRoutes    = require('./routes/authRoutes');
const userRoutes    = require('./routes/userRoutes');
const postRoutes    = require('./routes/postRoutes');
const commentRoutes = require('./routes/commentRoutes');
const likeRoutes    = require('./routes/likeRoutes');
const followRoutes  = require('./routes/followRoutes');

const app  = express();
const PORT = process.env.PORT || 5000;

// ─────────────────────────────────────────────────────────────
// Startup diagnostics — print env status clearly
// ─────────────────────────────────────────────────────────────
function checkEnv() {
  const required = {
    SUPABASE_URL:         process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY:    process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
    DATABASE_URL:         process.env.DATABASE_URL,
    SESSION_SECRET:       process.env.SESSION_SECRET,
  };

  console.log('\n─────────────────────────────────────────');
  console.log('  SocialSphere — Environment Check');
  console.log('─────────────────────────────────────────');
  let allOk = true;
  for (const [key, val] of Object.entries(required)) {
    const ok = !!val;
    if (!ok) allOk = false;
    console.log(`  ${ok ? '✅' : '❌'} ${key}${ok ? '' : '  ← MISSING in .env'}`);
  }
  console.log('─────────────────────────────────────────');
  if (!allOk) {
    console.log('\n  ⚠️  Some variables are missing.');
    console.log('  Copy backend/.env.example → backend/.env');
    console.log('  and fill in your Supabase credentials.\n');
  }
  return allOk;
}

checkEnv();

// ─────────────────────────────────────────────────────────────
// Session store — PostgreSQL (Supabase) or memory fallback
// ─────────────────────────────────────────────────────────────
// Keep sessions in memory so auth never depends on the PostgreSQL
// connection string. The app data still uses Supabase directly.
let sessionStore = undefined;
console.warn('  ⚠️  Using in-memory session store. Sessions will reset on server restart.\n');

// ─────────────────────────────────────────────────────────────
// Core Middleware
// ─────────────────────────────────────────────────────────────

// CORS must be first — before body parsers and session — so that
// pre-flight OPTIONS requests and cross-origin credentials work.
// CORS configuration
// Allow specifying a single origin or a comma-separated list via
// the ALLOWED_ORIGIN environment variable. If not set, we fall
// back to the previous behaviour (reflect the origin).
const allowedOriginEnv = process.env.ALLOWED_ORIGIN || '';
const allowedOrigins = allowedOriginEnv.split(',').map(s => s.trim()).filter(Boolean);

if (allowedOrigins.length > 0) {
  app.use(cors({
    origin: (origin, callback) => {
      // Allow non-browser tools (Postman, curl) with no origin
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
      return callback(new Error('CORS policy: Origin not allowed'));
    },
    credentials: true,
  }));
} else {
  // No ALLOWED_ORIGIN configured — reflect the request origin (previous behaviour)
  app.use(cors({ origin: true, credentials: true }));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// File uploads — max 5 MB, buffer in memory
app.use(fileUpload({
  limits:       { fileSize: 5 * 1024 * 1024 },
  abortOnLimit: true,
  useTempFiles: false,
}));

// Session
// IMPORTANT: sameSite:'none' REQUIRES secure:true — even on localhost browsers
// will silently drop the cookie if secure is false.  We use 'lax' in all
// environments; this works perfectly as long as the app is opened via
// http://localhost:5000 (same origin as the API).  Never open via Live Server.
const isProduction = process.env.NODE_ENV === 'production';
const sessionConfig = {
  secret:            process.env.SESSION_SECRET || 'dev_fallback_secret_change_in_prod',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   isProduction, // true (HTTPS) in production only
    httpOnly: true,
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax',        // 'lax' is safe on same-origin (localhost:5000)
  },
};
if (sessionStore) sessionConfig.store = sessionStore;
app.use(session(sessionConfig));

// ─────────────────────────────────────────────────────────────
// Static Files — serve frontend
// ─────────────────────────────────────────────────────────────
const frontendDir = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendDir));

// ─────────────────────────────────────────────────────────────
// Health check — useful to confirm the server is alive
// ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'SocialSphere API is running.',
    env: {
      supabase_url:     !!process.env.SUPABASE_URL,
      supabase_anon:    !!process.env.SUPABASE_ANON_KEY,
      supabase_service: !!process.env.SUPABASE_SERVICE_KEY,
      database_url:     !!process.env.DATABASE_URL,
      session_secret:   !!process.env.SESSION_SECRET,
    },
  });
});

// ─────────────────────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/posts',    postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/like',     likeRoutes);
app.use('/api/follow',   followRoutes);

// ─────────────────────────────────────────────────────────────
// Catch-all: serve the requested .html file, fall back to index.html
// ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: 'API route not found.' });
  }

  // Try to serve the exact file requested (e.g. /feed.html, /profile.html)
  const requestedFile = path.join(frontendDir, req.path);
  if (fs.existsSync(requestedFile) && fs.statSync(requestedFile).isFile()) {
    return res.sendFile(requestedFile);
  }

  // Fall back to index.html for SPA-style navigation
  const indexPath = path.join(frontendDir, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);

  return res.status(404).json({ success: false, message: 'Not found.' });
});

// ─────────────────────────────────────────────────────────────
// Global Error Handler
// ─────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[Server] Unhandled error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ─────────────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('═════════════════════════════════════════');
  console.log(`  ✅  SocialSphere is running!`);
  console.log(`  🌐  Open → http://localhost:${PORT}`);
  console.log(`  🔌  API  → http://localhost:${PORT}/api`);
  console.log(`  💊  Test → http://localhost:${PORT}/api/health`);
  console.log('═════════════════════════════════════════\n');
});
