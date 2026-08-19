-- Supabase Schema for School ERP System
-- Run this entire script in the Supabase SQL Editor

-- ==========================================
-- 1. Create Tables
-- ==========================================

CREATE TABLE IF NOT EXISTS public.students (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    roll_number text,
    name text NOT NULL,
    father_name text NOT NULL,
    cnic text,
    dob date,
    gender text NOT NULL,
    academic_class text NOT NULL,
    section text NOT NULL,
    monthly_fee numeric,
    transport_fee numeric,
    academy_fee numeric,
    registration_fee_status text,
    advance_fee_months text,
    admission_date date,
    status text NOT NULL,
    profile_image_url text,
    document_urls text[],
    guardian_whatsapp text,
    guardian_password text,
    guardian_id uuid, -- Reference to auth.users if guardians login
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.staff (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    username text,
    password text,
    role text NOT NULL,
    subject text,
    academic_class text,
    section text,
    salary numeric,
    status text NOT NULL,
    phone text,
    cnic text,
    address text,
    join_date date,
    profile_image_url text,
    assigned_classes jsonb,
    allowed_assessments text[],
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fee_vouchers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
    month text NOT NULL,
    year integer NOT NULL,
    tuition_fee numeric NOT NULL,
    transport_fee numeric NOT NULL,
    academy_fee numeric NOT NULL,
    other_fee numeric NOT NULL,
    discount numeric NOT NULL,
    total_amount numeric NOT NULL,
    paid_amount numeric NOT NULL,
    status text NOT NULL,
    paid_date date,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_attendance (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
    date date NOT NULL,
    academic_class text,
    section text,
    status text NOT NULL,
    recorded_by uuid REFERENCES public.staff(id) ON DELETE SET NULL,
    teacher_id uuid,
    is_locked boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.staff_attendance (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    staff_id uuid REFERENCES public.staff(id) ON DELETE CASCADE,
    date date NOT NULL,
    status text NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.exams (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    type text,
    status text NOT NULL,
    class_rules jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.results (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
    exam_id uuid REFERENCES public.exams(id) ON DELETE CASCADE,
    subject text NOT NULL,
    marks numeric,
    total_marks numeric,
    staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
    is_submitted boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.result_generation (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
    exam_id uuid REFERENCES public.exams(id) ON DELETE CASCADE,
    status text,
    remarks text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.timetable (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    academic_class text NOT NULL,
    section text NOT NULL,
    subject text NOT NULL,
    teacher_id uuid REFERENCES public.staff(id) ON DELETE CASCADE,
    teacher_name text,
    day text NOT NULL,
    start_time time,
    end_time time,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payroll (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    staff_id uuid REFERENCES public.staff(id) ON DELETE CASCADE,
    month text NOT NULL,
    year integer NOT NULL,
    base_salary numeric,
    deductions numeric NOT NULL,
    bonuses numeric NOT NULL,
    net_salary numeric,
    status text NOT NULL,
    paid_date date,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    message text,
    target_role text NOT NULL,
    student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_history (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text,
    message text,
    target_role text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    endpoint text UNIQUE NOT NULL,
    p256dh text,
    auth text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    key text UNIQUE NOT NULL,
    value jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.remarks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
    staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
    remark text NOT NULL,
    context text,
    subject text,
    date date,
    created_at timestamptz DEFAULT now()
);

-- ==========================================
-- 2. Row Level Security (RLS) Configuration
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.result_generation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remarks ENABLE ROW LEVEL SECURITY;

-- Note: The application primarily uses `adminSupabase` (Service Role Key) for database operations
-- which bypasses RLS completely. However, for client-side queries (using anon key), 
-- we need to establish baseline policies.

-- Policy: Allow full access to authenticated users
-- (Since your application handles role-based authorization via UI and server routes,
-- and mostly uses service_role key, we allow authenticated users to perform operations
-- while still requiring them to be logged in via Supabase Auth).

CREATE POLICY "Allow full access for authenticated users" ON public.students FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow full access for authenticated users" ON public.staff FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow full access for authenticated users" ON public.fee_vouchers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow full access for authenticated users" ON public.student_attendance FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow full access for authenticated users" ON public.staff_attendance FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow full access for authenticated users" ON public.exams FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow full access for authenticated users" ON public.results FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow full access for authenticated users" ON public.result_generation FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow full access for authenticated users" ON public.timetable FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow full access for authenticated users" ON public.payroll FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow full access for authenticated users" ON public.notifications FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow full access for authenticated users" ON public.notification_history FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow full access for authenticated users" ON public.push_subscriptions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow full access for authenticated users" ON public.settings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow full access for authenticated users" ON public.remarks FOR ALL USING (auth.role() = 'authenticated');

-- We also allow Anon read-access to settings as some settings might be fetched before login
CREATE POLICY "Allow anon read access" ON public.settings FOR SELECT USING (true);

-- Insert a default application settings row so the application does not crash
INSERT INTO public.settings (key, value) VALUES ('app_settings', '{"schoolName": "School ERP", "setupComplete": true}'::jsonb) ON CONFLICT DO NOTHING;
