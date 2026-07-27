import { NextResponse } from 'next/server';
import { adminSupabase } from '@/lib/supabase';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import path from 'path';
import fs from 'fs';

interface NotificationMetadata {
  studentName?: string;
  studentId?: string;
  className?: string;
  section?: string;
  amount?: string;
  month?: string;
  status?: string;
  subject?: string;
  senderName?: string;
  score?: string;
  examName?: string;
  date?: string;
  role?: string | null;
  fatherName?: string;
}

const NOTIFICATION_TEMPLATES: Record<string, (meta: NotificationMetadata, defaultTitle: string, defaultMessage: string) => { title: string; body: string; url: string }> = {
  Attendance: (meta, defTitle, defMsg) => {
    const studentPart = meta.studentName ? ` for ${meta.studentName}` : '';
    let statusPart = meta.status;
    if (!statusPart && defTitle) {
      const lowerT = defTitle.toLowerCase();
      if (lowerT.includes('absent')) statusPart = 'Absent';
      else if (lowerT.includes('leave')) statusPart = 'Leave';
      else if (lowerT.includes('present')) statusPart = 'Present';
    }
    statusPart = statusPart || 'Recorded';
    return {
      title: `📅 Attendance: ${statusPart}`,
      body: `Attendance${studentPart} was marked as ${statusPart} on ${meta.date || new Date().toLocaleDateString('en-GB')}.`,
      url: meta.studentId ? `/guardian/guardianhome?studentId=${meta.studentId}&tab=attendance` : '/guardian/guardianhome'
    };
  },
  Finance: (meta, defTitle, defMsg) => {
    const studentPart = meta.studentName ? ` for ${meta.studentName}` : '';
    const lowerTitle = (defTitle || '').toLowerCase();
    const lowerMsg = (defMsg || '').toLowerCase();
    
    const isPaid = meta.status === 'Paid' || lowerTitle.includes('confirm') || lowerTitle.includes('received') || lowerMsg.includes('received') || lowerMsg.includes('payment confirmed');
    const isReminder = meta.status === 'Reminder' || lowerTitle.includes('reminder') || lowerMsg.includes('pending') || lowerMsg.includes('reminder') || lowerMsg.includes('outstanding') || lowerMsg.includes('due');

    if (isPaid) {
      return {
        title: `✅ Fee Payment Confirmed`,
        body: `We have received the fee payment${studentPart} for ${meta.month || 'Current Month'}. Thank you.`,
        url: `/guardian/guardianfees`
      };
    } else if (isReminder) {
      return {
        title: `⚠️ Fee Payment Reminder`,
        body: `This is a reminder that the fee${studentPart} for ${meta.month || 'Current Month'} is pending. Please clear outstanding dues at your earliest convenience.`,
        url: `/guardian/guardianfees`
      };
    }
    return {
      title: `📄 Fee Invoice Generated`,
      body: `A new fee invoice of Rs. ${meta.amount || ''} has been generated${studentPart} for ${meta.month || 'Current Month'}.`,
      url: `/guardian/guardianfees`
    };
  },
  Results: (meta, defTitle, defMsg) => {
    const studentPart = meta.studentName ? ` for ${meta.studentName}` : '';
    return {
      title: `🏆 Exam Results Published`,
      body: `Results${studentPart} for ${meta.examName || 'Term Exams'} have been uploaded. Click to view grade sheet.`,
      url: meta.studentId ? `/guardian/guardianacademics?studentId=${meta.studentId}&tab=results` : '/guardian/guardianacademics'
    };
  },
  Chat: (meta, defTitle, defMsg) => {
    const isTeacher = meta.role === 'Teacher' || meta.role === 'Staff';
    if (isTeacher) {
      const fatherPart = meta.fatherName ? ` s/o ${meta.fatherName}` : '';
      const studentPart = meta.studentName ? ` for ${meta.studentName}${fatherPart}` : '';
      const classPart = (meta.className && meta.section) ? ` (${meta.className}-${meta.section})` : '';
      const subjectPart = meta.subject ? ` [Subject: ${meta.subject}]` : '';
      return {
        title: `💬 Parent Remark${studentPart}${classPart}`,
        body: `${defMsg || 'New remark received.'}${subjectPart}`,
        url: '/teacher/notifications'
      };
    }
    const sender = meta.senderName || 'Teacher';
    const studentPart = meta.studentName ? ` regarding ${meta.studentName}` : '';
    return {
      title: `💬 Message from ${sender}`,
      body: defMsg || `You have received a new message from ${sender}${studentPart}.`,
      url: '/guardian/guardianhome'
    };
  },
  Notice: (meta, defTitle, defMsg) => {
    const isTeacher = meta.role === 'Teacher' || meta.role === 'Staff';
    return {
      title: `📢 Administrative Notice`,
      body: defMsg || 'A new notice has been published by the administration.',
      url: isTeacher ? '/teacher/notifications' : '/guardian/guardiannotifications'
    };
  },
  Announcements: (meta, defTitle, defMsg) => {
    const isTeacher = meta.role === 'Teacher' || meta.role === 'Staff';
    return {
      title: `📢 Administrative Notice`,
      body: defMsg || 'A new notice has been published by the administration.',
      url: isTeacher ? '/teacher/notifications' : '/guardian/guardiannotifications'
    };
  },
  Timetable: (meta, defTitle, defMsg) => {
    const isTeacher = meta.role === 'Teacher' || meta.role === 'Staff';
    return {
      title: `📅 Timetable Updated`,
      body: `Class schedule has been updated${meta.className ? ` for ${meta.className}` : ''}.`,
      url: isTeacher ? '/teacher/timetable' : '/guardian/guardianacademics'
    };
  },
  Salary: (meta, defTitle, defMsg) => {
    return {
      title: `💰 Salary Disbursed`,
      body: `Your salary for ${meta.month || 'Current Month'} has been disbursed. Net Payable: Rs. ${meta.amount || ''}.`,
      url: '/teacher/profile'
    };
  }
};

function ensureFirebaseInitialized(): boolean {
  if (getApps().length > 0) return true;

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
      console.log('[PUSH/INIT] Firebase Admin SDK successfully initialized using environment variables.');
      return true;
    }

    const credentialsPath = path.join(process.cwd(), process.env.FIREBASE_ADMIN_CREDENTIALS_PATH || 'edu-erp-system-firebase-adminsdk.json');
    if (fs.existsSync(credentialsPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
      initializeApp({
        credential: cert(serviceAccount)
      });
      console.log('[PUSH/INIT] Firebase Admin SDK successfully initialized using local JSON file.');
      return true;
    }

    console.warn('[PUSH/INIT] Firebase Admin SDK: No FIREBASE_PRIVATE_KEY env var and no local JSON credentials found. Push notifications will fail.');
  } catch (err) {
    console.error('[PUSH/INIT] Failed to initialize Firebase Admin SDK:', err);
  }
  return false;
}

export async function POST(req: Request) {
  try {
    if (!ensureFirebaseInitialized()) {
      console.error('[PUSH/SEND] Error: Firebase Admin SDK is not initialized. Please verify your Vercel Environment Variables: FIREBASE_PRIVATE_KEY, NEXT_PUBLIC_FIREBASE_PROJECT_ID, and FIREBASE_CLIENT_EMAIL.');
      return NextResponse.json({ 
        error: 'Firebase Admin SDK not initialized',
        details: 'Missing Firebase credentials on server. Please configure FIREBASE_PRIVATE_KEY, NEXT_PUBLIC_FIREBASE_PROJECT_ID, and FIREBASE_CLIENT_EMAIL in Vercel environment variables.'
      }, { status: 500 });
    }

    const { userIds, roles, title, message, url, category, skipHistory, metadata } = await req.json();

    console.log(`\n=================== [PUSH/SEND TRIGGERED] ===================`);
    console.log(`[PUSH/SEND] Trigger Input: userIds=${JSON.stringify(userIds)}, roles=${JSON.stringify(roles)}, title="${title}", category="${category}", url="${url}"`);
    console.log(`[PUSH/SEND] Message Body: "${message}"`);
    console.log(`[PUSH/SEND] Metadata: ${JSON.stringify(metadata)}`);

    // Basic Authorization check via JWT header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !adminSupabase) {
      console.error('[PUSH/SEND] Error: Missing Authorization header or adminSupabase client');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await adminSupabase.auth.getUser(token);
    if (authError || !user) {
      console.error('[PUSH/SEND] Error: Unauthorized user session', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[PUSH/SEND] Authorized Operator: email=${user.email}, role=${user.user_metadata?.role}`);

    if (!adminSupabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
      console.warn('[PUSH/SEND] CRITICAL WARNING: Neither SUPABASE_SERVICE_ROLE_KEY nor NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY is defined in the server environment. Row-Level Security (RLS) will prevent fetching other users tokens. Push notifications will fail.');
    }

    const isValidUUID = (uuid: string) => {
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
    };

    // Resolve any student/staff/parent IDs to their corresponding push subscription user IDs
    let resolvedUserIds: string[] = [];
    let studentRecords: any[] = [];
    let staffRecords: any[] = [];
    let authUsers: any = null;
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
        const { data: studentsData, error: studErr } = await adminSupabase
          .from('students')
          .select('id, name, guardian_id, father_name, academic_class, section')
          .in('id', studentIdsToLookup);
        
        if (studErr) {
          console.error(`[PUSH/SEND] Student lookup DB error:`, studErr);
        }
        if (studentsData) studentRecords = studentsData;
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
        const { data: staffData, error: staffErr } = await adminSupabase
          .from('staff')
          .select('id, name, username')
          .in('id', staffIdsToLookup);
        
        if (staffErr) {
          console.error(`[PUSH/SEND] Staff lookup DB error:`, staffErr);
        }
        if (staffData) staffRecords = staffData;
        console.log(`[PUSH/SEND] Staff records resolved: ${JSON.stringify(staffRecords)}`);
        
        if (staffRecords && staffRecords.length > 0) {
          const emails = staffRecords.map((s: any) => s.username).filter(Boolean);
          if (emails.length > 0) {
            // Fetch auth users to map their emails to auth IDs (with perPage: 1000 to cover all users)
            const { data: usersData, error: authErr } = await adminSupabase.auth.admin.listUsers({
              perPage: 1000
            });
            if (authErr) {
              console.error(`[PUSH/SEND] Auth listUsers error:`, authErr);
            }
            if (usersData) authUsers = usersData;
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

    // Build metadata maps
    const studentIdToRecord = new Map<string, any>();
    if (studentRecords) {
      studentRecords.forEach((s: any) => {
        studentIdToRecord.set(s.id, s);
      });
    }

    const staffIdToRecord = new Map<string, { id: string; name: string; username: string }>();
    if (staffRecords) {
      staffRecords.forEach((s: any) => {
        studentIdToRecord.set(s.id, s); // Using same lookup for staff if query parameters are raw UUIDs
        staffIdToRecord.set(s.id, s);
      });
    }

    // Helper to get metadata for a specific recipient
    const getRecipientMetadata = (recipientId: string | null, targetRole: string | null): NotificationMetadata => {
      const meta: NotificationMetadata = {};
      if (!recipientId) return meta;

      // Clean prefix if present
      let id = recipientId;
      if (id.startsWith('parent_')) id = id.replace('parent_', '');
      else if (id.startsWith('staff_')) id = id.replace('staff_', '');

      // Check if it's a staff ID
      const staff = staffIdToRecord.get(id);
      if (staff) {
        meta.senderName = staff.name;
      }

      // Handle Guardian / Student mapping (incorporating sibling aggregation)
      const cleanRole = targetRole || (recipientId.startsWith('parent_') ? 'Guardian' : null);
      if (cleanRole === 'Guardian') {
        let guardianId = id;
        const student = studentIdToRecord.get(id);
        if (student && student.guardian_id) {
          guardianId = student.guardian_id;
        }

        const matchingStudents = studentRecords.filter((s: any) => s.guardian_id === guardianId);
        if (matchingStudents.length > 0) {
          meta.studentName = matchingStudents.map((s: any) => s.name).join(' & ');
          meta.studentId = matchingStudents[0].id;
          meta.fatherName = matchingStudents[0].father_name;
          meta.className = matchingStudents[0].academic_class;
          meta.section = matchingStudents[0].section;
        }
      } else {
        // Fallback check for single student lookup
        const student = studentIdToRecord.get(id);
        if (student) {
          meta.studentName = student.name;
          meta.studentId = student.id;
          meta.fatherName = student.father_name;
          meta.className = student.academic_class;
          meta.section = student.section;
        }
      }

      return meta;
    };

    // Helper to resolve title, body and deep link dynamically
    const getTemplatedContent = (recipientId: string | null, targetRole: string | null) => {
      const resolvedMeta = getRecipientMetadata(recipientId, targetRole);
      const mergedMeta = {
        role: targetRole || (recipientId?.startsWith('parent_') ? 'Guardian' : recipientId?.startsWith('staff_') ? 'Teacher' : null),
        ...metadata,
        ...resolvedMeta
      };

      let finalTitle = title;
      let finalMessage = message;
      let finalUrl = url || '/';

      const cat = category || 'Announcements';
      if (NOTIFICATION_TEMPLATES[cat]) {
        try {
          const templated = NOTIFICATION_TEMPLATES[cat](mergedMeta, title, message);
          finalTitle = templated.title;
          finalMessage = templated.body;
          finalUrl = templated.url;
        } catch (err) {
          console.error('[PUSH/SEND] Templating error:', err);
        }
      } else {
        // Fallback context-aware parsing
        const lowerTitle = title.toLowerCase();
        const lowerMsg = message.toLowerCase();
        const lowerCat = cat.toLowerCase();

        if (lowerTitle.includes('invoice') || (lowerCat === 'finance' && lowerTitle.includes('new fee'))) {
          finalTitle = '📄 Fee Invoice Generated';
          if (message.includes('invoice has been generated') || message.length < 25) {
            finalMessage = 'A new fee invoice is ready for your review. Please visit the Fees tab in your portal.';
          }
        } else if (lowerTitle.includes('confirmed') || lowerTitle.includes('received') || (lowerCat === 'finance' && (lowerTitle.includes('payment') || lowerMsg.includes('received')))) {
          finalTitle = '✅ Fee Payment Confirmed';
        } else if (lowerTitle.includes('result') || lowerTitle.includes('report card') || lowerCat === 'results') {
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
        } else if (lowerTitle.includes('parent') && (lowerTitle.includes('message') || lowerTitle.includes('contact') || lowerCat === 'chat')) {
          finalTitle = '💬 New Parent Message';
        } else if (lowerTitle.includes('teacher') && (lowerTitle.includes('message') || lowerCat === 'chat')) {
          finalTitle = '💬 New Teacher Message';
        } else if (lowerCat === 'announcements' || lowerTitle.includes('announcement') || lowerTitle.includes('notice')) {
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
      }

      const displayTitle = `${schoolName} - ${finalTitle}`;

      return { displayTitle, finalMessage, finalUrl };
    };

    // Log the notification in history unless skipped
    if (!skipHistory) {
      const historyPayload: any[] = [];
      if (userIds && userIds.length > 0) {
        userIds.forEach((id: string) => {
          let cleanId = id;
          if (id.startsWith('parent_')) {
            cleanId = id.replace('parent_', '');
          } else if (id.startsWith('staff_')) {
            cleanId = id.replace('staff_', '');
          }
          
          if (isValidUUID(cleanId)) {
            const { displayTitle, finalMessage, finalUrl } = getTemplatedContent(id, id.startsWith('parent_') ? 'Guardian' : 'Teacher');
            historyPayload.push({
              recipient_id: cleanId,
              category: category || 'Announcements',
              title: displayTitle,
              message: finalMessage,
              url: finalUrl
            });
          }
        });
      } else if (roles && roles.length > 0) {
        roles.forEach((r: string) => {
          const { displayTitle, finalMessage, finalUrl } = getTemplatedContent(null, r);
          historyPayload.push({
            role: r,
            category: category || 'Announcements',
            title: displayTitle,
            message: finalMessage,
            url: finalUrl
          });
        });
      } else {
        const { displayTitle, finalMessage, finalUrl } = getTemplatedContent(null, null);
        historyPayload.push({
          category: category || 'Announcements',
          title: displayTitle,
          message: finalMessage,
          url: finalUrl
        });
      }
      
      if (historyPayload.length > 0) {
        const twentyDaysAgo = new Date();
        twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);
        await adminSupabase.from('notification_history').delete().lt('created_at', twentyDaysAgo.toISOString());
        await adminSupabase.from('notification_history').insert(historyPayload);

        // Legacy Sync
        const legacyNotifications: any[] = [];
        if (userIds && userIds.length > 0) {
          userIds.forEach((id: string) => {
            const { displayTitle, finalMessage } = getTemplatedContent(id, id.startsWith('parent_') ? 'Guardian' : 'Teacher');
            legacyNotifications.push({
              recipient_id: id,
              target_role: roles && roles.length > 0 ? roles[0] : (id.startsWith('parent_') ? 'Guardian' : 'Teacher'),
              sender_role: 'Admin',
              title: displayTitle,
              message: finalMessage,
              student_id: id.startsWith('parent_') ? id.replace('parent_', '') : id
            });
          });
        } else if (roles && roles.length > 0) {
          roles.forEach((r: string) => {
            const { displayTitle, finalMessage } = getTemplatedContent(null, r);
            legacyNotifications.push({
              target_role: r === 'Guardian' ? 'Guardian' : 'Teacher',
              sender_role: 'Admin',
              title: displayTitle,
              message: finalMessage
            });
          });
        } else {
          const { displayTitle: teacherTitle, finalMessage: teacherMsg } = getTemplatedContent(null, 'Teacher');
          legacyNotifications.push({
            target_role: 'Teacher',
            sender_role: 'Admin',
            title: teacherTitle,
            message: teacherMsg
          });
          const { displayTitle: guardianTitle, finalMessage: guardianMsg } = getTemplatedContent(null, 'Guardian');
          legacyNotifications.push({
            target_role: 'Guardian',
            sender_role: 'Admin',
            title: guardianTitle,
            message: guardianMsg
          });
        }
        if (legacyNotifications.length > 0) {
          await adminSupabase.from('notifications').insert(legacyNotifications);
        }
      }
    }

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
      const filterStr = filters.join(',');
      console.log(`[PUSH/SEND] Query filters applied: .or("${filterStr}")`);
      query = query.or(filterStr);
    } else {
      console.log(`[PUSH/SEND] Query filters: None. Querying all push subscriptions.`);
    }
    
    const { data: subscriptions, error: subError } = await query;
    if (subError) {
      console.error(`[PUSH/SEND] Error querying push subscriptions:`, subError);
      throw subError;
    }

    console.log(`[PUSH/SEND] DB push subscriptions found count: ${subscriptions?.length || 0}`);
    if (subscriptions && subscriptions.length > 0) {
      subscriptions.forEach((s: any) => {
        console.log(`  - Subscription: ID=${s.id?.substring(0,8)}, user_id=${s.user_id?.substring(0,8)}, role=${s.role}, endpoint=${s.endpoint?.substring(0,40)}...`);
      });
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`[PUSH/SEND] No subscriptions found for resolvedUserIds=${JSON.stringify(resolvedUserIds)} roles=${JSON.stringify(roles)}`);
      return NextResponse.json({ success: true, sent: 0, debug: 'no_subscriptions_found' });
    }

    // Filter out legacy v1 URLs (permanently deprecated)
    const legacySubs = subscriptions.filter((sub: any) => sub.endpoint && sub.endpoint.startsWith('https://'));
    const validSubs = subscriptions.filter((sub: any) => sub.endpoint && !sub.endpoint.startsWith('https://'));

    if (legacySubs.length > 0) {
      const legacyEndpoints = legacySubs.map((s: any) => s.endpoint);
      console.warn(`[PUSH/SEND] Found ${legacyEndpoints.length} legacy FCM v1 tokens (deprecated). Auto-deleting...`);
      await adminSupabase!.from('push_subscriptions').delete().in('endpoint', legacyEndpoints);
    }

    if (validSubs.length === 0) {
      console.log(`[PUSH/SEND] All subscriptions found were legacy tokens. Dispatch skipped.`);
      return NextResponse.json({ success: true, sent: 0, debug: 'all_tokens_were_legacy_format' });
    }

    console.log(`[PUSH/SEND] Dispatching to ${validSubs.length} valid FCM tokens (${legacySubs.length} legacy tokens deleted)`);

    // Build personalized FCM message list
    const messages = validSubs.map((sub: any) => {
      const token = sub.endpoint;
      const { displayTitle, finalMessage, finalUrl } = getTemplatedContent(sub.user_id, sub.role);
      
      console.log(`[PUSH/SEND] Personalized Payload for user=${sub.user_id?.substring(0,8)}: title="${displayTitle}", body="${finalMessage}", url="${finalUrl}", token="${token.substring(0,40)}..."`);

      return {
        notification: {
          title: displayTitle,
          body: finalMessage,
        },
        android: {
          priority: 'high' as const,
          notification: {
            channelId: 'high_priority_alerts',
            sound: 'default',
            defaultVibrateTimings: true,
          }
        },
        data: {
          url: finalUrl,
          category: category || 'general',
        },
        token: token
      };
    });

    const fcmResponse = await getMessaging().sendEach(messages);
    console.log(`[PUSH/SEND] FCM Response: successCount=${fcmResponse.successCount} failureCount=${fcmResponse.failureCount}`);
    
    // Cleanup invalid FCM tokens
    const failedTokens: string[] = [];
    fcmResponse.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const errCode = resp.error?.code;
        const failedToken = validSubs[idx].endpoint;
        console.error(`[PUSH/SEND] Token ${failedToken.substring(0,30)}... failed: code=${errCode} msg=${resp.error?.message}`);
        if (errCode === 'messaging/invalid-registration-token' || errCode === 'messaging/registration-token-not-registered') {
          failedTokens.push(failedToken);
        }
      } else {
        console.log(`[PUSH/SEND] ✓ Token ${validSubs[idx].endpoint.substring(0,30)}... delivered. MessageID=${resp.messageId}`);
      }
    });

    if (failedTokens.length > 0) {
      console.log(`[PUSH/SEND] Deleting ${failedTokens.length} stale tokens from database`);
      await adminSupabase!.from('push_subscriptions').delete().in('endpoint', failedTokens);
    }

    return NextResponse.json({ 
      success: true, 
      sent: fcmResponse.successCount,
      failed: fcmResponse.failureCount,
      recipients: resolvedUserIds.length,
      tokens_tested: validSubs.length,
    });
  } catch (err: any) {
    console.error('[PUSH/SEND] Fatal error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
