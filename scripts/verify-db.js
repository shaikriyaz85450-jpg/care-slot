const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local manually
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  });
}

loadEnv();

async function verifyDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    console.error('Missing Supabase URL or Public Key in .env.local');
    process.exit(1);
  }

  console.log(`Connecting to Supabase at: ${url}`);
  const supabase = createClient(url, key);

  const tables = [
    'profiles',
    'departments',
    'doctors',
    'doctor_schedules',
    'doctor_daily_status',
    'appointments',
    'notifications'
  ];

  console.log('\nChecking table accessibility via PostgREST API:');
  let missing = [];
  let found = [];

  for (const table of tables) {
    const { data, error, status } = await supabase.from(table).select('*').limit(1);
    if (error && error.code === 'PGRST205') {
      console.log(`❌ Table '${table}': NOT FOUND in database schema cache.`);
      missing.push(table);
    } else if (error) {
      console.log(`⚠️ Table '${table}': Accessible (Status ${status} - ${error.message})`);
      found.push(table);
    } else {
      console.log(`✅ Table '${table}': Exists & Accessible (0 or more rows returned)`);
      found.push(table);
    }
  }

  console.log(`\nSummary: ${found.length}/${tables.length} tables verified.`);
  if (missing.length > 0) {
    console.log(`Missing tables: ${missing.join(', ')}`);
    return false;
  }
  return true;
}

verifyDatabase().then(ok => {
  if (!ok) process.exit(1);
  console.log('All 7 tables verified successfully!');
});
