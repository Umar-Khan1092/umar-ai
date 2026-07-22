import { NextResponse } from 'next/server';
import { adminSupabase } from '@/lib/supabase';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const subscription = await req.json();
    
    // Get the authenticated user
    const cookieStore = cookies();
    const supabaseClient = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    const role = session.user.user_metadata?.role || 'User';

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
