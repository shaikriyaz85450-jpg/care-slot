import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

async function testLogins() {
  const emails = [
    'doctor@gmail.com',
    'riyaz@gmail.com',
    'admin@gmail.com',
    'admin@careslot.com',
    'admin@hospital.org',
    'admin@admin.com',
    'kavya@gmail.com',
    'test@gmail.com',
    'admin.office@hospital.org'
  ];
  const passwords = ['123456', 'Password123!', 'admin123', 'admin', 'password', '12345678'];

  for (const email of emails) {
    for (const pwd of passwords) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd });
        if (data?.user) {
          console.log('SUCCESS:', email, pwd, 'UID:', data.user.id);
          const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
          console.log('  Profile:', p);
          break;
        }
      } catch (e) {
        // ignore
      }
    }
  }
}
testLogins();
