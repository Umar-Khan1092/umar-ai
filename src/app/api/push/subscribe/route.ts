import { NextResponse } from 'next/server';
import { adminSupabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { subscription } = await req.json();
    
    // Validate FCM token
    if (!subscription?.fcm_token) {
      return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 });
    }
    
    const newToken = subscription.fcm_token;
    
    // Reject legacy FCM v1 tokens (https://fcm.googleapis.com/...) - they are permanently deprecated
    if (newToken.startsWith('https://')) {
      console.warn('[PUSH/SUBSCRIBE] Rejected legacy FCM v1 URL token:', newToken.substring(0, 50));
      return NextResponse.json({ error: 'Legacy FCM URL tokens are not supported. Please update the app.' }, { status: 400 });
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
        console.log(`[PUSH/SUBSCRIBE] Registering token for user=${userId?.substring(0,8)} role=${role} token=${newToken.substring(0,30)}...`);
      }
    }

    if (!adminSupabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    // If we know the user, delete their old tokens first to prevent stale token buildup.
    // Each user should only have ONE active native FCM token at a time.
    if (userId) {
      const { data: existingTokens } = await adminSupabase
        .from('push_subscriptions')
        .select('id, endpoint')
        .eq('user_id', userId)
        .neq('endpoint', newToken); // Keep the NEW token if already present
      
      if (existingTokens && existingTokens.length > 0) {
        const staleIds = existingTokens.map((t: any) => t.id);
        console.log(`[PUSH/SUBSCRIBE] Deleting ${staleIds.length} old tokens for user ${userId?.substring(0,8)}`);
        await adminSupabase.from('push_subscriptions').delete().in('id', staleIds);
      }
    }
    
    // Upsert the new subscription using the FCM token as the unique endpoint
    const { error } = await adminSupabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        role: role,
        endpoint: newToken,
        auth_keys: { type: 'fcm' }
      }, { onConflict: 'endpoint' });
      
    if (error) throw error;
    
    console.log(`[PUSH/SUBSCRIBE] ✓ Token registered successfully for user=${userId?.substring(0,8)} role=${role}`);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[PUSH/SUBSCRIBE] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
