import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Clock, Calendar, Plus, Search, Edit2, Key,
  Trash2, Download, AlertCircle, Coffee,
  ArrowRightLeft, Settings2, X, Save,
  Play, UserCheck, UserX, ChevronLeft, ChevronRight,
  Shield, Eye, EyeOff, Sparkles
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, isSameDay } from 'date-fns';
import toast from 'react-hot-toast';
import Sidebar from '../components/Layout/Sidebar';
import TopBar from '../components/Layout/TopBar';
import {
  fetchEmployees,
  createEmployee,
  updateEmployee,
  updateEmployeePin,
  deleteEmployee,
  toggleEmployeeStatus,
  fetchShiftTemplates,
  createShiftTemplate,
  deleteShiftTemplate,
  fetchSchedules,
  assignShift,
  swapShifts,
  fetchAttendanceRecords,
  adjustAttendanceRecord,
  type Employee,
  type ShiftTemplate,
  type ShiftSchedule,
  type AttendanceRecord,
  type EmployeeRole,
  type EmploymentType,
  type EmployeeStatus,
} from '../lib/employeeDb';
import './Employees.css';

type MainTab = 'directory' | 'attendance' | 'roster';
type DateFilterRange = 'today' | 'week' | 'month' | 'custom';

const ROLE_OPTIONS: EmployeeRole[] = [
  'Store Manager',
  'Head Barista',
  'Barista',
  'Cashier',
  'Kitchen',
];

export default function EmployeesPage() {
  const [activeTab, setActiveTab] = useState<MainTab>('directory');

  // Data states
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
  const [schedules, setSchedules] = useState<ShiftSchedule[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [_loading, setLoading] = useState(true);

  // Tab 1 (Directory) states
  const [dirSearch, setDirSearch] = useState('');
  const [dirRoleFilter, setDirRoleFilter] = useState<string>('all');
  const [showAddEmpModal, setShowAddEmpModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [pinChangeEmp, setPinChangeEmp] = useState<Employee | null>(null);
  const [newPinValue, setNewPinValue] = useState('');

  // System Login Access Config states
  const [grantSystemAccess, setGrantSystemAccess] = useState(false);
  const [systemUsername, setSystemUsername] = useState('');
  const [systemPassword, setSystemPassword] = useState('');
  const [showSystemPassword, setShowSystemPassword] = useState(false);
  const [systemRole, setSystemRole] = useState<'admin' | 'employee'>('employee');

  // Add / Edit Employee Form
  const [empForm, setEmpForm] = useState({
    employee_code: '',
    name: '',
    email: '',
    phone: '',
    role: 'Barista' as EmployeeRole,
    employment_type: 'part_time' as EmploymentType,
    hourly_rate: '85.00',
    pin_code: '1234',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    hire_date: format(new Date(), 'yyyy-MM-dd'),
    status: 'active' as EmployeeStatus,
  });

  // Tab 2 (Attendance) states
  const [dateRangeType, setDateRangeType] = useState<DateFilterRange>('today');
  const [customStartDate, setCustomStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [adjustingRecord, setAdjustingRecord] = useState<AttendanceRecord | null>(null);
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjClockIn, setAdjClockIn] = useState('');
  const [adjClockOut, setAdjClockOut] = useState('');
  const [adjBreakStart, setAdjBreakStart] = useState('');
  const [adjBreakEnd, setAdjBreakEnd] = useState('');

  // Tab 3 (Roster & Scheduling) states
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [newTemplateForm, setNewTemplateForm] = useState({
    name: '',
    start_time: '06:00',
    end_time: '14:00',
    break_minutes: 30,
    color: '#D97706',
  });
  const [assigningSlot, setAssigningSlot] = useState<{ employeeId: string; date: string } | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [slotNotes, setSlotNotes] = useState<string>('');
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapSchedA, setSwapSchedA] = useState<string>('');
  const [swapSchedB, setSwapSchedB] = useState<string>('');

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const todayDateStr = format(new Date(), 'yyyy-MM-dd');
      const weekStartStr = format(selectedWeekStart, 'yyyy-MM-dd');
      const weekEndStr = format(addDays(selectedWeekStart, 6), 'yyyy-MM-dd');

      const [emps, tpls, scheds, att] = await Promise.all([
        fetchEmployees(),
        fetchShiftTemplates(),
        fetchSchedules(weekStartStr, weekEndStr),
        fetchAttendanceRecords(
          dateRangeType === 'today' ? todayDateStr : undefined,
          dateRangeType === 'today' ? todayDateStr : undefined
        ),
      ]);

      setEmployees(emps);
      setShiftTemplates(tpls);
      setSchedules(scheds);
      setAttendanceRecords(att);
    } catch (err) {
      console.error('Failed to load employee management data:', err);
      toast.error('Failed to load employee records');
    } finally {
      setLoading(false);
    }
  }, [selectedWeekStart, dateRangeType]);

  // Load initial data
  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Refresh attendance data whenever someone clocks in/out via TopBar
  useEffect(() => {
    const handleTimeClockUpdated = () => {
      loadAllData();
    };
    window.addEventListener('timeclock-updated', handleTimeClockUpdated);
    return () => window.removeEventListener('timeclock-updated', handleTimeClockUpdated);
  }, [loadAllData]);

  // Reload schedules when week navigation changes
  useEffect(() => {
    async function loadWeekSchedules() {
      const weekStartStr = format(selectedWeekStart, 'yyyy-MM-dd');
      const weekEndStr = format(addDays(selectedWeekStart, 6), 'yyyy-MM-dd');
      try {
        const scheds = await fetchSchedules(weekStartStr, weekEndStr);
        setSchedules(scheds);
      } catch (err) {
        console.error('Failed to load weekly schedules', err);
      }
    }
    loadWeekSchedules();
  }, [selectedWeekStart]);

  // Reload attendance when date filter changes
  useEffect(() => {
    async function loadFilteredAttendance() {
      let start: string | undefined;
      let end: string | undefined;
      const today = new Date();

      if (dateRangeType === 'today') {
        start = format(today, 'yyyy-MM-dd');
        end = format(today, 'yyyy-MM-dd');
      } else if (dateRangeType === 'week') {
        start = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        end = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      } else if (dateRangeType === 'month') {
        start = format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd');
        end = format(new Date(today.getFullYear(), today.getMonth() + 1, 0), 'yyyy-MM-dd');
      } else {
        start = customStartDate;
        end = customEndDate;
      }

      try {
        const att = await fetchAttendanceRecords(start, end);
        setAttendanceRecords(att);
      } catch (err) {
        console.error('Failed to load attendance records', err);
      }
    }
    loadFilteredAttendance();
  }, [dateRangeType, customStartDate, customEndDate]);

  // ────────────────────────────────────────────────────────────
  // Live Metrics (Computed Dynamically)
  // ────────────────────────────────────────────────────────────
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const metrics = useMemo(() => {
    const activeStaffCount = employees.filter(e => e.status === 'active').length;

    // Today's attendance punches
    const todayPunches = attendanceRecords.filter(a => a.date === todayStr);

    const onDutyCount = todayPunches.filter(
      a => a.clock_in && !a.clock_out && !(a.break_start && !a.break_end)
    ).length;

    const onBreakCount = todayPunches.filter(
      a => a.break_start && !a.break_end && !a.clock_out
    ).length;

    const scheduledTodayCount = schedules.filter(
      s => s.date === todayStr && s.shift_template_id
    ).length;

    const lateTodayCount = todayPunches.filter(
      a => (a.late_minutes ?? 0) > 5
    ).length;

    return {
      activeStaffCount,
      onDutyCount,
      onBreakCount,
      scheduledTodayCount,
      lateTodayCount,
    };
  }, [employees, attendanceRecords, schedules, todayStr]);

  // Who's In Panel Data (Active baristas currently working)
  const currentlyWorkingList = useMemo(() => {
    return attendanceRecords.filter(
      a => a.date === todayStr && a.clock_in && !a.clock_out
    );
  }, [attendanceRecords, todayStr]);

  // Filtered employees for Directory tab
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchSearch =
        emp.name.toLowerCase().includes(dirSearch.toLowerCase()) ||
        emp.employee_code.toLowerCase().includes(dirSearch.toLowerCase()) ||
        (emp.email && emp.email.toLowerCase().includes(dirSearch.toLowerCase())) ||
        emp.role.toLowerCase().includes(dirSearch.toLowerCase());

      const matchRole = dirRoleFilter === 'all' || emp.role === dirRoleFilter;

      return matchSearch && matchRole;
    });
  }, [employees, dirSearch, dirRoleFilter]);

  // Filtered attendance for Timesheets tab
  const filteredAttendance = useMemo(() => {
    return attendanceRecords.filter(r => {
      const empName = r.employee?.name || '';
      const empCode = r.employee?.employee_code || '';
      return (
        empName.toLowerCase().includes(attendanceSearch.toLowerCase()) ||
        empCode.toLowerCase().includes(attendanceSearch.toLowerCase())
      );
    });
  }, [attendanceRecords, attendanceSearch]);

  // ────────────────────────────────────────────────────────────
  // Employee Directory Handlers
  // ────────────────────────────────────────────────────────────
  function openAddModal() {
    setEditingEmp(null);
    setGrantSystemAccess(false);
    setSystemUsername('');
    setSystemPassword('');
    setShowSystemPassword(false);
    setSystemRole('employee');
    setEmpForm({
      employee_code: '',
      name: '',
      email: '',
      phone: '',
      role: 'Barista',
      employment_type: 'part_time',
      hourly_rate: '85.00',
      pin_code: '1234',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      hire_date: format(new Date(), 'yyyy-MM-dd'),
      status: 'active',
    });
    setShowAddEmpModal(true);
  }

  function openEditModal(emp: Employee) {
    setEditingEmp(emp);
    const hasSys = Boolean(emp.has_system_access || emp.user_id);
    setGrantSystemAccess(hasSys);
    const emailUser = emp.email?.includes('@')
      ? emp.email.split('@')[0]
      : emp.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    setSystemUsername(emailUser || '');
    setSystemPassword('');
    setShowSystemPassword(false);
    setSystemRole(
      (emp.system_role || (emp.role === 'Store Manager' ? 'admin' : 'employee')) as 'admin' | 'employee'
    );
    setEmpForm({
      employee_code: emp.employee_code,
      name: emp.name,
      email: emp.email || '',
      phone: emp.phone || '',
      role: emp.role as EmployeeRole,
      employment_type: emp.employment_type,
      hourly_rate: String(emp.hourly_rate),
      pin_code: emp.pin_code,
      emergency_contact_name: emp.emergency_contact_name || '',
      emergency_contact_phone: emp.emergency_contact_phone || '',
      hire_date: emp.hire_date,
      status: emp.status,
    });
    setShowAddEmpModal(true);
  }

  async function handleSaveEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!empForm.name.trim()) {
      toast.error('Employee name is required');
      return;
    }
    if (!/^\d{4}$/.test(empForm.pin_code)) {
      toast.error('PIN code must be exactly 4 digits');
      return;
    }

    let fullEmail = empForm.email?.trim() || null;
    if (grantSystemAccess) {
      const cleanUsername = systemUsername.trim().toLowerCase().replace(/@espro\.ph$/i, '').replace(/@.*$/, '');
      if (!cleanUsername) {
        toast.error('Please enter a username for ESPRO system login');
        return;
      }
      fullEmail = `${cleanUsername}@espro.ph`;
      if (!editingEmp && (!systemPassword || systemPassword.length < 6)) {
        toast.error('Password must be at least 6 characters for system login');
        return;
      }
      if (editingEmp && systemPassword && systemPassword.length < 6) {
        toast.error('Password must be at least 6 characters');
        return;
      }
    }

    const systemConfig = {
      grantAccess: grantSystemAccess,
      email: fullEmail || (empForm.email?.trim() ? empForm.email.trim() : `${systemUsername.trim().toLowerCase()}@espro.ph`),
      password: systemPassword || undefined,
      systemRole,
    };

    try {
      if (editingEmp) {
        const updated = await updateEmployee(
          editingEmp.id,
          {
            name: empForm.name,
            email: fullEmail,
            phone: empForm.phone || null,
            role: empForm.role,
            employment_type: empForm.employment_type,
            hourly_rate: Number(empForm.hourly_rate),
            pin_code: empForm.pin_code,
            emergency_contact_name: empForm.emergency_contact_name || null,
            emergency_contact_phone: empForm.emergency_contact_phone || null,
            hire_date: empForm.hire_date,
            status: empForm.status,
          },
          systemConfig
        );
        setEmployees(prev => prev.map(e => (e.id === updated.id ? updated : e)));
        toast.success(`Updated ${updated.name}${grantSystemAccess ? ' (ESPRO System Access Enabled)' : ''}`);
      } else {
        const created = await createEmployee(
          {
            employee_code: empForm.employee_code || undefined,
            name: empForm.name,
            email: fullEmail,
            phone: empForm.phone || null,
            role: empForm.role,
            employment_type: empForm.employment_type,
            hourly_rate: Number(empForm.hourly_rate),
            pin_code: empForm.pin_code,
            emergency_contact_name: empForm.emergency_contact_name || null,
            emergency_contact_phone: empForm.emergency_contact_phone || null,
            hire_date: empForm.hire_date,
            status: empForm.status,
          },
          systemConfig
        );
        setEmployees(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        toast.success(
          `Registered ${created.name} (${created.employee_code})${
            grantSystemAccess ? ' with ESPRO login access' : ''
          }`
        );
      }
      setShowAddEmpModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save employee');
    }
  }

  async function handleChangePin(e: React.FormEvent) {
    e.preventDefault();
    if (!pinChangeEmp) return;
    if (!/^\d{4}$/.test(newPinValue)) {
      toast.error('PIN must be exactly 4 digits');
      return;
    }

    try {
      await updateEmployeePin(pinChangeEmp.id, newPinValue);
      setEmployees(prev =>
        prev.map(e => (e.id === pinChangeEmp.id ? { ...e, pin_code: newPinValue } : e))
      );
      toast.success(`Updated PIN for ${pinChangeEmp.name}`);
      setPinChangeEmp(null);
      setNewPinValue('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update PIN');
    }
  }

  async function handleToggleStatus(emp: Employee) {
    const nextStatus: EmployeeStatus = emp.status === 'active' ? 'inactive' : 'active';
    try {
      const updated = await toggleEmployeeStatus(emp.id, nextStatus);
      setEmployees(prev => prev.map(e => (e.id === emp.id ? updated : e)));
      toast.success(`Status changed to ${nextStatus}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to change status');
    }
  }

  async function handleDeleteEmployee(emp: Employee) {
    if (!window.confirm(`Are you sure you want to remove ${emp.name}?`)) return;
    try {
      await deleteEmployee(emp.id);
      setEmployees(prev => prev.filter(e => e.id !== emp.id));
      toast.success(`Removed ${emp.name}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete employee');
    }
  }

  // ────────────────────────────────────────────────────────────
  // Timesheet & Adjustment Handlers
  // ────────────────────────────────────────────────────────────
  function openAdjustmentModal(record: AttendanceRecord) {
    setAdjustingRecord(record);
    setAdjustmentReason('');
    setAdjClockIn(record.clock_in ? format(new Date(record.clock_in), "yyyy-MM-dd'T'HH:mm") : '');
    setAdjClockOut(record.clock_out ? format(new Date(record.clock_out), "yyyy-MM-dd'T'HH:mm") : '');
    setAdjBreakStart(record.break_start ? format(new Date(record.break_start), "yyyy-MM-dd'T'HH:mm") : '');
    setAdjBreakEnd(record.break_end ? format(new Date(record.break_end), "yyyy-MM-dd'T'HH:mm") : '');
  }

  async function handleSaveAdjustment(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustingRecord) return;
    if (!adjustmentReason.trim()) {
      toast.error('A manager reason is mandatory for the audit log');
      return;
    }

    try {
      const res = await adjustAttendanceRecord(
        adjustingRecord.id,
        {
          clock_in: adjClockIn ? new Date(adjClockIn).toISOString() : null,
          clock_out: adjClockOut ? new Date(adjClockOut).toISOString() : null,
          break_start: adjBreakStart ? new Date(adjBreakStart).toISOString() : null,
          break_end: adjBreakEnd ? new Date(adjBreakEnd).toISOString() : null,
        },
        adjustmentReason
      );

      if (res.success && res.record) {
        setAttendanceRecords(prev =>
          prev.map(r => (r.id === res.record!.id ? res.record! : r))
        );
        toast.success(res.message);
        setAdjustingRecord(null);
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || 'Adjustment failed');
    }
  }

  // Export to CSV calculation for payroll
  function handleExportCSV() {
    if (filteredAttendance.length === 0) {
      toast.error('No attendance records to export');
      return;
    }

    const headers = [
      'Date',
      'Employee Code',
      'Employee Name',
      'Role',
      'Employment Type',
      'Shift',
      'Clock In',
      'Clock Out',
      'Break Duration (mins)',
      'Regular Hours',
      'Overtime Hours',
      'Total Hours',
      'Hourly Rate (PHP)',
      'Estimated Wage (PHP)',
      'Late (mins)',
      'Status',
      'Audit Notes',
    ];

    const rows = filteredAttendance.map(r => {
      const emp = r.employee;
      const hourlyRate = emp?.hourly_rate ?? 0;
      const totalHours = r.total_hours ?? 0;
      const regHours = r.regular_hours ?? 0;
      const otHours = r.overtime_hours ?? 0;
      // Overtime 1.25x rate standard
      const estimatedWage = (regHours * hourlyRate + otHours * hourlyRate * 1.25).toFixed(2);

      let breakMins = 0;
      if (r.break_start && r.break_end) {
        breakMins = Math.round(
          (new Date(r.break_end).getTime() - new Date(r.break_start).getTime()) / (1000 * 60)
        );
      }

      return [
        r.date,
        emp?.employee_code || '',
        emp?.name || '',
        emp?.role || '',
        emp?.employment_type || '',
        r.shift_template?.name || 'Unassigned',
        r.clock_in ? format(new Date(r.clock_in), 'hh:mm a') : 'N/A',
        r.clock_out ? format(new Date(r.clock_out), 'hh:mm a') : 'Working',
        breakMins,
        regHours,
        otHours,
        totalHours,
        hourlyRate,
        estimatedWage,
        r.late_minutes ?? 0,
        r.status,
        r.adjustment_note ? `"${r.adjustment_note.replace(/"/g, '""')}"` : '""',
      ].map(v => `"${String(v ?? '')}"`);
    });

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Espro_Attendance_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Attendance timesheet exported to CSV');
  }

  // ────────────────────────────────────────────────────────────
  // Roster & Scheduling Handlers
  // ────────────────────────────────────────────────────────────
  const weekDays = useMemo(() => {
    return [0, 1, 2, 3, 4, 5, 6].map(offset => addDays(selectedWeekStart, offset));
  }, [selectedWeekStart]);

  function handleOpenAssignModal(employeeId: string, date: string) {
    const existing = schedules.find(s => s.employee_id === employeeId && s.date === date);
    setAssigningSlot({ employeeId, date });
    setSelectedTemplateId(existing?.shift_template_id || '');
    setSlotNotes(existing?.notes || '');
  }

  async function handleSaveShiftAssignment() {
    if (!assigningSlot) return;
    try {
      await assignShift(
        assigningSlot.employeeId,
        selectedTemplateId || null,
        assigningSlot.date,
        slotNotes
      );
      // Reload week schedules
      const weekStartStr = format(selectedWeekStart, 'yyyy-MM-dd');
      const weekEndStr = format(addDays(selectedWeekStart, 6), 'yyyy-MM-dd');
      const updated = await fetchSchedules(weekStartStr, weekEndStr);
      setSchedules(updated);
      toast.success('Shift schedule saved');
      setAssigningSlot(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign shift');
    }
  }

  async function handleSwapShiftsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!swapSchedA || !swapSchedB) {
      toast.error('Please select both schedules to swap');
      return;
    }
    try {
      await swapShifts(swapSchedA, swapSchedB);
      const weekStartStr = format(selectedWeekStart, 'yyyy-MM-dd');
      const weekEndStr = format(addDays(selectedWeekStart, 6), 'yyyy-MM-dd');
      const updated = await fetchSchedules(weekStartStr, weekEndStr);
      setSchedules(updated);
      toast.success('Shifts successfully swapped!');
      setShowSwapModal(false);
      setSwapSchedA('');
      setSwapSchedB('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to swap shifts');
    }
  }

  async function handleCreateShiftTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTemplateForm.name.trim()) {
      toast.error('Shift template name is required');
      return;
    }
    try {
      const created = await createShiftTemplate({
        name: newTemplateForm.name,
        start_time: newTemplateForm.start_time,
        end_time: newTemplateForm.end_time,
        break_minutes: Number(newTemplateForm.break_minutes),
        color: newTemplateForm.color,
      });
      setShiftTemplates(prev => [...prev, created]);
      toast.success(`Created shift template: ${created.name}`);
      setNewTemplateForm({
        name: '',
        start_time: '06:00',
        end_time: '14:00',
        break_minutes: 30,
        color: '#D97706',
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create template');
    }
  }

  async function handleDeleteTemplate(id: string) {
    if (!window.confirm('Are you sure you want to delete this shift template?')) return;
    try {
      await deleteShiftTemplate(id);
      setShiftTemplates(prev => prev.filter(t => t.id !== id));
      toast.success('Shift template deleted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete shift template');
    }
  }

  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        <TopBar
          title="Employee Management & Attendance"
        />

        <div className="page-body employees-page-body">
          {/* Header Description */}
          <div className="emp-page-header">
            <p className="emp-page-subtitle">
              Manage your café staff, view real-time attendance, and schedule weekly barista rosters.
            </p>
          </div>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* LIVE METRICS CARDS (Computed Dynamically)                   */}
          {/* ════════════════════════════════════════════════════════════ */}
          <div className="emp-metrics-grid">
            <div className="emp-metric-card">
              <div className="metric-icon-box total-staff">
                <Users size={22} />
              </div>
              <div className="metric-info">
                <span className="metric-val">{metrics.activeStaffCount}</span>
                <span className="metric-label">Total Active Staff</span>
              </div>
            </div>

            <div className="emp-metric-card">
              <div className="metric-icon-box on-duty">
                <Play size={22} />
              </div>
              <div className="metric-info">
                <span className="metric-val">{metrics.onDutyCount}</span>
                <span className="metric-label">Currently On Duty</span>
              </div>
            </div>

            <div className="emp-metric-card">
              <div className="metric-icon-box on-break">
                <Coffee size={22} />
              </div>
              <div className="metric-info">
                <span className="metric-val">{metrics.onBreakCount}</span>
                <span className="metric-label">On Break</span>
              </div>
            </div>

            <div className="emp-metric-card">
              <div className="metric-icon-box scheduled">
                <Calendar size={22} />
              </div>
              <div className="metric-info">
                <span className="metric-val">{metrics.scheduledTodayCount}</span>
                <span className="metric-label">Scheduled Today</span>
              </div>
            </div>

            <div className="emp-metric-card">
              <div className="metric-icon-box late">
                <AlertCircle size={22} />
              </div>
              <div className="metric-info">
                <span className="metric-val">{metrics.lateTodayCount}</span>
                <span className="metric-label">Late Today</span>
              </div>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* NAVIGATION TABS                                              */}
          {/* ════════════════════════════════════════════════════════════ */}
          <div className="emp-tabs-nav">
            <button
              type="button"
              className={`emp-tab-btn ${activeTab === 'directory' ? 'active' : ''}`}
              onClick={() => setActiveTab('directory')}
            >
              <Users size={18} />
              <span>Staff Directory</span>
              <span className="emp-tab-count">{employees.length}</span>
              {activeTab === 'directory' && (
                <motion.div
                  layoutId="emp-active-tab-line"
                  className="emp-tab-indicator"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}
            </button>

            <button
              type="button"
              className={`emp-tab-btn ${activeTab === 'attendance' ? 'active' : ''}`}
              onClick={() => setActiveTab('attendance')}
            >
              <Clock size={18} />
              <span>Attendance & Timesheets</span>
              {metrics.onDutyCount > 0 && (
                <span className="emp-tab-pulse green">{metrics.onDutyCount} in</span>
              )}
              {activeTab === 'attendance' && (
                <motion.div
                  layoutId="emp-active-tab-line"
                  className="emp-tab-indicator"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}
            </button>

            <button
              type="button"
              className={`emp-tab-btn ${activeTab === 'roster' ? 'active' : ''}`}
              onClick={() => setActiveTab('roster')}
            >
              <Calendar size={18} />
              <span>Shift Roster & Scheduling</span>
              {activeTab === 'roster' && (
                <motion.div
                  layoutId="emp-active-tab-line"
                  className="emp-tab-indicator"
                  transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                />
              )}
            </button>
          </div>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* TAB 1: STAFF DIRECTORY                                       */}
          {/* ════════════════════════════════════════════════════════════ */}
          {activeTab === 'directory' && (
            <div className="emp-tab-content">
              {/* Directory Controls */}
              <div className="emp-toolbar">
                <div className="emp-search-box">
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    className="input emp-search-input"
                    placeholder="Search by barista name, code (EMP-001), or role..."
                    value={dirSearch}
                    onChange={e => setDirSearch(e.target.value)}
                  />
                </div>

                <div className="emp-filters">
                  <select
                    className="input emp-select-filter"
                    value={dirRoleFilter}
                    onChange={e => setDirRoleFilter(e.target.value)}
                  >
                    <option value="all">All Roles</option>
                    {ROLE_OPTIONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>

                  <button className="btn btn-primary" onClick={openAddModal}>
                    <Plus size={16} />
                    <span>Add Employee</span>
                  </button>
                </div>
              </div>

              {/* Employees Table / Empty State */}
              {filteredEmployees.length === 0 ? (
                <div className="emp-empty-state">
                  <div className="empty-icon-wrap">
                    <Users size={48} />
                  </div>
                  <h3>No employees added yet</h3>
                  <p>
                    {employees.length === 0
                      ? "Click 'Add Employee' to register your first barista, cashier, or store manager."
                      : 'No employees match your search or filter criteria.'}
                  </p>
                  <button className="btn btn-primary" onClick={openAddModal} style={{ marginTop: 14 }}>
                    <Plus size={16} />
                    <span>Add First Employee</span>
                  </button>
                </div>
              ) : (
                <div className="emp-table-container">
                  <table className="emp-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Barista / Staff</th>
                        <th>Café Role</th>
                        <th>System Access</th>
                        <th>Type</th>
                        <th>Hourly Rate</th>
                        <th>Emergency Contact</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEmployees.map(emp => (
                        <tr key={emp.id}>
                          <td>
                            <span className="emp-code-pill">{emp.employee_code}</span>
                          </td>
                          <td>
                            <div className="emp-cell-user">
                              <div className="emp-avatar">
                                {emp.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="emp-user-name">{emp.name}</div>
                                <div className="emp-user-email">
                                  {emp.email || emp.phone || 'No contact email'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="role-tag">{emp.role}</span>
                          </td>
                          <td>
                            {emp.has_system_access ? (
                              <span
                                className="access-badge badge-system-user"
                                title={`ESPRO Login: ${emp.email || ''}`}
                              >
                                <Shield size={12} />
                                <span>ESPRO ({emp.system_role === 'admin' ? 'Admin' : 'POS'})</span>
                              </span>
                            ) : (
                              <span
                                className="access-badge badge-kiosk-only"
                                title="PIN Clock-In Only (Floor Crew)"
                              >
                                <Clock size={12} />
                                <span>Kiosk Only</span>
                              </span>
                            )}
                          </td>
                          <td>
                            <span className="type-tag">
                              {emp.employment_type === 'full_time' ? 'Full-Time' : 'Part-Time'}
                            </span>
                          </td>
                          <td>
                            <strong>₱{Number(emp.hourly_rate).toFixed(2)}</strong>
                            <span className="rate-sub">/hr</span>
                          </td>
                          <td>
                            {emp.emergency_contact_name ? (
                              <div className="emp-emerg">
                                <span>{emp.emergency_contact_name}</span>
                                {emp.emergency_contact_phone && (
                                  <small>({emp.emergency_contact_phone})</small>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td>
                            <span className={`status-badge status-${emp.status}`}>
                              {emp.status}
                            </span>
                          </td>
                          <td>
                            <div className="emp-actions-cell">
                              <button
                                className="action-btn"
                                onClick={() => openEditModal(emp)}
                                title="Edit Details"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                className="action-btn"
                                onClick={() => {
                                  setPinChangeEmp(emp);
                                  setNewPinValue('');
                                }}
                                title="Change 4-Digit PIN"
                              >
                                <Key size={15} />
                              </button>
                              <button
                                className={`action-btn ${emp.status === 'active' ? 'warn' : 'succ'}`}
                                onClick={() => handleToggleStatus(emp)}
                                title={emp.status === 'active' ? 'Deactivate' : 'Activate'}
                              >
                                {emp.status === 'active' ? <UserX size={15} /> : <UserCheck size={15} />}
                              </button>
                              <button
                                className="action-btn danger"
                                onClick={() => handleDeleteEmployee(emp)}
                                title="Delete"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════ */}
          {/* TAB 2: ATTENDANCE & TIMESHEETS                               */}
          {/* ════════════════════════════════════════════════════════════ */}
          {activeTab === 'attendance' && (
            <div className="emp-tab-content">
              {/* Who's In Panel */}
              <div className="whos-in-panel">
                <div className="whos-in-header">
                  <div className="whos-in-title">
                    <span className="pulse-dot green" />
                    <h3>Live "Who's In" Status Panel</h3>
                  </div>
                  <span className="whos-in-count">
                    {currentlyWorkingList.length} staff currently on clock
                  </span>
                </div>

                {currentlyWorkingList.length === 0 ? (
                  <div className="whos-in-empty">
                    <Coffee size={24} />
                    <span>No staff currently clocked in. Counter is ready for barista arrival.</span>
                  </div>
                ) : (
                  <div className="whos-in-cards">
                    {currentlyWorkingList.map(r => {
                      const isOnBreak = r.break_start && !r.break_end;
                      const clockInDate = new Date(r.clock_in!);
                      const elapsedMins = Math.max(
                        0,
                        Math.round((new Date().getTime() - clockInDate.getTime()) / (1000 * 60))
                      );
                      const elapsedH = Math.floor(elapsedMins / 60);
                      const elapsedM = elapsedMins % 60;

                      return (
                        <div key={r.id} className={`whos-in-card ${isOnBreak ? 'card-break' : 'card-duty'}`}>
                          <div className="whos-avatar">
                            {r.employee?.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="whos-details">
                            <div className="whos-name">{r.employee?.name}</div>
                            <div className="whos-role">
                              {r.employee?.role} • Clocked in {format(clockInDate, 'hh:mm a')}
                            </div>
                            <div className="whos-elapsed">
                              Worked: <strong>{elapsedH}h {elapsedM}m</strong>
                            </div>
                          </div>
                          <div className="whos-badge-wrap">
                            <span className={`status-pill ${isOnBreak ? 'pill-break' : 'pill-duty'}`}>
                              {isOnBreak ? 'On Break' : 'On Duty'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Timesheet Date Filters & Actions */}
              <div className="emp-toolbar" style={{ marginTop: 24 }}>
                <div className="date-pills">
                  {(['today', 'week', 'month', 'custom'] as DateFilterRange[]).map(df => (
                    <button
                      key={df}
                      className={`date-pill ${dateRangeType === df ? 'active' : ''}`}
                      onClick={() => setDateRangeType(df)}
                    >
                      {df === 'today' ? 'Today' : df === 'week' ? 'This Week' : df === 'month' ? 'This Month' : 'Custom'}
                    </button>
                  ))}
                </div>

                {dateRangeType === 'custom' && (
                  <div className="custom-date-inputs">
                    <input
                      type="date"
                      className="input date-inp"
                      value={customStartDate}
                      onChange={e => setCustomStartDate(e.target.value)}
                    />
                    <span>to</span>
                    <input
                      type="date"
                      className="input date-inp"
                      value={customEndDate}
                      onChange={e => setCustomEndDate(e.target.value)}
                    />
                  </div>
                )}

                <div className="emp-search-box" style={{ maxWidth: 260 }}>
                  <Search size={15} className="search-icon" />
                  <input
                    type="text"
                    className="input emp-search-input"
                    placeholder="Search staff..."
                    value={attendanceSearch}
                    onChange={e => setAttendanceSearch(e.target.value)}
                  />
                </div>

                <div style={{ marginLeft: 'auto' }}>
                  <button className="btn btn-secondary" onClick={handleExportCSV}>
                    <Download size={16} />
                    <span>Export to CSV</span>
                  </button>
                </div>
              </div>

              {/* Attendance Table */}
              {filteredAttendance.length === 0 ? (
                <div className="emp-empty-state">
                  <div className="empty-icon-wrap">
                    <Clock size={48} />
                  </div>
                  <h3>No attendance records found</h3>
                  <p>No punches recorded for the selected time period. Staff can clock in using the Time Clock Kiosk.</p>
                  <button
                    className="btn btn-primary"
                    onClick={() => window.dispatchEvent(new CustomEvent('open-time-clock'))}
                    style={{ marginTop: 14 }}
                  >
                    <Clock size={16} />
                    <span>Open Time Clock Kiosk</span>
                  </button>
                </div>
              ) : (
                <div className="emp-table-container">
                  <table className="emp-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Staff</th>
                        <th>Shift</th>
                        <th>Clock In</th>
                        <th>Clock Out</th>
                        <th>Total Hours</th>
                        <th>Overtime</th>
                        <th>Late</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAttendance.map(att => (
                        <tr key={att.id}>
                          <td>{att.date}</td>
                          <td>
                            <div className="emp-cell-user">
                              <div className="emp-avatar small">
                                {att.employee?.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="emp-user-name">{att.employee?.name}</div>
                                <div className="emp-user-email">{att.employee?.employee_code}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            {att.shift_template ? (
                              <span
                                className="shift-pill"
                                style={{
                                  backgroundColor: `${att.shift_template.color}18`,
                                  color: att.shift_template.color,
                                }}
                              >
                                {att.shift_template.name}
                              </span>
                            ) : (
                              <span className="text-muted">Direct</span>
                            )}
                          </td>
                          <td>
                            {att.clock_in ? format(new Date(att.clock_in), 'hh:mm a') : '—'}
                          </td>
                          <td>
                            {att.clock_out ? (
                              format(new Date(att.clock_out), 'hh:mm a')
                            ) : (
                              <span className="working-pill">Working</span>
                            )}
                          </td>
                          <td>
                            <strong>{att.total_hours}h</strong>
                          </td>
                          <td>
                            {att.overtime_hours > 0 ? (
                              <span className="ot-badge">+{att.overtime_hours}h</span>
                            ) : (
                              '0h'
                            )}
                          </td>
                          <td>
                            {att.late_minutes > 5 ? (
                              <span className="late-badge">{att.late_minutes}m late</span>
                            ) : (
                              <span className="on-time-badge">On Time</span>
                            )}
                          </td>
                          <td>
                            <span className={`status-badge status-${att.status}`}>
                              {att.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td>
                            <div className="emp-actions-cell">
                              <button
                                className="action-btn"
                                onClick={() => openAdjustmentModal(att)}
                                title="Manual Manager Adjustment"
                              >
                                <Edit2 size={14} />
                                <span style={{ fontSize: '0.75rem', marginLeft: 4 }}>Adjust</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════ */}
          {/* TAB 3: SHIFT ROSTER & SCHEDULING                             */}
          {/* ════════════════════════════════════════════════════════════ */}
          {activeTab === 'roster' && (
            <div className="emp-tab-content">
              {/* Roster Controls & Navigation */}
              <div className="roster-toolbar">
                <div className="roster-week-nav">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setSelectedWeekStart(prev => subWeeks(prev, 1))}
                    title="Previous Week"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <div className="roster-current-week">
                    <strong>Week of {format(selectedWeekStart, 'MMMM d, yyyy')}</strong>
                    <span className="roster-week-sub">
                      ({format(selectedWeekStart, 'MMM d')} – {format(addDays(selectedWeekStart, 6), 'MMM d, yyyy')})
                    </span>
                  </div>

                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setSelectedWeekStart(prev => addWeeks(prev, 1))}
                    title="Next Week"
                  >
                    <ChevronRight size={16} />
                  </button>

                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setSelectedWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
                  >
                    Current Week
                  </button>
                </div>

                <div className="roster-actions">
                  <button
                    className="btn btn-ghost"
                    onClick={() => setShowTemplateModal(true)}
                  >
                    <Settings2 size={16} />
                    <span>Shift Templates</span>
                  </button>

                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowSwapModal(true)}
                    disabled={schedules.length < 2}
                  >
                    <ArrowRightLeft size={16} />
                    <span>Quick Swap Shifts</span>
                  </button>
                </div>
              </div>

              {/* Roster Calendar Grid */}
              <div className="roster-grid-wrap">
                <div className="roster-grid">
                  {/* Header Row */}
                  <div className="roster-header-cell staff-col">Staff Member</div>
                  {weekDays.map(day => (
                    <div
                      key={day.toISOString()}
                      className={`roster-header-cell ${isSameDay(day, new Date()) ? 'today-col' : ''}`}
                    >
                      <span className="day-name">{format(day, 'EEE')}</span>
                      <span className="day-num">{format(day, 'MMM d')}</span>
                    </div>
                  ))}

                  {/* Employee Rows */}
                  {employees.filter(e => e.status === 'active').length === 0 ? (
                    <div className="roster-empty-row" style={{ gridColumn: 'span 8' }}>
                      <p>No active employees found. Please register staff in Staff Directory to assign shifts.</p>
                    </div>
                  ) : (
                    employees.filter(e => e.status === 'active').map(emp => (
                      <React.Fragment key={emp.id}>
                        {/* Employee Column */}
                        <div className="roster-staff-cell">
                          <div className="roster-avatar">
                            {emp.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="roster-emp-name">{emp.name}</div>
                            <div className="roster-emp-role">{emp.role}</div>
                          </div>
                        </div>

                        {/* 7 Day Slots */}
                        {weekDays.map(day => {
                          const dateKey = format(day, 'yyyy-MM-dd');
                          const sched = schedules.find(
                            s => s.employee_id === emp.id && s.date === dateKey
                          );
                          const isToday = isSameDay(day, new Date());

                          return (
                            <div
                              key={dateKey}
                              className={`roster-slot-cell ${isToday ? 'today-slot' : ''}`}
                              onClick={() => handleOpenAssignModal(emp.id, dateKey)}
                            >
                              {sched?.shift_template ? (
                                <div
                                  className="shift-chip"
                                  style={{
                                    backgroundColor: `${sched.shift_template.color}15`,
                                  }}
                                >
                                  <div className="shift-chip-name">{sched.shift_template.name}</div>
                                  <div className="shift-chip-time">
                                    {sched.shift_template.start_time} - {sched.shift_template.end_time}
                                  </div>
                                  {sched.notes && (
                                    <div className="shift-chip-notes">{sched.notes}</div>
                                  )}
                                </div>
                              ) : (
                                <div className="empty-slot-btn">
                                  <Plus size={14} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════ */}
          {/* MODAL 1: ADD / EDIT EMPLOYEE                                 */}
          {/* ════════════════════════════════════════════════════════════ */}
          <AnimatePresence>
            {showAddEmpModal && (
              <div className="emp-modal-backdrop" onClick={() => setShowAddEmpModal(false)}>
                <motion.div
                  className="emp-modal-dialog"
                  onClick={e => e.stopPropagation()}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <div className="emp-modal-header">
                    <h3>{editingEmp ? 'Edit Barista Profile' : 'Register New Barista'}</h3>
                    <button className="emp-modal-close" onClick={() => setShowAddEmpModal(false)}>
                      <X size={18} />
                    </button>
                  </div>

                  <form onSubmit={handleSaveEmployee} className="emp-modal-body">
                    <div className="form-grid">
                      <div className="form-group">
                        <label className="form-label">Employee Code</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="Auto-generated (e.g. EMP-001)"
                          value={empForm.employee_code}
                          onChange={e => setEmpForm({ ...empForm, employee_code: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Full Name *</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="e.g. Sarah Jenkins"
                          value={empForm.name}
                          onChange={e => setEmpForm({ ...empForm, name: e.target.value })}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Email Address</label>
                        <input
                          type="email"
                          className="input"
                          placeholder="sarah@espro.ph"
                          value={empForm.email}
                          onChange={e => setEmpForm({ ...empForm, email: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Phone Number</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="+63 912 345 6789"
                          value={empForm.phone}
                          onChange={e => setEmpForm({ ...empForm, phone: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Role</label>
                        <select
                          className="input"
                          value={empForm.role}
                          onChange={e => setEmpForm({ ...empForm, role: e.target.value as EmployeeRole })}
                        >
                          {ROLE_OPTIONS.map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Employment Type</label>
                        <select
                          className="input"
                          value={empForm.employment_type}
                          onChange={e => setEmpForm({ ...empForm, employment_type: e.target.value as EmploymentType })}
                        >
                          <option value="part_time">Part-Time</option>
                          <option value="full_time">Full-Time</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Hourly Rate (₱)</label>
                        <input
                          type="number"
                          step="0.5"
                          className="input"
                          placeholder="85.00"
                          value={empForm.hourly_rate}
                          onChange={e => setEmpForm({ ...empForm, hourly_rate: e.target.value })}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">4-Digit Security PIN *</label>
                        <input
                          type="password"
                          maxLength={4}
                          className="input"
                          placeholder="1234"
                          value={empForm.pin_code}
                          onChange={e => setEmpForm({ ...empForm, pin_code: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                          required
                        />
                        <small className="form-hint">Used for Time Clock kiosk punch</small>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Emergency Contact Name</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="Contact person"
                          value={empForm.emergency_contact_name}
                          onChange={e => setEmpForm({ ...empForm, emergency_contact_name: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Emergency Contact Phone</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="+63 9xx xxx xxxx"
                          value={empForm.emergency_contact_phone}
                          onChange={e => setEmpForm({ ...empForm, emergency_contact_phone: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Hire Date</label>
                        <input
                          type="date"
                          className="input"
                          value={empForm.hire_date}
                          onChange={e => setEmpForm({ ...empForm, hire_date: e.target.value })}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Account Status</label>
                        <select
                          className="input"
                          value={empForm.status}
                          onChange={e => setEmpForm({ ...empForm, status: e.target.value as EmployeeStatus })}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="on_leave">On Leave</option>
                        </select>
                      </div>
                    </div>

                    {/* ════════════════════════════════════════════════════════════ */}
                    {/* ESPRO SYSTEM LOGIN ACCESS TOGGLE & CREDENTIALS               */}
                    {/* ════════════════════════════════════════════════════════════ */}
                    <div className={`system-access-card ${grantSystemAccess ? 'active' : ''}`}>
                      <div className="system-access-header">
                        <div className="system-access-header-left">
                          <div className="system-access-icon">
                            <Shield size={20} />
                          </div>
                          <div>
                            <div className="system-access-title">Grant ESPRO System Login Access</div>
                            <div className="system-access-sub">
                              Enables this employee to log into ESPRO on the counter POS or their device. Their 4-digit PIN will also be used for quick clock-in/out at the counter.
                            </div>
                          </div>
                        </div>

                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={grantSystemAccess}
                            onChange={e => {
                              const checked = e.target.checked;
                              setGrantSystemAccess(checked);
                              if (checked && !systemUsername) {
                                const suggested = empForm.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                                if (suggested) setSystemUsername(suggested);
                              }
                            }}
                          />
                          <span className="toggle-slider" />
                        </label>
                      </div>

                      <AnimatePresence>
                        {grantSystemAccess && (
                          <motion.div
                            className="system-access-fields"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <div className="form-grid">
                              <div className="form-group">
                                <label className="form-label">System Login Username / Email *</label>
                                <div className="input-group-domain">
                                  <input
                                    type="text"
                                    className="input domain-input-left"
                                    placeholder="e.g. sarah"
                                    value={systemUsername}
                                    onChange={e => setSystemUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                                    required={grantSystemAccess}
                                  />
                                  <span className="domain-suffix">@espro.ph</span>
                                </div>
                                <small className="form-hint">
                                  Login email: <strong>{systemUsername ? `${systemUsername}@espro.ph` : 'username@espro.ph'}</strong>
                                </small>
                              </div>

                              <div className="form-group">
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <label className="form-label">
                                    {editingEmp && editingEmp.has_system_access ? 'Change Password (Optional)' : 'System Password *'}
                                  </label>
                                  <button
                                    type="button"
                                    className="btn-link-action"
                                    onClick={() => {
                                      const gen = `Espro!${Math.floor(1000 + Math.random() * 9000)}`;
                                      setSystemPassword(gen);
                                      setShowSystemPassword(true);
                                      toast.success(`Generated: ${gen}`);
                                    }}
                                  >
                                    <Sparkles size={12} /> Auto-Generate
                                  </button>
                                </div>

                                <div className="password-input-wrap">
                                  <input
                                    type={showSystemPassword ? 'text' : 'password'}
                                    className="input"
                                    placeholder={editingEmp && editingEmp.has_system_access ? 'Leave blank to keep unchanged' : 'Min 6 characters'}
                                    value={systemPassword}
                                    onChange={e => setSystemPassword(e.target.value)}
                                    required={grantSystemAccess && (!editingEmp || !editingEmp.has_system_access)}
                                  />
                                  <button
                                    type="button"
                                    className="pwd-toggle-btn"
                                    onClick={() => setShowSystemPassword(prev => !prev)}
                                    title={showSystemPassword ? 'Hide password' : 'Show password'}
                                  >
                                    {showSystemPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                  </button>
                                </div>
                              </div>

                              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                <label className="form-label">System Access Permission Level</label>
                                <select
                                  className="input"
                                  value={systemRole}
                                  onChange={e => setSystemRole(e.target.value as 'admin' | 'employee')}
                                >
                                  <option value="employee">Employee (Barista / Cashier / POS User)</option>
                                  <option value="admin">Administrator (Full System & Reports Access)</option>
                                </select>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="emp-modal-footer">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setShowAddEmpModal(false)}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary">
                        <Save size={16} />
                        <span>{editingEmp ? 'Save Changes' : 'Register Employee'}</span>
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* MODAL 2: CHANGE 4-DIGIT PIN                                  */}
          {/* ════════════════════════════════════════════════════════════ */}
          <AnimatePresence>
            {pinChangeEmp && (
              <div className="emp-modal-backdrop" onClick={() => setPinChangeEmp(null)}>
                <motion.div
                  className="emp-modal-dialog small"
                  onClick={e => e.stopPropagation()}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <div className="emp-modal-header">
                    <h3>Change Kiosk PIN: {pinChangeEmp.name}</h3>
                    <button className="emp-modal-close" onClick={() => setPinChangeEmp(null)}>
                      <X size={18} />
                    </button>
                  </div>

                  <form onSubmit={handleChangePin} className="emp-modal-body">
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
                      Set a new 4-digit numeric PIN for {pinChangeEmp.name} ({pinChangeEmp.employee_code}).
                    </p>

                    <div className="form-group">
                      <label className="form-label">New 4-Digit Security PIN</label>
                      <input
                        type="password"
                        maxLength={4}
                        className="input"
                        placeholder="••••"
                        value={newPinValue}
                        onChange={e => setNewPinValue(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        required
                        autoFocus
                      />
                    </div>

                    <div className="emp-modal-footer">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setPinChangeEmp(null)}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary">
                        Update PIN
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* MODAL 3: MANUAL ATTENDANCE ADJUSTMENT (Audit log)            */}
          {/* ════════════════════════════════════════════════════════════ */}
          <AnimatePresence>
            {adjustingRecord && (
              <div className="emp-modal-backdrop" onClick={() => setAdjustingRecord(null)}>
                <motion.div
                  className="emp-modal-dialog"
                  onClick={e => e.stopPropagation()}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <div className="emp-modal-header">
                    <h3>Manual Timesheet Punch Adjustment</h3>
                    <button className="emp-modal-close" onClick={() => setAdjustingRecord(null)}>
                      <X size={18} />
                    </button>
                  </div>

                  <form onSubmit={handleSaveAdjustment} className="emp-modal-body">
                    <div className="adj-emp-summary">
                      <strong>Staff:</strong> {adjustingRecord.employee?.name} ({adjustingRecord.employee?.employee_code}) | <strong>Date:</strong> {adjustingRecord.date}
                    </div>

                    <div className="form-grid">
                      <div className="form-group">
                        <label className="form-label">Clock In Timestamp</label>
                        <input
                          type="datetime-local"
                          className="input"
                          value={adjClockIn}
                          onChange={e => setAdjClockIn(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Clock Out Timestamp</label>
                        <input
                          type="datetime-local"
                          className="input"
                          value={adjClockOut}
                          onChange={e => setAdjClockOut(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Break Start</label>
                        <input
                          type="datetime-local"
                          className="input"
                          value={adjBreakStart}
                          onChange={e => setAdjBreakStart(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Break End</label>
                        <input
                          type="datetime-local"
                          className="input"
                          value={adjBreakEnd}
                          onChange={e => setAdjBreakEnd(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-group" style={{ marginTop: 14 }}>
                      <label className="form-label">Mandatory Audit Reason *</label>
                      <textarea
                        className="input"
                        rows={3}
                        placeholder="e.g. Barista forgot to punch out due to closing rush; verified with register logs."
                        value={adjustmentReason}
                        onChange={e => setAdjustmentReason(e.target.value)}
                        required
                      />
                    </div>

                    {adjustingRecord.adjustment_note && (
                      <div className="adj-previous-notes">
                        <label className="form-label">Previous Audit Remarks:</label>
                        <pre>{adjustingRecord.adjustment_note}</pre>
                      </div>
                    )}

                    <div className="emp-modal-footer">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setAdjustingRecord(null)}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary">
                        Save Adjusted Record
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* MODAL 4: ASSIGN SHIFT SLOT                                   */}
          {/* ════════════════════════════════════════════════════════════ */}
          <AnimatePresence>
            {assigningSlot && (
              <div className="emp-modal-backdrop" onClick={() => setAssigningSlot(null)}>
                <motion.div
                  className="emp-modal-dialog small"
                  onClick={e => e.stopPropagation()}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <div className="emp-modal-header">
                    <h3>Assign Shift</h3>
                    <button className="emp-modal-close" onClick={() => setAssigningSlot(null)}>
                      <X size={18} />
                    </button>
                  </div>

                  <div className="emp-modal-body">
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
                      Date: <strong>{assigningSlot.date}</strong>
                    </p>

                    <div className="form-group">
                      <label className="form-label">Select Shift Template</label>
                      <select
                        className="input"
                        value={selectedTemplateId}
                        onChange={e => setSelectedTemplateId(e.target.value)}
                      >
                        <option value="">— Unassign / Off Duty —</option>
                        {shiftTemplates.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.start_time} - {t.end_time})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ marginTop: 12 }}>
                      <label className="form-label">Shift Notes (Optional)</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="e.g. Lead Barista, Cash Float"
                        value={slotNotes}
                        onChange={e => setSlotNotes(e.target.value)}
                      />
                    </div>

                    <div className="emp-modal-footer">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setAssigningSlot(null)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleSaveShiftAssignment}
                      >
                        Save Shift
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* MODAL 5: QUICK SWAP SHIFTS                                   */}
          {/* ════════════════════════════════════════════════════════════ */}
          <AnimatePresence>
            {showSwapModal && (
              <div className="emp-modal-backdrop" onClick={() => setShowSwapModal(false)}>
                <motion.div
                  className="emp-modal-dialog"
                  onClick={e => e.stopPropagation()}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <div className="emp-modal-header">
                    <h3>Quick Shift Swap Tool</h3>
                    <button className="emp-modal-close" onClick={() => setShowSwapModal(false)}>
                      <X size={18} />
                    </button>
                  </div>

                  <form onSubmit={handleSwapShiftsSubmit} className="emp-modal-body">
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
                      Select two scheduled shifts to seamlessly swap their templates and assignments.
                    </p>

                    <div className="form-grid">
                      <div className="form-group">
                        <label className="form-label">Schedule A</label>
                        <select
                          className="input"
                          value={swapSchedA}
                          onChange={e => setSwapSchedA(e.target.value)}
                          required
                        >
                          <option value="">Select Schedule A...</option>
                          {schedules
                            .filter(s => s.shift_template)
                            .map(s => (
                              <option key={s.id} value={s.id}>
                                {s.date} - {s.employee?.name} ({s.shift_template?.name})
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Schedule B</label>
                        <select
                          className="input"
                          value={swapSchedB}
                          onChange={e => setSwapSchedB(e.target.value)}
                          required
                        >
                          <option value="">Select Schedule B...</option>
                          {schedules
                            .filter(s => s.shift_template && s.id !== swapSchedA)
                            .map(s => (
                              <option key={s.id} value={s.id}>
                                {s.date} - {s.employee?.name} ({s.shift_template?.name})
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    <div className="emp-modal-footer">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setShowSwapModal(false)}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary">
                        <ArrowRightLeft size={16} />
                        <span>Confirm Swap</span>
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* MODAL 6: SHIFT TEMPLATES MANAGER                             */}
          {/* ════════════════════════════════════════════════════════════ */}
          <AnimatePresence>
            {showTemplateModal && (
              <div className="emp-modal-backdrop" onClick={() => setShowTemplateModal(false)}>
                <motion.div
                  className="emp-modal-dialog"
                  onClick={e => e.stopPropagation()}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <div className="emp-modal-header">
                    <h3>Configure Café Shift Templates</h3>
                    <button className="emp-modal-close" onClick={() => setShowTemplateModal(false)}>
                      <X size={18} />
                    </button>
                  </div>

                  <div className="emp-modal-body">
                    {/* Existing Templates */}
                    <h4 style={{ marginBottom: 10, fontSize: '0.95rem' }}>Active Shift Templates</h4>
                    {shiftTemplates.length === 0 ? (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        No shift templates defined yet.
                      </p>
                    ) : (
                      <div className="template-cards-list">
                        {shiftTemplates.map(tpl => (
                          <div
                            key={tpl.id}
                            className="template-card-row"
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: '50%',
                                  backgroundColor: tpl.color,
                                  flexShrink: 0,
                                }}
                              />
                              <div>
                                <strong>{tpl.name}</strong>
                                <div className="template-meta">
                                  {tpl.start_time} - {tpl.end_time} • {tpl.break_minutes}m break
                                </div>
                              </div>
                            </div>
                            <button
                              className="action-btn danger"
                              onClick={() => handleDeleteTemplate(tpl.id)}
                              title="Delete Template"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* New Template Form */}
                    <hr style={{ margin: '20px 0', borderColor: 'var(--border)' }} />
                    <h4 style={{ marginBottom: 12, fontSize: '0.95rem' }}>+ Create Shift Template</h4>

                    <form onSubmit={handleCreateShiftTemplate}>
                      <div className="form-grid">
                        <div className="form-group">
                          <label className="form-label">Template Name</label>
                          <input
                            type="text"
                            className="input"
                            placeholder="e.g. Morning Rush"
                            value={newTemplateForm.name}
                            onChange={e => setNewTemplateForm({ ...newTemplateForm, name: e.target.value })}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Start Time</label>
                          <input
                            type="time"
                            className="input"
                            value={newTemplateForm.start_time}
                            onChange={e => setNewTemplateForm({ ...newTemplateForm, start_time: e.target.value })}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">End Time</label>
                          <input
                            type="time"
                            className="input"
                            value={newTemplateForm.end_time}
                            onChange={e => setNewTemplateForm({ ...newTemplateForm, end_time: e.target.value })}
                            required
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Break (Minutes)</label>
                          <input
                            type="number"
                            className="input"
                            value={newTemplateForm.break_minutes}
                            onChange={e => setNewTemplateForm({ ...newTemplateForm, break_minutes: Number(e.target.value) })}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Color Accent</label>
                          <input
                            type="color"
                            className="input"
                            style={{ height: 42, padding: 4 }}
                            value={newTemplateForm.color}
                            onChange={e => setNewTemplateForm({ ...newTemplateForm, color: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="emp-modal-footer">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => setShowTemplateModal(false)}
                        >
                          Close
                        </button>
                        <button type="submit" className="btn btn-primary">
                          <Plus size={16} />
                          <span>Add Template</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
