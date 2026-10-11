import { supabase, createStaffAccount, adminUpdateUserPassword } from './supabase';
import { isSupabaseConfigured } from './env';
import { format } from 'date-fns';

export type EmployeeRole = 'Store Manager' | 'Head Barista' | 'Barista' | 'Cashier' | 'Kitchen';
export type EmploymentType = 'full_time' | 'part_time';
export type EmployeeStatus = 'active' | 'inactive' | 'on_leave';
export type AttendanceStatus = 'present' | 'late' | 'half_day' | 'absent' | 'on_duty' | 'on_break';

export interface SystemAccessConfig {
  grantAccess: boolean;
  email: string;
  password?: string;
  systemRole: 'admin' | 'employee';
}

export interface Employee {
  id: string;
  user_id: string | null;
  employee_code: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: EmployeeRole | string;
  employment_type: EmploymentType;
  hourly_rate: number;
  pin_code: string;
  has_system_access: boolean;
  system_role?: 'admin' | 'employee';
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  hire_date: string;
  status: EmployeeStatus;
  created_at: string;
  updated_at: string;
}

export interface ShiftTemplate {
  id: string;
  name: string;
  start_time: string; // e.g. "06:00"
  end_time: string;   // e.g. "14:00"
  break_minutes: number;
  color: string;
  created_at: string;
}

export interface ShiftSchedule {
  id: string;
  employee_id: string;
  shift_template_id: string | null;
  date: string; // "YYYY-MM-DD"
  notes: string | null;
  created_at: string;
  employee?: Employee;
  shift_template?: ShiftTemplate;
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string; // "YYYY-MM-DD"
  shift_template_id: string | null;
  clock_in: string | null;
  clock_out: string | null;
  break_start: string | null;
  break_end: string | null;
  total_hours: number;
  regular_hours: number;
  overtime_hours: number;
  late_minutes: number;
  status: AttendanceStatus;
  adjustment_note: string | null;
  created_at: string;
  employee?: Employee;
  shift_template?: ShiftTemplate;
}

// ────────────────────────────────────────────────────────────
// LOCAL STORAGE KEYS (Initialized as empty `[]`)
// ────────────────────────────────────────────────────────────
const STORAGE_EMPLOYEES = 'espro_employees';
const STORAGE_TEMPLATES = 'espro_shift_templates';
const STORAGE_SCHEDULES = 'espro_shift_schedules';
const STORAGE_ATTENDANCE = 'espro_attendance_records';

function getLocal<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setLocal<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Failed to cache ${key} to localStorage`, err);
  }
}

// Helper to check network or missing table errors
function isDbError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  return (
    msg.includes('relation "employees" does not exist') ||
    msg.includes('relation "shift_templates" does not exist') ||
    msg.includes('relation "shift_schedules" does not exist') ||
    msg.includes('relation "attendance_records" does not exist') ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('load failed')
  );
}

// ────────────────────────────────────────────────────────────
// 1. EMPLOYEE CRUD
// ────────────────────────────────────────────────────────────

export async function fetchEmployees(): Promise<Employee[]> {
  // Read local dynamic users map for system roles fallback
  const localUsersMap = new Map<string, any>();
  try {
    const raw = localStorage.getItem('espro_dynamic_users');
    if (raw) {
      const arr = JSON.parse(raw);
      arr.forEach((u: any) => {
        if (u.id) localUsersMap.set(u.id, u);
        if (u.email) localUsersMap.set(u.email.toLowerCase(), u);
      });
    }
  } catch (_) {}

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('name', { ascending: true });

      if (!error && data) {
        // Query profiles to resolve system role if profiles exist
        const profilesMap = new Map<string, { id: string; role: string; email?: string }>();
        try {
          const { data: profs } = await supabase.from('profiles').select('id, role, email');
          if (profs) profs.forEach((p: any) => {
            profilesMap.set(p.id, p);
            if (p.email) profilesMap.set(p.email.toLowerCase(), p);
          });
        } catch (_) {}

        const mapped: Employee[] = data.map(e => {
          const emailKey = e.email?.toLowerCase();
          const linkedProfile = (e.user_id ? profilesMap.get(e.user_id) : undefined) ||
                                (emailKey ? profilesMap.get(emailKey) : undefined);
          const localUser = (e.user_id ? localUsersMap.get(e.user_id) : undefined) ||
                            (emailKey ? localUsersMap.get(emailKey) : undefined);

          const resolvedUserId = e.user_id || linkedProfile?.id || localUser?.id || null;
          const hasAccess = Boolean(e.has_system_access || resolvedUserId);
          const sysRole = linkedProfile?.role ||
                          localUser?.role ||
                          (e.role === 'Store Manager' ? 'admin' : 'employee');

          return {
            ...e,
            user_id: resolvedUserId,
            has_system_access: hasAccess,
            system_role: hasAccess ? sysRole : undefined,
            hourly_rate: Number(e.hourly_rate ?? 0),
          };
        });
        setLocal(STORAGE_EMPLOYEES, mapped);
        return mapped;
      }
    } catch (err) {
      console.warn('Falling back to local storage for employees:', err);
    }
  }

  const local = getLocal<Employee>(STORAGE_EMPLOYEES);
  return local.map(e => {
    const emailKey = e.email?.toLowerCase();
    const sysRole = (e.user_id ? localUsersMap.get(e.user_id)?.role : undefined) ||
                    (emailKey ? localUsersMap.get(emailKey)?.role : undefined) ||
                    (e.role === 'Store Manager' ? 'admin' : 'employee');
    return {
      ...e,
      has_system_access: Boolean(e.has_system_access || e.user_id),
      system_role: (e.has_system_access || e.user_id) ? sysRole : undefined,
    };
  });
}

export async function createEmployee(
  payload: Omit<Employee, 'id' | 'created_at' | 'updated_at' | 'employee_code' | 'has_system_access' | 'user_id'> & {
    employee_code?: string;
    has_system_access?: boolean;
    user_id?: string | null;
  },
  systemAccess?: SystemAccessConfig
): Promise<Employee> {
  const existing = getLocal<Employee>(STORAGE_EMPLOYEES);

  let userId: string | null = null;
  let hasAccess = Boolean(systemAccess?.grantAccess);
  let systemRole: 'admin' | 'employee' | undefined = undefined;

  // Handle system user account creation if granted
  if (systemAccess?.grantAccess && systemAccess.email.trim() && systemAccess.password) {
    hasAccess = true;
    systemRole = systemAccess.systemRole || 'employee';

    // Call Supabase Auth creation
    const { user, error } = await createStaffAccount(
      systemAccess.email.trim(),
      systemAccess.password,
      payload.name.trim(),
      systemRole
    );

    if (error && !error.includes('not configured')) {
      throw new Error(error);
    }

    userId = user?.id || `u-${Date.now()}`;

    // Register into local dynamic user registry for immediate offline / client login
    try {
      const stored = localStorage.getItem('espro_dynamic_users');
      const localUsers = stored ? JSON.parse(stored) : [];
      const updatedLocalUsers = [
        ...localUsers.filter((u: any) => u.email.toLowerCase() !== systemAccess.email.toLowerCase()),
        {
          id: userId,
          name: payload.name.trim(),
          email: systemAccess.email.trim(),
          role: systemRole,
          status: 'active',
          password: systemAccess.password,
          createdAt: new Date(),
        }
      ];
      localStorage.setItem('espro_dynamic_users', JSON.stringify(updatedLocalUsers));
    } catch (_) {}
  }
  
  // Auto-generate employee code if missing (EMP-001, EMP-002...)
  let code = payload.employee_code?.trim();
  if (!code) {
    let nextNum = existing.length + 1;
    code = `EMP-${String(nextNum).padStart(3, '0')}`;
    while (existing.some(e => e.employee_code.toLowerCase() === code!.toLowerCase())) {
      nextNum += 1;
      code = `EMP-${String(nextNum).padStart(3, '0')}`;
    }
  }

  const now = new Date().toISOString();
  const newEmp: Employee = {
    id: crypto.randomUUID(),
    user_id: userId,
    employee_code: code,
    name: payload.name.trim(),
    email: (systemAccess?.email || payload.email)?.trim() || null,
    phone: payload.phone?.trim() || null,
    role: payload.role || 'Barista',
    employment_type: payload.employment_type || 'part_time',
    hourly_rate: Number(payload.hourly_rate ?? 0),
    pin_code: payload.pin_code?.trim() || '1234',
    has_system_access: hasAccess,
    system_role: hasAccess ? systemRole : undefined,
    emergency_contact_name: payload.emergency_contact_name?.trim() || null,
    emergency_contact_phone: payload.emergency_contact_phone?.trim() || null,
    hire_date: payload.hire_date || format(new Date(), 'yyyy-MM-dd'),
    status: payload.status || 'active',
    created_at: now,
    updated_at: now,
  };

  if (isSupabaseConfigured) {
    try {
      const insertPayload: any = {
        id: newEmp.id,
        user_id: newEmp.user_id,
        employee_code: newEmp.employee_code,
        name: newEmp.name,
        email: newEmp.email,
        phone: newEmp.phone,
        role: newEmp.role,
        employment_type: newEmp.employment_type,
        hourly_rate: newEmp.hourly_rate,
        pin_code: newEmp.pin_code,
        has_system_access: newEmp.has_system_access,
        emergency_contact_name: newEmp.emergency_contact_name,
        emergency_contact_phone: newEmp.emergency_contact_phone,
        hire_date: newEmp.hire_date,
        status: newEmp.status,
        created_at: newEmp.created_at,
        updated_at: newEmp.updated_at,
      };

      let { data, error } = await supabase
        .from('employees')
        .insert([insertPayload])
        .select()
        .single();

      // If Supabase table does not yet have user_id or has_system_access columns, retry without them
      if (error && (error.message.includes('has_system_access') || error.message.includes('user_id'))) {
        const fallbackPayload = { ...insertPayload };
        delete fallbackPayload.has_system_access;
        delete fallbackPayload.user_id;

        const retry = await supabase
          .from('employees')
          .insert([fallbackPayload])
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (!error && data) {
        const savedEmp: Employee = {
          ...data,
          user_id: data.user_id || newEmp.user_id,
          has_system_access: newEmp.has_system_access,
          system_role: newEmp.system_role,
          hourly_rate: Number(data.hourly_rate ?? 0)
        };
        const updated = [...existing.filter(e => e.id !== savedEmp.id), savedEmp].sort((a, b) => a.name.localeCompare(b.name));
        setLocal(STORAGE_EMPLOYEES, updated);
        return savedEmp;
      }
    } catch (err) {
      console.warn('Direct Supabase insert failed; using local storage:', err);
    }
  }

  const updated = [...existing, newEmp].sort((a, b) => a.name.localeCompare(b.name));
  setLocal(STORAGE_EMPLOYEES, updated);
  return newEmp;
}

export async function updateEmployee(
  id: string,
  data: Partial<Employee>,
  systemAccess?: {
    grantAccess?: boolean;
    email?: string;
    password?: string;
    systemRole?: 'admin' | 'employee';
  }
): Promise<Employee> {
  const existing = getLocal<Employee>(STORAGE_EMPLOYEES);
  const current = existing.find(e => e.id === id);
  if (!current) throw new Error('Employee not found');

  let updatedUserId = current.user_id;
  let updatedHasAccess = current.has_system_access ?? false;
  let updatedSystemRole = current.system_role;

  if (systemAccess) {
    if (systemAccess.grantAccess) {
      updatedHasAccess = true;
      updatedSystemRole = systemAccess.systemRole || current.system_role || 'employee';

      // If user had no user_id previously, create account
      if (!updatedUserId && systemAccess.email && systemAccess.password) {
        const { user, error } = await createStaffAccount(
          systemAccess.email.trim(),
          systemAccess.password,
          (data.name || current.name).trim(),
          updatedSystemRole
        );
        if (error && !error.includes('not configured')) {
          throw new Error(error);
        }
        updatedUserId = user?.id || `u-${Date.now()}`;
      } else if (updatedUserId && systemAccess.password) {
        // Update password in Supabase Auth
        try {
          await adminUpdateUserPassword(updatedUserId, systemAccess.password);
        } catch (_) {}
      }

      // Update / sync in local dynamic users
      const email = systemAccess.email || data.email || current.email;
      if (email) {
        try {
          const stored = localStorage.getItem('espro_dynamic_users');
          const localUsers = stored ? JSON.parse(stored) : [];
          const updatedLocalUsers = [
            ...localUsers.filter((u: any) => u.email.toLowerCase() !== email.toLowerCase()),
            {
              id: updatedUserId || `u-${Date.now()}`,
              name: (data.name || current.name).trim(),
              email: email.trim(),
              role: updatedSystemRole,
              status: 'active',
              ...(systemAccess.password ? { password: systemAccess.password } : {}),
              createdAt: new Date(),
            }
          ];
          localStorage.setItem('espro_dynamic_users', JSON.stringify(updatedLocalUsers));
        } catch (_) {}
      }
    } else if (systemAccess.grantAccess === false) {
      updatedHasAccess = false;
      // Disable in local user storage
      if (current.email) {
        try {
          const stored = localStorage.getItem('espro_dynamic_users');
          if (stored) {
            const localUsers = JSON.parse(stored);
            const nextUsers = localUsers.map((u: any) =>
              u.email.toLowerCase() === current.email!.toLowerCase() ? { ...u, status: 'disabled' } : u
            );
            localStorage.setItem('espro_dynamic_users', JSON.stringify(nextUsers));
          }
        } catch (_) {}
      }
    }
  }

  const now = new Date().toISOString();
  const updatedEmp: Employee = {
    ...current,
    ...data,
    user_id: updatedUserId,
    has_system_access: updatedHasAccess,
    system_role: updatedHasAccess ? updatedSystemRole : undefined,
    hourly_rate: data.hourly_rate !== undefined ? Number(data.hourly_rate) : current.hourly_rate,
    updated_at: now,
  };

  if (isSupabaseConfigured) {
    try {
      const updatePayload: any = {
        ...data,
        user_id: updatedUserId,
        has_system_access: updatedHasAccess,
        updated_at: now,
      };

      let { error } = await supabase
        .from('employees')
        .update(updatePayload)
        .eq('id', id);

      // If Supabase table does not yet have user_id or has_system_access columns, retry without them
      if (error && (error.message.includes('has_system_access') || error.message.includes('user_id'))) {
        const fallbackUpdate = { ...updatePayload };
        delete fallbackUpdate.has_system_access;
        delete fallbackUpdate.user_id;

        const retry = await supabase
          .from('employees')
          .update(fallbackUpdate)
          .eq('id', id);
        error = retry.error;
      }

      if (error && !isDbError(error)) {
        console.error('Supabase update employee error:', error);
      }
    } catch (err) {
      console.warn('Supabase update failed:', err);
    }
  }

  const nextList = existing.map(e => (e.id === id ? updatedEmp : e));
  setLocal(STORAGE_EMPLOYEES, nextList);
  return updatedEmp;
}

export async function updateEmployeePin(id: string, newPin: string): Promise<boolean> {
  if (!/^\d{4}$/.test(newPin)) {
    throw new Error('PIN must be exactly 4 digits');
  }
  await updateEmployee(id, { pin_code: newPin });
  return true;
}

export async function toggleEmployeeStatus(id: string, status: EmployeeStatus): Promise<Employee> {
  return await updateEmployee(id, { status });
}

export async function deleteEmployee(id: string): Promise<boolean> {
  if (isSupabaseConfigured) {
    try {
      await supabase.from('employees').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase delete employee failed:', err);
    }
  }
  const existing = getLocal<Employee>(STORAGE_EMPLOYEES);
  setLocal(STORAGE_EMPLOYEES, existing.filter(e => e.id !== id));
  return true;
}

// ────────────────────────────────────────────────────────────
// 2. SHIFT TEMPLATES & SCHEDULING
// ────────────────────────────────────────────────────────────

export async function fetchShiftTemplates(): Promise<ShiftTemplate[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('shift_templates')
        .select('*')
        .order('start_time', { ascending: true });

      if (!error && data) {
        setLocal(STORAGE_TEMPLATES, data);
        return data;
      }
    } catch (err) {
      console.warn('Falling back to local storage for shift templates:', err);
    }
  }
  return getLocal<ShiftTemplate>(STORAGE_TEMPLATES);
}

export async function createShiftTemplate(
  payload: Omit<ShiftTemplate, 'id' | 'created_at'>
): Promise<ShiftTemplate> {
  const newTemplate: ShiftTemplate = {
    id: crypto.randomUUID(),
    name: payload.name.trim(),
    start_time: payload.start_time.trim(),
    end_time: payload.end_time.trim(),
    break_minutes: Number(payload.break_minutes ?? 30),
    color: payload.color || '#D97706',
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('shift_templates')
        .insert([newTemplate])
        .select()
        .single();

      if (!error && data) {
        const existing = getLocal<ShiftTemplate>(STORAGE_TEMPLATES);
        setLocal(STORAGE_TEMPLATES, [...existing, data]);
        return data;
      }
    } catch (err) {
      console.warn('Supabase shift template insert failed:', err);
    }
  }

  const existing = getLocal<ShiftTemplate>(STORAGE_TEMPLATES);
  const updated = [...existing, newTemplate];
  setLocal(STORAGE_TEMPLATES, updated);
  return newTemplate;
}

export async function deleteShiftTemplate(id: string): Promise<boolean> {
  if (isSupabaseConfigured) {
    try {
      await supabase.from('shift_templates').delete().eq('id', id);
    } catch (err) {
      console.warn('Supabase shift template delete failed:', err);
    }
  }
  const existing = getLocal<ShiftTemplate>(STORAGE_TEMPLATES);
  setLocal(STORAGE_TEMPLATES, existing.filter(t => t.id !== id));
  return true;
}

export async function fetchSchedules(startDate: string, endDate: string): Promise<ShiftSchedule[]> {
  const employees = await fetchEmployees();
  const templates = await fetchShiftTemplates();

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('shift_schedules')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      if (!error && data) {
        const enriched: ShiftSchedule[] = data.map(s => ({
          ...s,
          employee: employees.find(e => e.id === s.employee_id),
          shift_template: templates.find(t => t.id === s.shift_template_id),
        }));
        // Merge into local cache
        const localAll = getLocal<ShiftSchedule>(STORAGE_SCHEDULES);
        const filtered = localAll.filter(s => s.date < startDate || s.date > endDate);
        setLocal(STORAGE_SCHEDULES, [...filtered, ...enriched]);
        return enriched;
      }
    } catch (err) {
      console.warn('Supabase schedules fetch failed; using local:', err);
    }
  }

  const localAll = getLocal<ShiftSchedule>(STORAGE_SCHEDULES);
  return localAll
    .filter(s => s.date >= startDate && s.date <= endDate)
    .map(s => ({
      ...s,
      employee: employees.find(e => e.id === s.employee_id),
      shift_template: templates.find(t => t.id === s.shift_template_id),
    }));
}

export async function assignShift(
  employeeId: string,
  shiftTemplateId: string | null,
  date: string,
  notes?: string
): Promise<ShiftSchedule | null> {
  const existing = getLocal<ShiftSchedule>(STORAGE_SCHEDULES);
  const foundIndex = existing.findIndex(s => s.employee_id === employeeId && s.date === date);

  if (!shiftTemplateId) {
    // Unassign shift
    if (foundIndex >= 0) {
      const record = existing[foundIndex];
      if (isSupabaseConfigured) {
        try {
          await supabase.from('shift_schedules').delete().eq('id', record.id);
        } catch (_) {}
      }
      existing.splice(foundIndex, 1);
      setLocal(STORAGE_SCHEDULES, existing);
    }
    return null;
  }

  let schedule: ShiftSchedule;
  if (foundIndex >= 0) {
    schedule = {
      ...existing[foundIndex],
      shift_template_id: shiftTemplateId,
      notes: notes !== undefined ? notes : existing[foundIndex].notes,
    };
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('shift_schedules')
          .update({
            shift_template_id: schedule.shift_template_id,
            notes: schedule.notes,
          })
          .eq('id', schedule.id);
      } catch (_) {}
    }
    existing[foundIndex] = schedule;
  } else {
    schedule = {
      id: crypto.randomUUID(),
      employee_id: employeeId,
      shift_template_id: shiftTemplateId,
      date,
      notes: notes || null,
      created_at: new Date().toISOString(),
    };
    if (isSupabaseConfigured) {
      try {
        await supabase.from('shift_schedules').insert([{
          id: schedule.id,
          employee_id: schedule.employee_id,
          shift_template_id: schedule.shift_template_id,
          date: schedule.date,
          notes: schedule.notes,
          created_at: schedule.created_at,
        }]);
      } catch (_) {}
    }
    existing.push(schedule);
  }

  setLocal(STORAGE_SCHEDULES, existing);
  return schedule;
}

export async function swapShifts(scheduleIdA: string, scheduleIdB: string): Promise<boolean> {
  const existing = getLocal<ShiftSchedule>(STORAGE_SCHEDULES);
  const schedA = existing.find(s => s.id === scheduleIdA);
  const schedB = existing.find(s => s.id === scheduleIdB);

  if (!schedA || !schedB) {
    throw new Error('One or both schedules were not found to swap');
  }

  // Swap shift templates and notes between schedule A and B
  const tempTemplate = schedA.shift_template_id;
  const tempNotes = schedA.notes;

  schedA.shift_template_id = schedB.shift_template_id;
  schedA.notes = schedB.notes;

  schedB.shift_template_id = tempTemplate;
  schedB.notes = tempNotes;

  if (isSupabaseConfigured) {
    try {
      await supabase.from('shift_schedules').update({
        shift_template_id: schedA.shift_template_id,
        notes: schedA.notes,
      }).eq('id', schedA.id);

      await supabase.from('shift_schedules').update({
        shift_template_id: schedB.shift_template_id,
        notes: schedB.notes,
      }).eq('id', schedB.id);
    } catch (err) {
      console.warn('Supabase swap shifts failed:', err);
    }
  }

  setLocal(STORAGE_SCHEDULES, existing);
  return true;
}

// ────────────────────────────────────────────────────────────
// 3. LIVE ATTENDANCE & TIME-CLOCK
// ────────────────────────────────────────────────────────────

export async function getTodayAttendanceLogs(): Promise<AttendanceRecord[]> {
  const today = format(new Date(), 'yyyy-MM-dd');
  return fetchAttendanceRecords(today, today);
}

export async function fetchAttendanceRecords(
  startDate?: string,
  endDate?: string
): Promise<AttendanceRecord[]> {
  const employees = await fetchEmployees();
  const templates = await fetchShiftTemplates();

  if (isSupabaseConfigured) {
    try {
      let query = supabase.from('attendance_records').select('*');
      if (startDate) query = query.gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);

      const { data, error } = await query.order('created_at', { ascending: false });

      if (!error && data) {
        const enriched: AttendanceRecord[] = data.map(r => ({
          ...r,
          total_hours: Number(r.total_hours ?? 0),
          regular_hours: Number(r.regular_hours ?? 0),
          overtime_hours: Number(r.overtime_hours ?? 0),
          late_minutes: Number(r.late_minutes ?? 0),
          employee: employees.find(e => e.id === r.employee_id),
          shift_template: templates.find(t => t.id === r.shift_template_id),
        }));

        const localAll = getLocal<AttendanceRecord>(STORAGE_ATTENDANCE);
        const map = new Map(localAll.map(a => [a.id, a]));
        enriched.forEach(a => map.set(a.id, a));
        setLocal(STORAGE_ATTENDANCE, Array.from(map.values()));
        return enriched;
      }
    } catch (err) {
      console.warn('Supabase attendance records fetch failed; using local:', err);
    }
  }

  let localAll = getLocal<AttendanceRecord>(STORAGE_ATTENDANCE);
  if (startDate) localAll = localAll.filter(a => a.date >= startDate);
  if (endDate) localAll = localAll.filter(a => a.date <= endDate);

  return localAll
    .map(a => ({
      ...a,
      employee: employees.find(e => e.id === a.employee_id),
      shift_template: templates.find(t => t.id === a.shift_template_id),
    }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function clockIn(
  employeeId: string,
  pin: string
): Promise<{ success: boolean; record?: AttendanceRecord; message: string }> {
  const employees = await fetchEmployees();
  const employee = employees.find(e => e.id === employeeId);
  if (!employee) {
    return { success: false, message: 'Employee not found.' };
  }

  if (employee.pin_code !== pin) {
    return { success: false, message: 'Invalid 4-digit PIN. Please try again.' };
  }

  const today = format(new Date(), 'yyyy-MM-dd');
  const now = new Date();
  const nowIso = now.toISOString();

  // Find today's schedule for this employee
  const schedules = await fetchSchedules(today, today);
  const sched = schedules.find(s => s.employee_id === employeeId);
  const template = sched?.shift_template;

  // Calculate late minutes if scheduled
  let lateMinutes = 0;
  if (template?.start_time) {
    const [hh, mm] = template.start_time.split(':').map(Number);
    const scheduledStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh || 0, mm || 0, 0);
    const diffMs = now.getTime() - scheduledStart.getTime();
    if (diffMs > 0) {
      lateMinutes = Math.round(diffMs / (1000 * 60));
    }
  }

  const initialStatus: AttendanceStatus = 'on_duty';

  const newRecord: AttendanceRecord = {
    id: crypto.randomUUID(),
    employee_id: employee.id,
    date: today,
    shift_template_id: template?.id || null,
    clock_in: nowIso,
    clock_out: null,
    break_start: null,
    break_end: null,
    total_hours: 0,
    regular_hours: 0,
    overtime_hours: 0,
    late_minutes: lateMinutes,
    status: initialStatus,
    adjustment_note: null,
    created_at: nowIso,
    employee,
    shift_template: template,
  };

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .insert([{
          id: newRecord.id,
          employee_id: newRecord.employee_id,
          date: newRecord.date,
          shift_template_id: newRecord.shift_template_id,
          clock_in: newRecord.clock_in,
          clock_out: newRecord.clock_out,
          break_start: newRecord.break_start,
          break_end: newRecord.break_end,
          total_hours: newRecord.total_hours,
          regular_hours: newRecord.regular_hours,
          overtime_hours: newRecord.overtime_hours,
          late_minutes: newRecord.late_minutes,
          status: newRecord.status,
          adjustment_note: newRecord.adjustment_note,
          created_at: newRecord.created_at,
        }])
        .select()
        .single();

      if (!error && data) {
        newRecord.id = data.id;
      }
    } catch (err) {
      console.warn('Supabase clock-in insert failed:', err);
    }
  }

  const localAll = getLocal<AttendanceRecord>(STORAGE_ATTENDANCE);
  setLocal(STORAGE_ATTENDANCE, [newRecord, ...localAll]);

  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const timeStr = format(now, 'hh:mm a');
  const lateNote = lateMinutes > 5 ? ` (${lateMinutes}m late)` : '';

  return {
    success: true,
    record: newRecord,
    message: `${greeting}, ${employee.name}! Clocked in at ${timeStr}${lateNote}.`,
  };
}

export async function startBreak(
  recordId: string,
  pin: string
): Promise<{ success: boolean; record?: AttendanceRecord; message: string }> {
  const localAll = getLocal<AttendanceRecord>(STORAGE_ATTENDANCE);
  const record = localAll.find(r => r.id === recordId);
  if (!record) return { success: false, message: 'Attendance record not found.' };

  const employees = await fetchEmployees();
  const emp = employees.find(e => e.id === record.employee_id);
  if (!emp || emp.pin_code !== pin) {
    return { success: false, message: 'Invalid 4-digit PIN. Please try again.' };
  }

  const now = new Date();
  const nowIso = now.toISOString();

  record.break_start = nowIso;
  record.status = 'on_break';

  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('attendance_records')
        .update({
          break_start: nowIso,
          status: 'on_break',
        })
        .eq('id', recordId);
    } catch (err) {
      console.warn('Supabase start break failed:', err);
    }
  }

  setLocal(STORAGE_ATTENDANCE, localAll);

  return {
    success: true,
    record,
    message: `Break started at ${format(now, 'hh:mm a')}. Enjoy your break, ${emp.name}!`,
  };
}

export async function endBreak(
  recordId: string,
  pin: string
): Promise<{ success: boolean; record?: AttendanceRecord; message: string }> {
  const localAll = getLocal<AttendanceRecord>(STORAGE_ATTENDANCE);
  const record = localAll.find(r => r.id === recordId);
  if (!record) return { success: false, message: 'Attendance record not found.' };

  const employees = await fetchEmployees();
  const emp = employees.find(e => e.id === record.employee_id);
  if (!emp || emp.pin_code !== pin) {
    return { success: false, message: 'Invalid 4-digit PIN. Please try again.' };
  }

  const now = new Date();
  const nowIso = now.toISOString();

  record.break_end = nowIso;
  record.status = 'on_duty';

  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('attendance_records')
        .update({
          break_end: nowIso,
          status: 'on_duty',
        })
        .eq('id', recordId);
    } catch (err) {
      console.warn('Supabase end break failed:', err);
    }
  }

  setLocal(STORAGE_ATTENDANCE, localAll);

  return {
    success: true,
    record,
    message: `Welcome back, ${emp.name}! Break ended at ${format(now, 'hh:mm a')}.`,
  };
}

export async function clockOut(
  recordId: string,
  pin: string
): Promise<{ success: boolean; record?: AttendanceRecord; message: string }> {
  const localAll = getLocal<AttendanceRecord>(STORAGE_ATTENDANCE);
  const record = localAll.find(r => r.id === recordId);
  if (!record) return { success: false, message: 'Attendance record not found.' };

  const employees = await fetchEmployees();
  const emp = employees.find(e => e.id === record.employee_id);
  if (!emp || emp.pin_code !== pin) {
    return { success: false, message: 'Invalid 4-digit PIN. Please try again.' };
  }

  const now = new Date();
  const nowIso = now.toISOString();

  // If was on break and didn't clock break_end, close break now
  if (record.break_start && !record.break_end) {
    record.break_end = nowIso;
  }

  record.clock_out = nowIso;

  // Compute total hours
  const inTime = record.clock_in ? new Date(record.clock_in).getTime() : now.getTime();
  const outTime = now.getTime();
  let breakMs = 0;
  if (record.break_start && record.break_end) {
    breakMs = Math.max(0, new Date(record.break_end).getTime() - new Date(record.break_start).getTime());
  }

  const netWorkedMs = Math.max(0, outTime - inTime - breakMs);
  const totalHours = Number((netWorkedMs / (1000 * 60 * 60)).toFixed(2));
  const regularHours = Number(Math.min(totalHours, 8.0).toFixed(2));
  const overtimeHours = Number(Math.max(0, totalHours - 8.0).toFixed(2));

  // Determine final status
  let finalStatus: AttendanceStatus = 'present';
  if (record.late_minutes > 5) {
    finalStatus = 'late';
  } else if (totalHours < 4 && totalHours > 0) {
    finalStatus = 'half_day';
  }

  record.total_hours = totalHours;
  record.regular_hours = regularHours;
  record.overtime_hours = overtimeHours;
  record.status = finalStatus;

  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('attendance_records')
        .update({
          clock_out: record.clock_out,
          break_end: record.break_end,
          total_hours: record.total_hours,
          regular_hours: record.regular_hours,
          overtime_hours: record.overtime_hours,
          status: record.status,
        })
        .eq('id', recordId);
    } catch (err) {
      console.warn('Supabase clock-out failed:', err);
    }
  }

  setLocal(STORAGE_ATTENDANCE, localAll);

  return {
    success: true,
    record,
    message: `Clocked out at ${format(now, 'hh:mm a')}. Great work today, ${emp.name}! (${totalHours} hrs)`,
  };
}

export async function adjustAttendanceRecord(
  recordId: string,
  updateData: {
    clock_in?: string | null;
    clock_out?: string | null;
    break_start?: string | null;
    break_end?: string | null;
    shift_template_id?: string | null;
  },
  managerReason: string
): Promise<{ success: boolean; record?: AttendanceRecord; message: string }> {
  if (!managerReason.trim()) {
    return { success: false, message: 'A manager adjustment reason is required for the audit log.' };
  }

  const localAll = getLocal<AttendanceRecord>(STORAGE_ATTENDANCE);
  const record = localAll.find(r => r.id === recordId);
  if (!record) return { success: false, message: 'Record not found.' };

  // Apply updates
  if (updateData.clock_in !== undefined) record.clock_in = updateData.clock_in;
  if (updateData.clock_out !== undefined) record.clock_out = updateData.clock_out;
  if (updateData.break_start !== undefined) record.break_start = updateData.break_start;
  if (updateData.break_end !== undefined) record.break_end = updateData.break_end;
  if (updateData.shift_template_id !== undefined) record.shift_template_id = updateData.shift_template_id;

  // Recalculate hours
  let totalHours = 0;
  let regularHours = 0;
  let overtimeHours = 0;

  if (record.clock_in && record.clock_out) {
    const inMs = new Date(record.clock_in).getTime();
    const outMs = new Date(record.clock_out).getTime();
    let breakMs = 0;
    if (record.break_start && record.break_end) {
      breakMs = Math.max(0, new Date(record.break_end).getTime() - new Date(record.break_start).getTime());
    }
    const netMs = Math.max(0, outMs - inMs - breakMs);
    totalHours = Number((netMs / (1000 * 60 * 60)).toFixed(2));
    regularHours = Number(Math.min(totalHours, 8.0).toFixed(2));
    overtimeHours = Number(Math.max(0, totalHours - 8.0).toFixed(2));
  }

  record.total_hours = totalHours;
  record.regular_hours = regularHours;
  record.overtime_hours = overtimeHours;
  record.status = totalHours > 0 ? (record.late_minutes > 5 ? 'late' : 'present') : 'on_duty';

  const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm');
  const auditEntry = `[${timestamp}] Adjustment: ${managerReason.trim()}`;
  record.adjustment_note = record.adjustment_note ? `${record.adjustment_note}\n${auditEntry}` : auditEntry;

  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('attendance_records')
        .update({
          clock_in: record.clock_in,
          clock_out: record.clock_out,
          break_start: record.break_start,
          break_end: record.break_end,
          shift_template_id: record.shift_template_id,
          total_hours: record.total_hours,
          regular_hours: record.regular_hours,
          overtime_hours: record.overtime_hours,
          status: record.status,
          adjustment_note: record.adjustment_note,
        })
        .eq('id', recordId);
    } catch (err) {
      console.warn('Supabase attendance adjustment failed:', err);
    }
  }

  setLocal(STORAGE_ATTENDANCE, localAll);

  return {
    success: true,
    record,
    message: 'Attendance record manually adjusted with audit remark.',
  };
}

export interface PosClockInStatus {
  allowed: boolean;
  activeCashierName: string;
  activeEmployee?: Employee;
  reason?: 'not_clocked_in' | 'on_break' | 'no_staff_on_duty';
  message: string;
  allOnDutyCount: number;
}

/**
 * Return all attendance records for today where the employee is currently ON DUTY
 * (i.e., clocked in, not clocked out, and not currently on break).
 */
export async function getCurrentlyOnDutyStaff(): Promise<{
  activeRecords: AttendanceRecord[];
  onBreakRecords: AttendanceRecord[];
}> {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const allToday = await fetchAttendanceRecords(todayStr, todayStr);

  const activeRecords = allToday.filter(
    r => r.clock_in && !r.clock_out && !(r.break_start && !r.break_end)
  );

  const onBreakRecords = allToday.filter(
    r => r.clock_in && !r.clock_out && Boolean(r.break_start && !r.break_end)
  );

  return { activeRecords, onBreakRecords };
}

/**
 * Validates whether sale processing in POS should be permitted based on live clock-in attendance.
 * - If current user maps to an employee record, that specific employee must be on duty.
 * - If current user is an admin or unlinked manager account, at least one staff member must be on duty.
 */
export async function checkPosClockInStatus(
  currentUser?: { id?: string; email?: string; name?: string; role?: string } | null
): Promise<PosClockInStatus> {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [employees, allToday] = await Promise.all([
    fetchEmployees(),
    fetchAttendanceRecords(todayStr, todayStr),
  ]);

  const onDutyRecords = allToday.filter(
    r => r.clock_in && !r.clock_out && !(r.break_start && !r.break_end)
  );

  const onBreakRecords = allToday.filter(
    r => r.clock_in && !r.clock_out && Boolean(r.break_start && !r.break_end)
  );

  // If current logged-in user is an employee, verify their individual shift punch
  if (currentUser) {
    const userEmail = currentUser.email?.toLowerCase().trim();
    const userId = currentUser.id;

    const matchedEmp = employees.find(e =>
      (userId && e.user_id === userId) ||
      (userEmail && e.email?.toLowerCase().trim() === userEmail)
    );

    if (matchedEmp) {
      const empRecord = allToday.find(r => r.employee_id === matchedEmp.id);

      if (!empRecord || !empRecord.clock_in || empRecord.clock_out) {
        return {
          allowed: false,
          activeCashierName: matchedEmp.name,
          activeEmployee: matchedEmp,
          reason: 'not_clocked_in',
          message: `${matchedEmp.name} is not clocked in. You must clock in at the Time Clock to process sales.`,
          allOnDutyCount: onDutyRecords.length,
        };
      }

      if (empRecord.break_start && !empRecord.break_end) {
        return {
          allowed: false,
          activeCashierName: matchedEmp.name,
          activeEmployee: matchedEmp,
          reason: 'on_break',
          message: `${matchedEmp.name} is currently on break. Please end your break at the Time Clock to process sales.`,
          allOnDutyCount: onDutyRecords.length,
        };
      }

      return {
        allowed: true,
        activeCashierName: matchedEmp.name,
        activeEmployee: matchedEmp,
        message: `${matchedEmp.name} is on duty.`,
        allOnDutyCount: onDutyRecords.length,
      };
    }
  }

  // Current user is admin / manager or unlinked terminal account.
  // Check if at least one employee is currently on duty at the counter kiosk
  if (onDutyRecords.length > 0) {
    const primaryCashier = onDutyRecords[0].employee?.name || currentUser?.name || 'On Duty Staff';
    return {
      allowed: true,
      activeCashierName: primaryCashier,
      activeEmployee: onDutyRecords[0].employee,
      message: `${primaryCashier} is on duty.`,
      allOnDutyCount: onDutyRecords.length,
    };
  }

  if (onBreakRecords.length > 0) {
    const breakName = onBreakRecords[0].employee?.name || 'Staff';
    return {
      allowed: false,
      activeCashierName: currentUser?.name || 'Staff',
      reason: 'on_break',
      message: `${breakName} is currently on break. End break or clock in to process sales.`,
      allOnDutyCount: 0,
    };
  }

  return {
    allowed: false,
    activeCashierName: currentUser?.name || 'Staff',
    reason: 'no_staff_on_duty',
    message: 'No employee is currently clocked in. A staff member must clock in at the Time Clock to process sales.',
    allOnDutyCount: 0,
  };
}
