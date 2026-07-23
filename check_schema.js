const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase.from('attendance').select('*').limit(1);
  console.log('Error:', error);
  console.log('Data:', data);
  if (data && data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
  }
}

checkSchema();
