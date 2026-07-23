const url = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/?apikey=' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

fetch(url)
  .then(res => res.json())
  .then(data => {
    // Some versions of PostgREST use components.schemas instead of definitions
    const schemas = data.definitions || (data.components && data.components.schemas);
    if (!schemas) {
        console.log('No schemas found in swagger doc');
        return;
    }
    const table = schemas['attendance'];
    if (table) {
      console.log('Attendance Columns:', Object.keys(table.properties));
    } else {
      console.log('Table attendance not found in schema');
      console.log('Available tables:', Object.keys(schemas));
    }
  })
  .catch(console.error);
