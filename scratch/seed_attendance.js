const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = 'c:\\umar-ai\\.env.local';
const envFile = fs.readFileSync(envPath, 'utf8');
let url = '', key = '';
envFile.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].trim();
});

const supabase = createClient(url, key);

async function seedAttendance() {
  console.log('Fetching students...');
  const { data: students, error: stuErr } = await supabase.from('students').select('id, academic_class, section');
  if (stuErr) {
    console.error('Error fetching students:', stuErr);
    return;
  }
  
  if (!students || students.length === 0) {
    console.log('No students found. Skipping seeding.');
    return;
  }
  
  console.log(`Found ${students.length} students. Generating attendance...`);
  
  const today = new Date();
  const dates = [];
  for (let i = 0; i < 60; i++) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    if (d.getDay() !== 0) { // Skip Sundays
      dates.push(d.toISOString().split('T')[0]);
    }
  }
  
  console.log(`Generating flat attendance for ${dates.length} days...`);
  
  const recordsToInsert = [];
  
  for (const date of dates) {
    for (const st of students) {
      const rand = Math.random();
      let status = 'Present';
      if (rand > 0.95) status = 'Leave';
      else if (rand > 0.85) status = 'Absent';
      
      recordsToInsert.push({
        student_id: st.id,
        date: date,
        academic_class: st.academic_class || 'Unknown',
        section: st.section || 'Unknown',
        status: status,
        is_locked: true,
        created_at: new Date(date).toISOString()
      });
    }
  }
  
  console.log(`Total attendance records to insert: ${recordsToInsert.length}`);
  
  const CHUNK_SIZE = 1000;
  for (let i = 0; i < recordsToInsert.length; i += CHUNK_SIZE) {
    const chunk = recordsToInsert.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from('student_attendance').insert(chunk);
    if (error) {
      console.error(`Error inserting chunk ${i/CHUNK_SIZE}:`, error.message);
    } else {
      console.log(`Inserted chunk ${i/CHUNK_SIZE + 1} (${chunk.length} records)`);
    }
  }
  
  console.log('Finished seeding attendance!');
}

seedAttendance();
