const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('execute_sql', {
    query: 'ALTER TABLE public.staff_attendance ADD COLUMN IF NOT EXISTS marked_by_teacher BOOLEAN DEFAULT FALSE;'
  });
  console.log('Result:', data, error);
}

run();
