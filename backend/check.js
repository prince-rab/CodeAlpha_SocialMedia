/**
 * check.js — Startup diagnostic script.
 * Run: node check.js  (from the backend/ folder)
 * Checks all env vars and tests Supabase connectivity.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const vars = {
  SUPABASE_URL:         process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY:    process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
  DATABASE_URL:         process.env.DATABASE_URL,
  SESSION_SECRET:       process.env.SESSION_SECRET,
  PORT:                 process.env.PORT || '5000 (default)',
};

console.log('\n════════════════════════════════════════');
console.log('  SocialSphere — Startup Diagnostic');
console.log('════════════════════════════════════════');

let allOk = true;
for (const [key, val] of Object.entries(vars)) {
  const ok = !!val;
  if (!ok) allOk = false;
  const display = (key === 'SUPABASE_SERVICE_KEY' || key === 'DATABASE_URL')
    ? (val ? val.substring(0, 30) + '...' : 'MISSING')
    : (val || 'MISSING');
  console.log(`  ${ok ? '✅' : '❌'} ${key}: ${display}`);
}

console.log('════════════════════════════════════════');

if (!allOk) {
  console.log('\n  ⚠️  Some variables are MISSING from .env\n');
  process.exit(1);
}

// Test Supabase connection
console.log('\n  Testing Supabase connection...');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

(async () => {
  // Try to query profiles table
  const { data, error } = await supabase.from('profiles').select('id').limit(1);

  if (error) {
    if (error.code === '42P01') {
      console.log('\n  ❌  TABLE MISSING: public.profiles does not exist.');
      console.log('  ➜  Run backend/database/01_schema.sql in Supabase SQL Editor!');
      console.log('  ➜  Then run backend/database/02_rls_policies.sql\n');
    } else {
      console.log('\n  ❌  Supabase error:', error.message);
      console.log('  ➜  Check your SUPABASE_URL and SUPABASE_SERVICE_KEY in .env\n');
    }
    process.exit(1);
  }

  console.log('  ✅  Supabase connected! profiles table exists.');
  console.log(`  ✅  Found ${data.length} profile row(s).\n`);

  // Test auth table access
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.log('  ⚠️  Auth admin check failed:', authError.message);
  } else {
    console.log(`  ✅  Auth users: ${authUsers.users?.length || 0} registered user(s).`);
  }

  console.log('\n  🚀  Everything looks good! Run: npm run dev\n');
  process.exit(0);
})();
