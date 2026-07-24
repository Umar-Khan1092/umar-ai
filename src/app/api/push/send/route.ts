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

    // Resolve any student/staff/parent IDs to their corresponding push subscription user IDs
    let resolvedUserIds: string[] = [];
    if (userIds && userIds.length > 0) {
      resolvedUserIds = [...userIds];
      
      const studentIdsToLookup: string[] = [];
      const staffIdsToLookup: string[] = [];

      userIds.forEach((id: string) => {
        if (id.startsWith('parent_')) {
          studentIdsToLookup.push(id.replace('parent_', ''));
        } else {
          studentIdsToLookup.push(id);
          staffIdsToLookup.push(id);
        }
      });

      // 1. Resolve student IDs to their guardian_id (parent Auth ID)
      if (studentIdsToLookup.length > 0) {
        const { data: studentRecords } = await adminSupabase
          .from('students')
          .select('id, guardian_id')
          .in('id', studentIdsToLookup);
        
        if (studentRecords) {
          studentRecords.forEach((s: any) => {
            if (s.guardian_id) {
              resolvedUserIds.push(s.guardian_id);
            }
          });
        }
      }

      // 2. Resolve staff IDs to their Auth user_id via username (email)
      if (staffIdsToLookup.length > 0) {
        const { data: staffRecords } = await adminSupabase
          .from('staff')
          .select('id, username')
          .in('id', staffIdsToLookup);
        
        if (staffRecords && staffRecords.length > 0) {
          const emails = staffRecords.map((s: any) => s.username).filter(Boolean);
          if (emails.length > 0) {
            // Fetch auth users to map their emails to auth IDs
            const { data: authUsers } = await adminSupabase.auth.admin.listUsers();
            if (authUsers && authUsers.users) {
              authUsers.users.forEach((u: any) => {
                if (u.email && emails.includes(u.email)) {
                  resolvedUserIds.push(u.id);
                }
              });
            }
          }
        }
      }
    }

    // Fetch settings for dynamic branding
    const { data: settingsRes } = await adminSupabase.from('settings').select('*').eq('key', 'app_settings').maybeSingle();
    const settings = settingsRes?.value || {};
    const schoolName = settings.institute_name || 'School ERP';
    const schoolLogo = settings.institute_logo || '/logo.webp';

    // ── Generate Context-Aware Titles/Subtitles (Task 2) ──
    let finalTitle = title;
    let finalMessage = message;
    const lowerTitle = title.toLowerCase();
    const lowerMsg = message.toLowerCase();
    const cat = (category || '').toLowerCase();

    if (lowerTitle.includes('invoice') || (cat === 'finance' && lowerTitle.includes('new fee'))) {
      finalTitle = '📄 Fee Invoice Generated';
      if (message.includes('invoice has been generated') || message.length < 25) {
        finalMessage = 'A new fee invoice is ready for your review. Please visit the Fees tab in your portal.';
      }
    } else if (lowerTitle.includes('confirmed') || lowerTitle.includes('received') || (cat === 'finance' && (lowerTitle.includes('payment') || lowerMsg.includes('received')))) {
      finalTitle = '✅ Fee Payment Confirmed';
    } else if (lowerTitle.includes('result') || lowerTitle.includes('report card') || cat === 'results') {
      finalTitle = '🏆 Exam Results Published';
      if (message.length < 25) {
        finalMessage = 'The latest academic results have been published. Check your Academics tab to view the report card.';
      }
    } else if (lowerTitle.includes('attendance') && (lowerTitle.includes('marked') || lowerMsg.includes('recorded') || lowerMsg.includes('marked'))) {
      finalTitle = '📅 Attendance Recorded';
    } else if (lowerTitle.includes('attendance') && (lowerTitle.includes('reminder') || lowerMsg.includes('submit'))) {
      finalTitle = '🔔 Attendance Submission Reminder';
    } else if (lowerTitle.includes('remark') || lowerTitle.includes('behavior') || lowerMsg.includes('remark')) {
      finalTitle = '📝 New Teacher Remark';
    } else if (lowerTitle.includes('parent') && (lowerTitle.includes('message') || lowerTitle.includes('contact') || cat === 'chat')) {
      finalTitle = '💬 New Parent Message';
    } else if (lowerTitle.includes('teacher') && (lowerTitle.includes('message') || cat === 'chat')) {
      finalTitle = '💬 New Teacher Message';
    } else if (cat === 'announcements' || lowerTitle.includes('announcement') || lowerTitle.includes('notice')) {
      finalTitle = '📢 Administrative Notice';
    } else if (lowerTitle.includes('exam') || lowerTitle.includes('date sheet') || lowerTitle.includes('schedule')) {
      finalTitle = '📅 Exam Schedule Published';
    } else if (lowerTitle.includes('homework') || lowerMsg.includes('homework')) {
      finalTitle = '📚 New Homework Assigned';
    } else if (lowerTitle.includes('leave') && lowerTitle.includes('request')) {
      finalTitle = '✉️ Leave Request Submitted';
    } else if (lowerTitle.includes('approval') || lowerMsg.includes('approval')) {
      finalTitle = '🔒 Approval Required';
    }

    // Dynamic Notification Branding (Task 1): Prefix the title with the school name
    const displayTitle = `${schoolName} - ${finalTitle}`;

    // Build the query to get subscriptions
    let query = adminSupabase.from('push_subscriptions').select('*');
    
    // Fix target query (Task 4): Match both resolvedUserIds AND roles if both are supplied
    let filters: string[] = [];
    if (userIds && userIds.length > 0 && resolvedUserIds.length > 0) {
      filters.push(`user_id.in.(${resolvedUserIds.map((id: string) => `"${id}"`).join(',')})`);
    }
    if (roles && roles.length > 0) {
      filters.push(`role.in.(${roles.map((r: string) => `"${r}"`).join(',')})`);
    }

    if (filters.length > 0) {
      query = query.or(filters.join(','));
    }
    
    const { data: subscriptions, error: subError } = await query;
    if (subError) throw subError;

    // Log the notification in history unless skipped (Task 5: Save Admin notifications in Sent history)
    if (!skipHistory) {
      const historyPayload: any[] = [];
      if (userIds && userIds.length > 0) {
        userIds.forEach((id: string) => {
          historyPayload.push({
            recipient_id: id,
            category: category || 'Announcements',
            title: displayTitle,
            message: finalMessage,
            url
          });
        });
      } else if (roles && roles.length > 0) {
        roles.forEach((r: string) => {
          historyPayload.push({
            role: r,
            category: category || 'Announcements',
            title: displayTitle,
            message: finalMessage,
            url
          });
        });
      } else {
        // Broadcast to all
        historyPayload.push({
          category: category || 'Announcements',
          title: displayTitle,
          message: finalMessage,
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

    // Dynamic branding icon configuration (Task 1)
    const payload = JSON.stringify({
      title: displayTitle,
      message: finalMessage,
      url,
      icon: schoolLogo,
      schoolName: schoolName,
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
