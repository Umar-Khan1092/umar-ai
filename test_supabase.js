// Quick test: verify Supabase connection and settings table access
// Run: node test_supabase.js

const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhY3Jkanl0ZnlqaGx6dXp6eWl6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDM5MjU1MiwiZXhwIjoyMDk5OTY4NTUyfQ.t8Dv-dBCCh_meHwCzGisnCxEDvmyGYGxVE63O9iQRss';
const url = 'https://cacrdjytfyjhlzuzzyiz.supabase.co';

async function test() {
  // Test with service role key (bypasses RLS)
  const res = await fetch(`${url}/rest/v1/settings?key=eq.app_settings&select=key,value`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await res.json();
  console.log('Status:', res.status);
  console.log('Data:', JSON.stringify(data).slice(0, 200));

  // Test upsert
  const res2 = await fetch(`${url}/rest/v1/settings`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify({ key: 'app_settings', value: { test: true } })
  });
  console.log('Upsert status:', res2.status);
  const d2 = await res2.text();
  console.log('Upsert response:', d2.slice(0, 200));
}

test().catch(console.error);
