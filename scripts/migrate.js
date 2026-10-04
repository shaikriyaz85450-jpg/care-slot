const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

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

async function runMigration() {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;

  const migrationFile = path.join(__dirname, '..', 'supabase', 'migrations', '20261004000001_initial_schema.sql');
  const sql = fs.readFileSync(migrationFile, 'utf8');

  if (!dbUrl) {
    console.log('No direct PostgreSQL connection string (DATABASE_URL / POSTGRES_URL) found in .env.local.');
    console.log('You can either:');
    console.log('1. Run this SQL in your Supabase Dashboard SQL Editor (https://supabase.com/dashboard/project/ahpzissqbxgkrmxmewwv/sql/new)');
    console.log('2. Or set DATABASE_URL in .env.local and re-run "node scripts/migrate.js"');
    process.exit(1);
  }

  console.log('Connecting to PostgreSQL database...');
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected successfully. Executing migration...');
    await client.query(sql);
    console.log('Migration executed successfully!');

    // Verify created tables
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('Public tables in database:', res.rows.map(r => r.table_name));

    // Verify partial unique index for double-booking
    const indexRes = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'appointments' AND indexname = 'idx_appointments_double_booking';
    `);
    console.log('Double booking index verified:', indexRes.rows);

  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
