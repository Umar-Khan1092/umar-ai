const { createClient } = require('@supabase/supabase-js');

const url = 'https://jbsnmudnvyrbwouqlrjv.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impic25tdWRudnlyYndvdXFscmp2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Njk2MDU2NiwiZXhwIjoyMTAyNTM2NTY2fQ.aFXYlnV2ct58s4N3gwpJzg59J1NkDRkoy3zV6Tws_Zk';

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function run() {
  // Check existing columns
  const { data, error } = await supabase.from('staff_attendance').select('*').limit(1);
  if (data) {
    const cols = Object.keys(data[0] || {});
    console.log('Existing columns:', cols.join(', '));
    if (!cols.includes('marked_by_teacher')) {
      console.log('Column missing - need to add via Supabase dashboard SQL editor');
      console.log('SQL: ALTER TABLE public.staff_attendance ADD COLUMN IF NOT EXISTS marked_by_teacher BOOLEAN DEFAULT FALSE;');
    } else {
      console.log('Column already exists!');
    }
  }
  if (error) console.error('Error:', error.message);
}

run();
