/**
 * config/db.js
 * SOCIAL@sphere2/
 * Supabase client — used for all database queries (service-role key
 * bypasses Row Level Security so the backend has full access).
 *
 * The regular anon client is also exported for auth operations.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY    = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
  console.error('[DB] ❌  Missing Supabase environment variables.');
  console.error('       Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

/**
 * Service-role client — bypasses RLS.
 * Use this for all server-side database operations.
 */
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

/**
 * Anon client — used only for Supabase Auth sign-in / sign-up calls.
 */
const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

/**
 * Small helper — throws a readable error if a Supabase query fails.
 * @param {object} result - { data, error } returned by supabase query
 * @param {string} [context]
 */
function assertOk({ data, error }, context = '') {
  if (error) {
    console.error(`[DB] Query error${context ? ` (${context})` : ''}:`, error.message);
    throw new Error(error.message);
  }
  return data;
}

module.exports = { supabase, supabaseAuth, assertOk };
