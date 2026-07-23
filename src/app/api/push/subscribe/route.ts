import { NextResponse } from 'next/server';
import { adminSupabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const subscription = await req.json();
    
    // Validate required fields from the push subscription object
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 });
    }
    
    // Get user info from the Authorization header (the client will send the Supabase JWT)
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    let role: string = 'User';
    
    if (authHeader && adminSupabase) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await adminSupabase.auth.getUser(token);
      if (user) {
        userId = user.id;
        role = user.user_metadata?.role || 'User';
        
        // Map Teacher/Staff auth user to their staff table primary key
        if (role === 'Teacher' || role === 'Staff') {
          const { data: staffMember } = await adminSupabase
            .from('staff')
            .select('id')
            .eq('username', user.email || '')
            .maybeSingle();
          if (staffMember) {
            userId = staffMember.id;
          }
        }
      }
    }

    // Verify adminSupabase is available
    if (!adminSupabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    // Upsert the subscription (endpoint is UNIQUE)
    const { error } = await adminSupabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        role: role,
        endpoint: subscription.endpoint,
        auth_keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth
        }
      }, { onConflict: 'endpoint' });
      
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Subscription error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
