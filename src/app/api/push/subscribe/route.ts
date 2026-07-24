import { NextResponse } from 'next/server';
import { adminSupabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { subscription } = await req.json();
    
    // Validate FCM token
    if (!subscription?.fcm_token) {
      return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 });
    }
    
    // Get user info from the Authorization header
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    let role: string = 'User';
    
    if (authHeader && adminSupabase) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await adminSupabase.auth.getUser(token);
      if (user) {
        userId = user.id;
        role = user.user_metadata?.role || 'User';
      }
    }

    if (!adminSupabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    // Upsert the subscription using the FCM token as the unique endpoint
    const { error } = await adminSupabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        role: role,
        endpoint: subscription.fcm_token, // Store FCM token as endpoint
        auth_keys: { type: 'fcm' } // Indicator that this is an FCM token
      }, { onConflict: 'endpoint' });
      
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Subscription error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
