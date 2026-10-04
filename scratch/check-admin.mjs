import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const idx = trimmed.indexOf('=');
  if (idx !== -1) {
    const k = trimmed.slice(0, idx).trim();
    let v = trimmed.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
});

console.log('SUPABASE_URL:', env.NEXT_PUBLIC_SUPABASE_URL);
console.log('KEY prefix:', env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 10));

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function checkAdmin() {
  const { data: adminProfiles, error: pErr } = await supabase
    .from('profiles')
    .select('*');
  console.log('All profiles count:', adminProfiles?.length, 'error:', pErr);
  if (adminProfiles) {
    adminProfiles.forEach(p => console.log('Profile:', p.id, p.full_name, p.role));
  }

  const { data, error: uErr } = await supabase.auth.admin.listUsers();
  console.log('Users error:', uErr);
  if (data?.users) {
    data.users.forEach(u => console.log('User:', u.id, u.email, u.user_metadata));
  }
}

checkAdmin();
