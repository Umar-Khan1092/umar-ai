import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This endpoint uses the server-side service role key (no NEXT_PUBLIC_ prefix)
// which is only available server-side, safe for admin operations
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, password, role, name } = body;

  if (!email || !password || !role) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    // Graceful degradation — skip auth user creation, student/staff still saved
    return NextResponse.json({ error: 'SERVICE_KEY_MISSING', graceful: true }, { status: 200 });
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, name, username: email },
    });

    if (error) {
      // If user already exists, treat as success so the caller can fetch their ID
      if (error.message.toLowerCase().includes('already') || error.message.includes('already registered')) {
        // Try to find existing user
        const { data: list } = await adminClient.auth.admin.listUsers();
        const found = list?.users?.find((u) => u.email === email);
        return NextResponse.json({ user: found ?? null, alreadyExists: true });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ user: data.user });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
