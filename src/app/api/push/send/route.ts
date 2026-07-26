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

    const isValidUUID = (uuid: string) => {
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
    };

    // Resolve any student/staff/parent IDs to their corresponding push subscription user IDs
    let resolvedUserIds: string[] = [];
    console.log(`[PUSH/SEND] Incoming request userIds: ${JSON.stringify(userIds)}, roles: ${JSON.stringify(roles)}`);
    if (userIds && userIds.length > 0) {
      const studentIdsToLookup: string[] = [];
      const staffIdsToLookup: string[] = [];

      userIds.forEach((id: string) => {
        if (id.startsWith('parent_')) {
          const actualId = id.replace('parent_', '');
          if (isValidUUID(actualId)) {
            studentIdsToLookup.push(actualId);
          }
        } else if (id.startsWith('staff_')) {
          const actualId = id.replace('staff_', '');
          if (isValidUUID(actualId)) {
            staffIdsToLookup.push(actualId);
          }
        } else if (isValidUUID(id)) {
          resolvedUserIds.push(id);
          // Standard raw UUID might be a student_id or staff_id, so lookup too just in case
          studentIdsToLookup.push(id);
          staffIdsToLookup.push(id);
        }
      });

      console.log(`[PUSH/SEND] studentIdsToLookup: ${JSON.stringify(studentIdsToLookup)}`);
      console.log(`[PUSH/SEND] staffIdsToLookup: ${JSON.stringify(staffIdsToLookup)}`);

      // 1. Resolve student IDs to their guardian_id (parent Auth ID)
      if (studentIdsToLookup.length > 0) {
        const { data: studentRecords, error: studErr } = await adminSupabase
          .from('students')
          .select('id, guardian_id')
          .in('id', studentIdsToLookup);
        
        if (studErr) {
          console.error(`[PUSH/SEND] Student lookup DB error:`, studErr);
        }
        console.log(`[PUSH/SEND] Student records resolved: ${JSON.stringify(studentRecords)}`);
        
        if (studentRecords) {
          studentRecords.forEach((s: any) => {
            if (s.guardian_id && isValidUUID(s.guardian_id)) {
              resolvedUserIds.push(s.guardian_id);
            }
          });
        }
      }

      // 2. Resolve staff IDs to their Auth user_id via username (email)
      if (staffIdsToLookup.length > 0) {
        const { data: staffRecords, error: staffErr } = await adminSupabase
          .from('staff')
          .select('id, username')
          .in('id', staffIdsToLookup);
        
        if (staffErr) {
          console.error(`[PUSH/SEND] Staff lookup DB error:`, staffErr);
        }
        console.log(`[PUSH/SEND] Staff records resolved: ${JSON.stringify(staffRecords)}`);
        
        if (staffRecords && staffRecords.length > 0) {
          const emails = staffRecords.map((s: any) => s.username).filter(Boolean);
          if (emails.length > 0) {
            // Fetch auth users to map their emails to auth IDs
            const { data: authUsers, error: authErr } = await adminSupabase.auth.admin.listUsers();
            if (authErr) {
              console.error(`[PUSH/SEND] Auth listUsers error:`, authErr);
            }
            if (authUsers && authUsers.users) {
              authUsers.users.forEach((u: any) => {
                if (u.email && emails.includes(u.email) && isValidUUID(u.id)) {
                  resolvedUserIds.push(u.id);
                }
              });
            }
          }
        }
      }

      // Deduplicate resolved IDs and make sure they are all clean UUIDs
      resolvedUserIds = Array.from(new Set(resolvedUserIds)).filter(isValidUUID);
      console.log(`[PUSH/SEND] Final resolvedUserIds to fetch tokens: ${JSON.stringify(resolvedUserIds)}`);
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
      console.log(`[PUSH/SEND] No subscriptions found for resolvedUserIds=${JSON.stringify(resolvedUserIds)} roles=${JSON.stringify(roles)}`);
      return NextResponse.json({ success: true, sent: 0, debug: 'no_subscriptions_found' });
    }

    // Extract FCM tokens from subscriptions
    // CRITICAL: Filter out legacy v1 URLs (https://fcm.googleapis.com/fcm/send/...) — these are permanently deprecated
    const allTokens = subscriptions.map((sub: any) => sub.endpoint).filter(Boolean);
    const fcmTokens = allTokens.filter((t: string) => !t.startsWith('https://'));
    const legacyTokensFound = allTokens.filter((t: string) => t.startsWith('https://'));
    
    if (legacyTokensFound.length > 0) {
      console.warn(`[PUSH/SEND] Found ${legacyTokensFound.length} legacy FCM v1 tokens (deprecated). Auto-deleting...`);
      // Auto-delete legacy tokens from database
      await adminSupabase!.from('push_subscriptions').delete().in('endpoint', legacyTokensFound);
    }

    console.log(`[PUSH/SEND] Dispatching to ${fcmTokens.length} valid FCM tokens (${legacyTokensFound.length} legacy tokens deleted)`);

    if (fcmTokens.length === 0) {
      return NextResponse.json({ success: true, sent: 0, debug: 'all_tokens_were_legacy_format' });
    }

    // Dispatch via Firebase Admin SDK
    // CRITICAL: Android payload must include all fields for background/killed-app delivery
    const fcmMessage = {
      notification: {
        title: displayTitle,
        body: finalMessage,
      },
      android: {
        priority: 'high' as const,
        ttl: 86400, // Deliver for up to 24 hours even if device is offline
        notification: {
          channelId: 'high_priority_alerts',
          sound: 'default',
          defaultVibrateTimings: true,
          visibility: 'public' as const,
        }
      },
      data: {
        url: url || '/',
        category: category || 'general',
        title: displayTitle,
        body: finalMessage,
      },
      tokens: fcmTokens
    };

    console.log(`[PUSH/SEND] FCM Payload: ${JSON.stringify({ title: displayTitle, tokens: fcmTokens.length, channelId: 'high_priority_alerts' })}`);
    
    const fcmResponse = await getMessaging().sendEachForMulticast(fcmMessage);
    
    console.log(`[PUSH/SEND] FCM Response: successCount=${fcmResponse.successCount} failureCount=${fcmResponse.failureCount}`);
    
    // Cleanup invalid FCM tokens
    const failedTokens: string[] = [];
    fcmResponse.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const errCode = resp.error?.code;
        console.error(`[PUSH/SEND] Token ${fcmTokens[idx]?.substring(0,30)}... failed: code=${errCode} msg=${resp.error?.message}`);
        if (errCode === 'messaging/invalid-registration-token' || errCode === 'messaging/registration-token-not-registered') {
          failedTokens.push(fcmTokens[idx]);
        }
      } else {
        console.log(`[PUSH/SEND] ✓ Token ${fcmTokens[idx]?.substring(0,30)}... delivered. MessageID=${resp.messageId}`);
      }
    });

    if (failedTokens.length > 0) {
      console.log(`[PUSH/SEND] Deleting ${failedTokens.length} stale tokens from database`);
      // Delete invalid tokens from Supabase
      await adminSupabase!.from('push_subscriptions').delete().in('endpoint', failedTokens);
    }

    return NextResponse.json({ 
      success: true, 
      sent: fcmResponse.successCount,
      failed: fcmResponse.failureCount,
      recipients: resolvedUserIds.length,
      tokens_tested: fcmTokens.length,
    });
  } catch (err: any) {
    console.error('[PUSH/SEND] Fatal error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
