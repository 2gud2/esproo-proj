-- ─── Espro POS: Employee Management & Attendance Module Migration ───
-- Safe and idempotent to run in Supabase SQL Editor

-- 1. Employees Table
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Linked Supabase Auth user (optional)
  employee_code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  phone VARCHAR(50),
  role VARCHAR(50) NOT NULL DEFAULT 'Barista',
  employment_type VARCHAR(20) NOT NULL DEFAULT 'part_time', -- 'full_time' | 'part_time'
  hourly_rate NUMERIC(10,2) DEFAULT 0,
  pin_code VARCHAR(10) NOT NULL DEFAULT '1234',
  has_system_access BOOLEAN DEFAULT FALSE,
  emergency_contact_name VARCHAR(100),
  emergency_contact_phone VARCHAR(50),
  hire_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active' | 'inactive' | 'on_leave'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist if table was already created
ALTER TABLE employees ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS has_system_access BOOLEAN DEFAULT FALSE;

-- Enable RLS & create public policies for employees
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employees' AND policyname = 'Allow public read access to employees') THEN
    CREATE POLICY "Allow public read access to employees" ON employees FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employees' AND policyname = 'Allow public insert access to employees') THEN
    CREATE POLICY "Allow public insert access to employees" ON employees FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employees' AND policyname = 'Allow public update access to employees') THEN
    CREATE POLICY "Allow public update access to employees" ON employees FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'employees' AND policyname = 'Allow public delete access to employees') THEN
    CREATE POLICY "Allow public delete access to employees" ON employees FOR DELETE USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_employees_code ON employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);


-- 2. Shift Templates Table
CREATE TABLE IF NOT EXISTS shift_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  start_time VARCHAR(10) NOT NULL, -- e.g. "06:00"
  end_time VARCHAR(10) NOT NULL,   -- e.g. "14:00"
  break_minutes INT DEFAULT 30,
  color VARCHAR(20) DEFAULT '#D97706',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS & create public policies for shift_templates
ALTER TABLE shift_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shift_templates' AND policyname = 'Allow public read access to shift_templates') THEN
    CREATE POLICY "Allow public read access to shift_templates" ON shift_templates FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shift_templates' AND policyname = 'Allow public insert access to shift_templates') THEN
    CREATE POLICY "Allow public insert access to shift_templates" ON shift_templates FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shift_templates' AND policyname = 'Allow public update access to shift_templates') THEN
    CREATE POLICY "Allow public update access to shift_templates" ON shift_templates FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shift_templates' AND policyname = 'Allow public delete access to shift_templates') THEN
    CREATE POLICY "Allow public delete access to shift_templates" ON shift_templates FOR DELETE USING (true);
  END IF;
END $$;


-- 3. Shift Schedules Table
CREATE TABLE IF NOT EXISTS shift_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  shift_template_id UUID REFERENCES shift_templates(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS & create public policies for shift_schedules
ALTER TABLE shift_schedules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shift_schedules' AND policyname = 'Allow public read access to shift_schedules') THEN
    CREATE POLICY "Allow public read access to shift_schedules" ON shift_schedules FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shift_schedules' AND policyname = 'Allow public insert access to shift_schedules') THEN
    CREATE POLICY "Allow public insert access to shift_schedules" ON shift_schedules FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shift_schedules' AND policyname = 'Allow public update access to shift_schedules') THEN
    CREATE POLICY "Allow public update access to shift_schedules" ON shift_schedules FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shift_schedules' AND policyname = 'Allow public delete access to shift_schedules') THEN
    CREATE POLICY "Allow public delete access to shift_schedules" ON shift_schedules FOR DELETE USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_shift_schedules_date ON shift_schedules(date);
CREATE INDEX IF NOT EXISTS idx_shift_schedules_emp ON shift_schedules(employee_id);


-- 4. Attendance Records Table
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  shift_template_id UUID REFERENCES shift_templates(id) ON DELETE SET NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  break_start TIMESTAMPTZ,
  break_end TIMESTAMPTZ,
  total_hours NUMERIC(6,2) DEFAULT 0,
  regular_hours NUMERIC(6,2) DEFAULT 0,
  overtime_hours NUMERIC(6,2) DEFAULT 0,
  late_minutes INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'present', -- 'present' | 'late' | 'half_day' | 'absent' | 'on_duty' | 'on_break'
  adjustment_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS & create public policies for attendance_records
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attendance_records' AND policyname = 'Allow public read access to attendance_records') THEN
    CREATE POLICY "Allow public read access to attendance_records" ON attendance_records FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attendance_records' AND policyname = 'Allow public insert access to attendance_records') THEN
    CREATE POLICY "Allow public insert access to attendance_records" ON attendance_records FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attendance_records' AND policyname = 'Allow public update access to attendance_records') THEN
    CREATE POLICY "Allow public update access to attendance_records" ON attendance_records FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attendance_records' AND policyname = 'Allow public delete access to attendance_records') THEN
    CREATE POLICY "Allow public delete access to attendance_records" ON attendance_records FOR DELETE USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_attendance_records_date ON attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_attendance_records_emp ON attendance_records(employee_id);
