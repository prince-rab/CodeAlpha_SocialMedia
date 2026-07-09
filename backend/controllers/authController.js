/**
 * controllers/authController.js
 * Registration, login, logout using Supabase Auth.
 *
 * Key fix: User is created in auth.users first. Then we insert
 * a matching row into public.profiles. If the profiles table
 * does not exist yet (SQL not run), we log the real error and
 * return a clear message instead of a generic 500.
 */

const { validationResult } = require('express-validator');
const User = require('../models/User');

// Safely load Supabase clients — won't crash if env vars are missing
let supabaseAuth, supabase;
try {
  const db = require('../config/db');
  supabaseAuth = db.supabaseAuth;
  supabase     = db.supabase;
} catch (e) {
  console.error('[Auth] Supabase not configured:', e.message);
}

/**
 * Wrap session.save() in a Promise so we can await it.
 */
function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save(err => {
      if (err) reject(err);
      else resolve();
    });
  });
}

const authController = {
  /**
   * POST /api/auth/register
   */
  async register(req, res) {
    // Guard — Supabase not configured
    if (!supabaseAuth) {
      return res.status(503).json({
        success: false,
        message: 'Server is not connected to Supabase. Check your .env file (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY).',
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, username, email, password } = req.body;

    try {
      // ── Step 1: Check username uniqueness ───────────────────
      const existing = await User.findByUsername(username);
      if (existing) {
        return res.status(409).json({ success: false, message: 'Username already taken.' });
      }

      // ── Step 2: Create Supabase Auth user ───────────────────
      const { data: authData, error: authError } = await supabaseAuth.auth.signUp({
        email,
        password,
        options: {
          data: { name, username },      // stored in auth.users.raw_user_meta_data
          emailRedirectTo: undefined,    // disable email confirmation redirect
        },
      });

      if (authError) {
        console.error('[Auth] signUp error:', authError.message);
        const msg = authError.message.toLowerCase().includes('already')
          ? 'Email already in use.'
          : authError.message;
        return res.status(409).json({ success: false, message: msg });
      }

      const userId = authData.user?.id;

      if (!userId) {
        // Email confirmation is required (Supabase setting)
        return res.status(200).json({
          success: true,
          confirmEmail: true,
          message: 'Account created! Please check your email inbox and confirm your address, then log in.',
        });
      }

      // ── Step 3: Create profile row in public.profiles ───────
      try {
        await User.create({ id: userId, name, username });
      } catch (profileErr) {
        // Profile insert failed — most likely the SQL hasn't been run yet.
        // Log the real reason, but DON'T block the user. Auth is done.
        console.error('[Auth] Profile insert failed:', profileErr.message);

        // Still set the session so auth works
        req.session.userId    = userId;
        req.session.userEmail = email;

        try { await saveSession(req); } catch (e) { /* session save failed but continue */ }

        return res.status(201).json({
          success: true,
          profileError: true,
          message: `Account created but profile setup failed: ${profileErr.message}. Please run the SQL setup scripts in Supabase (backend/database/01_schema.sql).`,
          user: { id: userId, name, username, email },
        });
      }

      // ── Step 4: Set session and return ──────────────────────
      req.session.userId    = userId;
      req.session.userEmail = email;

      // Await the session save before sending the response
      try {
        await saveSession(req);
      } catch (sessErr) {
        console.error('[Auth] Session save error:', sessErr.message);
        // Session save failed (DATABASE_URL wrong), but auth + profile are done.
        // User can still log in manually.
      }

      const profile = await User.findById(userId);

      return res.status(201).json({
        success: true,
        message: 'Account created successfully!',
        user: profile || { id: userId, name, username },
      });

    } catch (err) {
      console.error('[Auth] Register error:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Internal server error: ' + err.message,
      });
    }
  },

  /**
   * POST /api/auth/login
   */
  async login(req, res) {
    if (!supabaseAuth) {
      return res.status(503).json({
        success: false,
        message: 'Server is not connected to Supabase. Check your .env file.',
      });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.error('[Auth] signIn error:', authError.message);
        if (authError.message.toLowerCase().includes('email not confirmed')) {
          return res.status(401).json({
            success: false,
            message: 'Please confirm your email address before logging in. Check your inbox.',
          });
        }
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }

      const userId = authData.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Login failed. Please try again.' });
      }

      // ── Ensure profile row exists ────────────────────────────
      // It might be missing if the user registered before SQL was run.
      let profile = await User.findById(userId);
      if (!profile) {
        // Attempt to create profile from auth metadata
        try {
          const meta = authData.user.user_metadata || {};
          const uname = meta.username || email.split('@')[0];
          const uname_safe = uname.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 30) || 'user_' + userId.substring(0, 8);
          await User.create({
            id:       userId,
            name:     meta.name || uname_safe,
            username: uname_safe,
          });
          profile = await User.findById(userId);
        } catch (pErr) {
          console.error('[Auth] Auto-create profile failed:', pErr.message);
          // Profile creation failed but login can still proceed
        }
      }

      // ── Set session ──────────────────────────────────────────
      req.session.userId    = userId;
      req.session.userEmail = email;

      try {
        await saveSession(req);
      } catch (sessErr) {
        console.error('[Auth] Session save error:', sessErr.message);
      }

      return res.json({
        success: true,
        message: 'Logged in successfully.',
        user: profile || { id: userId },
      });

    } catch (err) {
      console.error('[Auth] Login error:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Internal server error: ' + err.message,
      });
    }
  },

  /**
   * POST /api/auth/logout
   */
  logout(req, res) {
    req.session.destroy(err => {
      if (err) return res.status(500).json({ success: false, message: 'Could not log out.' });
      res.clearCookie('connect.sid');
      return res.json({ success: true, message: 'Logged out successfully.' });
    });
  },

  /**
   * GET /api/auth/me
   */
  async me(req, res) {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }
    try {
      const profile = await User.findById(req.session.userId);
      if (!profile) {
        req.session.destroy(() => {});
        return res.status(401).json({ success: false, message: 'User profile not found. Please log in again.' });
      }
      return res.json({ success: true, user: profile });
    } catch (err) {
      console.error('[Auth] me error:', err.message);
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  },
};

module.exports = authController;
