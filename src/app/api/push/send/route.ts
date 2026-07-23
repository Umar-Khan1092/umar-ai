import { NextResponse } from 'next/server';
import { adminSupabase } from '@/lib/supabase';
import webpush from 'web-push';

// Configure Web Push with VAPID keys
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:admin@umarerpsystem.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export async function POST(req: Request) {
  try {
    const { userIds, roles, title, message, url, category, skipHistory } = await req.json();

    // Basic Authorization check via JWT header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !adminSupabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminSupabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 });
    }

    // Build the query to get subscriptions
    let query = adminSupabase.from('push_subscriptions').select('*');
    
    if (userIds && userIds.length > 0) {
      query = query.in('user_id', userIds);
    } else if (roles && roles.length > 0) {
      query = query.in('role', roles);
    }
    
    const { data: subscriptions, error: subError } = await query;
    if (subError) throw subError;

    // Log the notification in history unless skipped
    if (!skipHistory) {
      const historyPayload: any[] = [];
      if (userIds && userIds.length > 0) {
        userIds.forEach((id: string) => {
          historyPayload.push({
            recipient_id: id,
            category: category || 'Announcements',
            title,
            message,
            url
          });
        });
      } else if (roles && roles.length > 0) {
        roles.forEach((r: string) => {
          historyPayload.push({
            role: r,
            category: category || 'Announcements',
            title,
            message,
            url
          });
        });
      } else {
        // Broadcast to all
        historyPayload.push({
          category: category || 'Announcements',
          title,
          message,
          url
        });
      }
      
      if (historyPayload.length > 0) {
        // Delete notifications older than 20 days
        const twentyDaysAgo = new Date();
        twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);
        await adminSupabase.from('notification_history').delete().lt('created_at', twentyDaysAgo.toISOString());

        await adminSupabase.from('notification_history').insert(historyPayload);
      }
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    const payload = JSON.stringify({
      title,
      message,
      url,
      icon: '/logo.webp',
      tag: category || 'general',
      category: category || 'general'
    });

    const sendPromises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: sub.auth_keys
      };
      
      try {
        await webpush.sendNotification(pushSubscription, payload, {
          headers: {
            'Urgency': 'high'
          },
          TTL: 86400
        });
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription has expired or is no longer valid, remove it
          await adminSupabase.from('push_subscriptions').delete().eq('id', sub.id);
        } else {
          console.error('Error sending push notification:', err);
        }
      }
    });

    await Promise.all(sendPromises);

    return NextResponse.json({ success: true, sent: subscriptions.length });
  } catch (err: any) {
    console.error('Send push error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
