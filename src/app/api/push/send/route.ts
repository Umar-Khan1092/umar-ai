import { NextResponse } from 'next/server';
import { adminSupabase } from '@/lib/supabase';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import path from 'path';
import fs from 'fs';

// Initialize Firebase Admin
if (!getApps().length) {
  try {
    if (process.env.FIREBASE_PRIVATE_KEY) {
      initializeApp({
        credential: cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          // Handle newline characters in the private key when loaded from Vercel ENV
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      const credentialsPath = path.join(process.cwd(), process.env.FIREBASE_ADMIN_CREDENTIALS_PATH || 'edu-erp-system-firebase-adminsdk.json');
      if (fs.existsSync(credentialsPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
        initializeApp({
          credential: cert(serviceAccount)
        });
      } else {
        console.warn('Firebase Admin SDK: No FIREBASE_PRIVATE_KEY env var and no local JSON credentials found. Push notifications will fail.');
      }
    }
  } catch (err) {
    console.error('Failed to initialize Firebase Admin SDK:', err);
  }
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
    
    // ── Generate Context-Aware Titles/Subtitles ──
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

    // Dynamic Notification Branding: Prefix the title with the school name
    const displayTitle = `${schoolName} - ${finalTitle}`;

    // Build the query to get subscriptions
    let query = adminSupabase.from('push_subscriptions').select('*');
    
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

    // Log the notification in history unless skipped
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

        // Legacy Sync: Insert into legacy notifications table so they appear in portal in-app lists
        const legacyNotifications: any[] = [];
        if (userIds && userIds.length > 0) {
          userIds.forEach((id: string) => {
            legacyNotifications.push({
              recipient_id: id,
              target_role: roles && roles.length > 0 ? roles[0] : 'Guardian',
              sender_role: 'Admin',
              title: displayTitle,
              message: finalMessage,
              student_id: id.startsWith('parent_') ? id.replace('parent_', '') : id
            });
          });
        } else if (roles && roles.length > 0) {
          roles.forEach((r: string) => {
            legacyNotifications.push({
              target_role: r === 'Guardian' ? 'Guardian' : 'Teacher',
              sender_role: 'Admin',
              title: displayTitle,
              message: finalMessage
            });
          });
        } else {
          // Broadcast to both
          legacyNotifications.push({
            target_role: 'Teacher',
            sender_role: 'Admin',
            title: displayTitle,
            message: finalMessage
          });
          legacyNotifications.push({
            target_role: 'Guardian',
            sender_role: 'Admin',
            title: displayTitle,
            message: finalMessage
          });
        }
        if (legacyNotifications.length > 0) {
          await adminSupabase.from('notifications').insert(legacyNotifications);
        }
      }
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    // Extract FCM tokens from subscriptions
    const fcmTokens = subscriptions.map((sub: any) => sub.endpoint).filter(Boolean);

    if (fcmTokens.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    // Dispatch via Firebase Admin SDK
    const fcmMessage = {
      notification: {
        title: displayTitle,
        body: finalMessage,
      },
      android: {
        priority: 'high' as const,
        notification: {
          channelId: 'high_priority_alerts',
          sound: 'default'
        }
      },
      data: {
        url: url || '/',
        category: category || 'general'
      },
      tokens: fcmTokens
    };

    const fcmResponse = await getMessaging().sendEachForMulticast(fcmMessage);
    
    // Cleanup invalid FCM tokens
    const failedTokens: string[] = [];
    fcmResponse.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const errCode = resp.error?.code;
        if (errCode === 'messaging/invalid-registration-token' || errCode === 'messaging/registration-token-not-registered') {
          failedTokens.push(fcmTokens[idx]);
        } else {
          console.error('FCM Send Error for token:', fcmTokens[idx], resp.error);
        }
      }
    });

    if (failedTokens.length > 0) {
      // Delete invalid tokens from Supabase
      await adminSupabase.from('push_subscriptions').delete().in('endpoint', failedTokens);
    }

    return NextResponse.json({ success: true, sent: fcmResponse.successCount });
  } catch (err: any) {
    console.error('FCM push error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
