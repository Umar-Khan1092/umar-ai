const { createClient } = require('@supabase/supabase-js');

const url = 'https://jbsnmudnvyrbwouqlrjv.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impic25tdWRudnlyYndvdXFscmp2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Njk2MDU2NiwiZXhwIjoyMTAyNTM2NTY2fQ.aFXYlnV2ct58s4N3gwpJzg59J1NkDRkoy3zV6Tws_Zk';

const supabase = createClient(url, key, { auth: { persistSession: false } });

// Use Postgres REST API directly
async function alterTable() {
  const response = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({ sql: 'ALTER TABLE public.staff_attendance ADD COLUMN IF NOT EXISTS marked_by_teacher BOOLEAN DEFAULT FALSE;' })
  });
  const text = await response.text();
  console.log('Response:', response.status, text);
}

alterTable().catch(console.error);
