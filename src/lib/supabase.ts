import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables.\n' +
    'Make sure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your .env.local file.'
  );
}

// Public anon client — respects RLS
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Service role key — available both server-side and client-side
const serviceKey =
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

// Admin client — bypasses RLS.
// Falls back to anon client if no service key is configured.
export const adminSupabase: SupabaseClient = serviceKey
  ? createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        storageKey: 'supabase.admin.auth.token',
      },
    })
  : supabase;

// Convenience: always returns the best available client
export function getDb(): SupabaseClient {
  return adminSupabase;
}

// ─── Quick connection test ────────────────────────────────────────────────────
export async function testSupabaseConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const { error } = await adminSupabase.from('settings').select('key').limit(1);
    if (error) {
      if (error.code === '42P01') {
        return { ok: true, message: '✅ Connected! Run supabase_schema.sql in SQL Editor to create tables.' };
      }
      return { ok: false, message: `❌ Error: ${error.message}` };
    }
    return { ok: true, message: '✅ Connected to Supabase! Tables exist.' };
  } catch (e: any) {
    return { ok: false, message: `❌ Connection failed: ${e.message}` };
  }
}

// ─── Type definitions matching our schema ────────────────────────────────────

export interface Student {
  id: string;
  roll_number?: string;
  name: string;
  father_name: string;
  cnic?: string;
  dob?: string;
  gender: string;
  academic_class: string;
  section: string;
  monthly_fee?: number;
  transport_fee?: number;
  academy_fee?: number;
  registration_fee_status?: string;
  advance_fee_months?: string;
  admission_date?: string;
  status: string;
  profile_image_url?: string;
  document_urls?: string[];
  guardian_whatsapp?: string;
  guardian_password?: string;
  created_at?: string;
}

export interface Staff {
  id: string;
  name: string;
  username?: string;
  password?: string;
  role: string;
  subject?: string;
  academic_class?: string;
  section?: string;
  salary?: number;
  status: string;
  phone?: string;
  cnic?: string;
  address?: string;
  join_date?: string;
  profile_image_url?: string;
  created_at?: string;
  assigned_classes?: { class: string; section: string }[];
  allowed_assessments?: string[];
}

export interface Remark {
  id: string;
  student_id: string;
  staff_id?: string;
  remark: string;
  context?: string;
  subject?: string;
  date?: string;
  created_at?: string;
}

export interface FeeVoucher {
  id: string;
  student_id: string;
  month: string;
  year: number;
  tuition_fee: number;
  transport_fee: number;
  academy_fee: number;
  other_fee: number;
  discount: number;
  total_amount: number;
  paid_amount: number;
  status: string;
  paid_date?: string;
  created_at?: string;
}

export interface Attendance {
  id: string;
  student_id: string;
  date: string;
  academic_class?: string;
  section?: string;
  status: string;
  recorded_by?: string;
  is_locked: boolean;
  created_at?: string;
}

export interface StaffAttendance {
  id: string;
  staff_id: string;
  date: string;
  status: string;
  created_at?: string;
}

export interface Exam {
  id: string;
  title: string;
  type?: string;
  status: string;
  class_rules?: Record<string, unknown>;
  created_at?: string;
}

export interface Result {
  id: string;
  student_id: string;
  exam_id: string;
  subject: string;
  marks?: number;
  total_marks?: number;
  staff_id?: string;
  is_submitted: boolean;
  created_at?: string;
}

export interface TimetableEntry {
  id: string;
  academic_class: string;
  section: string;
  subject: string;
  teacher_id?: string;
  teacher_name?: string;
  day: string;
  start_time?: string;
  end_time?: string;
  created_at?: string;
}

export interface Payroll {
  id: string;
  staff_id: string;
  month: string;
  year: number;
  base_salary?: number;
  deductions: number;
  bonuses: number;
  net_salary?: number;
  status: string;
  paid_date?: string;
  created_at?: string;
}

export interface Notification {
  id: string;
  title: string;
  message?: string;
  target_role: string;
  created_at?: string;
}
