import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Clock, X, ArrowLeft, CheckCircle2, AlertCircle, Coffee,
  LogOut, Play, Pause, User, ChevronRight, Sparkles, Delete
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  fetchEmployees,
  getTodayAttendanceLogs,
  fetchSchedules,
  clockIn,
  startBreak,
  endBreak,
  clockOut,
  type Employee,
  type AttendanceRecord,
  type ShiftSchedule,
} from '../../lib/employeeDb';
import './TimeClockModal.css';

interface TimeClockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (msg: string) => void;
}

export default function TimeClockModal({ isOpen, onClose, onSuccess }: TimeClockModalProps) {
  // Live current time clock
  const [currentTime, setCurrentTime] = useState(new Date());

  // Data states
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceRecord[]>([]);
  const [todaySchedules, setTodaySchedules] = useState<ShiftSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Kiosk interaction flow: 'select-employee' | 'enter-pin' | 'success'
  const [step, setStep] = useState<'select-employee' | 'enter-pin' | 'success'>('select-employee');
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [search, setSearch] = useState('');

  // Auto-dismiss timer ref
  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep live time ticking every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Refresh data whenever modal opens
  useEffect(() => {
    if (!isOpen) {
      // Reset state on close
      setStep('select-employee');
      setSelectedEmp(null);
      setPin('');
      setPinError(false);
      setSuccessMessage('');
      setSearch('');
      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
      return;
    }

    loadKioskData();
  }, [isOpen]);

  async function loadKioskData() {
    setLoading(true);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const [allEmps, logs, scheds] = await Promise.all([
        fetchEmployees(),
        getTodayAttendanceLogs(),
        fetchSchedules(today, today),
      ]);
      setEmployees(allEmps.filter(e => e.status === 'active'));
      setAttendanceLogs(logs);
      setTodaySchedules(scheds);
    } catch (err) {
      console.error('Failed to load kiosk data', err);
    } finally {
      setLoading(false);
    }
  }

  // Find latest attendance record for an employee today
  const getEmpStatus = useCallback((empId: string) => {
    const logs = attendanceLogs.filter(a => a.employee_id === empId);
    if (logs.length === 0) return { status: 'not_clocked_in' as const, record: null };
    
    // Sort latest by clock_in
    const latest = logs[0];
    if (latest.clock_out) {
      return { status: 'clocked_out' as const, record: latest };
    }
    if (latest.break_start && !latest.break_end) {
      return { status: 'on_break' as const, record: latest };
    }
    if (latest.clock_in) {
      return { status: 'on_duty' as const, record: latest };
    }
    return { status: 'not_clocked_in' as const, record: null };
  }, [attendanceLogs]);

  const selectedEmpStatus = useMemo(() => {
    if (!selectedEmp) return null;
    return getEmpStatus(selectedEmp.id);
  }, [selectedEmp, getEmpStatus]);

  const selectedEmpSchedule = useMemo(() => {
    if (!selectedEmp) return null;
    return todaySchedules.find(s => s.employee_id === selectedEmp.id);
  }, [selectedEmp, todaySchedules]);

  // Handle staff selection
  function handleSelectStaff(emp: Employee) {
    setSelectedEmp(emp);
    setPin('');
    setPinError(false);
    setStep('enter-pin');
  }

  // Handle PIN button press
  const handlePinPress = useCallback((digit: string) => {
    setPin(prev => {
      if (prev.length < 4) {
        setPinError(false);
        return prev + digit;
      }
      return prev;
    });
  }, []);

  function handleClearPin() {
    setPin('');
    setPinError(false);
  }

  const handleBackspace = useCallback(() => {
    setPin(prev => prev.slice(0, -1));
    setPinError(false);
  }, []);

  // Listen for physical keyboard numpad input
  useEffect(() => {
    if (!isOpen || step !== 'enter-pin') return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key >= '0' && e.key <= '9') {
        handlePinPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        setStep('select-employee');
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, step, handlePinPress, handleBackspace]);

  // Execute punch action (Clock In, Start Break, End Break, Clock Out)
  async function handlePunch(action: 'clock_in' | 'start_break' | 'end_break' | 'clock_out') {
    if (!selectedEmp) return;
    if (pin.length !== 4) {
      toast.error('Please enter your 4-digit PIN');
      setPinError(true);
      return;
    }

    setSubmitting(true);
    try {
      let res: { success: boolean; message: string; record?: AttendanceRecord };

      if (action === 'clock_in') {
        res = await clockIn(selectedEmp.id, pin);
      } else if (action === 'start_break') {
        const recordId = selectedEmpStatus?.record?.id;
        if (!recordId) throw new Error('No active attendance record found');
        res = await startBreak(recordId, pin);
      } else if (action === 'end_break') {
        const recordId = selectedEmpStatus?.record?.id;
        if (!recordId) throw new Error('No active attendance record found');
        res = await endBreak(recordId, pin);
      } else {
        const recordId = selectedEmpStatus?.record?.id;
        if (!recordId) throw new Error('No active attendance record found');
        res = await clockOut(recordId, pin);
      }

      if (!res.success) {
        setPinError(true);
        setPin('');
        toast.error(res.message);
        return;
      }

      // Success! Show 2-second toast & success screen, then auto-close
      setSuccessMessage(res.message);
      setStep('success');
      toast.success(res.message, { duration: 3000 });
      window.dispatchEvent(new CustomEvent('espro-attendance-updated', { detail: { action, employee: selectedEmp } }));
      if (onSuccess) onSuccess(res.message);

      // Auto dismiss after 2 seconds
      autoCloseTimer.current = setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      toast.error(err.message || 'Operation failed. Please try again.');
      setPinError(true);
      setPin('');
    } finally {
      setSubmitting(false);
    }
  }

  // Filter staff list
  const filteredEmployees = useMemo(() => {
    return employees.filter(e =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.employee_code.toLowerCase().includes(search.toLowerCase()) ||
      e.role.toLowerCase().includes(search.toLowerCase())
    );
  }, [employees, search]);

  if (!isOpen) return null;

  return (
    <div className="kiosk-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <motion.div
        className="kiosk-modal-container"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        {/* Top Header Banner with Live Digital Clock */}
        <div className="kiosk-header">
          <div className="kiosk-brand">
            <div className="kiosk-logo-badge">
              <Clock size={20} className="kiosk-clock-icon" />
            </div>
            <div>
              <div className="kiosk-title">Espro Time Clock</div>
              <div className="kiosk-subtitle">Counter Staff Attendance Kiosk</div>
            </div>
          </div>

          <div className="kiosk-clock-display">
            <div className="kiosk-live-time">
              {format(currentTime, 'hh:mm:ss a')}
            </div>
            <div className="kiosk-live-date">
              {format(currentTime, 'EEEE, MMMM d, yyyy')}
            </div>
          </div>

          <button className="kiosk-close-btn" onClick={onClose} title="Close Kiosk (Esc)">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="kiosk-body">
          {loading ? (
            <div className="kiosk-loading-box">
              <div className="kiosk-spinner" />
              <p>Loading active staff & shift data...</p>
            </div>
          ) : step === 'select-employee' ? (
            /* STEP 1: EMPLOYEE SELECTION */
            <div className="kiosk-selection-view">
              <div className="kiosk-view-header">
                <div>
                  <h2 className="kiosk-view-title">Select Your Name</h2>
                  <p className="kiosk-view-desc">Tap your name to clock in, record breaks, or clock out.</p>
                </div>
                {employees.length > 5 && (
                  <div className="kiosk-search-wrap">
                    <input
                      type="text"
                      className="kiosk-search-input"
                      placeholder="Search barista..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {filteredEmployees.length === 0 ? (
                <div className="kiosk-empty-staff">
                  <User size={44} className="kiosk-empty-icon" />
                  <h3>No Staff Found</h3>
                  <p>
                    {employees.length === 0
                      ? 'No active employees registered yet. Please add staff in Employee Management.'
                      : 'No staff match your search query.'}
                  </p>
                </div>
              ) : (
                <div className="kiosk-staff-grid">
                  {filteredEmployees.map(emp => {
                    const statusInfo = getEmpStatus(emp.id);
                    const isDuty = statusInfo.status === 'on_duty';
                    const isBreak = statusInfo.status === 'on_break';
                    const isOut = statusInfo.status === 'clocked_out';

                    return (
                      <motion.div
                        key={emp.id}
                        className={`kiosk-staff-card ${isDuty ? 'status-duty' : isBreak ? 'status-break' : ''}`}
                        onClick={() => handleSelectStaff(emp)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="kiosk-staff-avatar">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="kiosk-staff-info">
                          <div className="kiosk-staff-name">{emp.name}</div>
                          <div className="kiosk-staff-meta">
                            <span className="kiosk-staff-code">{emp.employee_code}</span>
                            <span className="kiosk-staff-role">{emp.role}</span>
                          </div>
                        </div>

                        <div className="kiosk-staff-status-pill">
                          {isDuty && (
                            <span className="kiosk-badge badge-duty">
                              <span className="pulse-dot green" /> On Duty
                            </span>
                          )}
                          {isBreak && (
                            <span className="kiosk-badge badge-break">
                              <span className="pulse-dot orange" /> On Break
                            </span>
                          )}
                          {isOut && (
                            <span className="kiosk-badge badge-out">
                              Clocked Out
                            </span>
                          )}
                          {statusInfo.status === 'not_clocked_in' && (
                            <span className="kiosk-badge badge-neutral">
                              Not In
                            </span>
                          )}
                          <ChevronRight size={16} className="kiosk-staff-arrow" />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : step === 'enter-pin' && selectedEmp ? (
            /* STEP 2: PIN ENTRY & LIVE ACTION */
            <div className="kiosk-pin-view">
              {/* Back to selection header */}
              <div className="kiosk-pin-header">
                <button
                  className="kiosk-back-btn"
                  onClick={() => setStep('select-employee')}
                  title="Switch Staff"
                >
                  <ArrowLeft size={16} /> Switch Staff
                </button>

                <div className="kiosk-selected-profile">
                  <div className="kiosk-selected-avatar">
                    {selectedEmp.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="kiosk-selected-name">{selectedEmp.name}</div>
                    <div className="kiosk-selected-sub">
                      {selectedEmp.role} • {selectedEmp.employee_code}
                    </div>
                  </div>
                </div>

                <div className="kiosk-shift-info-pill">
                  {selectedEmpSchedule?.shift_template ? (
                    <span>
                      📅 Shift: <strong>{selectedEmpSchedule.shift_template.name}</strong> ({selectedEmpSchedule.shift_template.start_time} - {selectedEmpSchedule.shift_template.end_time})
                    </span>
                  ) : (
                    <span>No Shift Scheduled Today</span>
                  )}
                </div>
              </div>

              {/* Live Status Alert Banner */}
              <div className="kiosk-status-banner">
                {selectedEmpStatus?.status === 'on_duty' && (
                  <div className="kiosk-banner-box duty">
                    <CheckCircle2 size={18} />
                    <span>
                      Currently <strong>On Duty</strong> (Clocked in at {format(new Date(selectedEmpStatus.record!.clock_in!), 'hh:mm a')})
                    </span>
                  </div>
                )}
                {selectedEmpStatus?.status === 'on_break' && (
                  <div className="kiosk-banner-box break">
                    <Pause size={18} />
                    <span>
                      Currently <strong>On Break</strong> (Started at {format(new Date(selectedEmpStatus.record!.break_start!), 'hh:mm a')})
                    </span>
                  </div>
                )}
                {selectedEmpStatus?.status === 'clocked_out' && (
                  <div className="kiosk-banner-box out">
                    <Clock size={18} />
                    <span>
                      Already Clocked Out today at {format(new Date(selectedEmpStatus.record!.clock_out!), 'hh:mm a')} ({selectedEmpStatus.record!.total_hours} hrs worked)
                    </span>
                  </div>
                )}
                {selectedEmpStatus?.status === 'not_clocked_in' && (
                  <div className="kiosk-banner-box ready">
                    <Sparkles size={18} />
                    <span>Ready to start work. Enter your 4-digit PIN below to Clock In.</span>
                  </div>
                )}
              </div>

              {/* PIN Pad and Actions Grid */}
              <div className="kiosk-pin-grid">
                {/* PIN Display & Keypad */}
                <div className="kiosk-numpad-container">
                  <div className="kiosk-pin-prompt">Enter 4-Digit Security PIN</div>

                  {/* Masked Dots with Shake Animation on Error */}
                  <motion.div
                    className={`kiosk-pin-dots ${pinError ? 'pin-shake' : ''}`}
                    animate={pinError ? { x: [-10, 10, -8, 8, -4, 4, 0] } : {}}
                    transition={{ duration: 0.4 }}
                  >
                    {[0, 1, 2, 3].map(i => (
                      <div
                        key={i}
                        className={`pin-dot ${i < pin.length ? 'filled' : ''} ${pinError ? 'error' : ''}`}
                      />
                    ))}
                  </motion.div>

                  {pinError && (
                    <div className="pin-error-text">
                      <AlertCircle size={14} /> Incorrect PIN. Please try again.
                    </div>
                  )}

                  {/* 10-Key Touchpad */}
                  <div className="kiosk-touchpad">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                      <button
                        key={num}
                        type="button"
                        className="numpad-btn"
                        onClick={() => handlePinPress(num)}
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="numpad-btn util-btn"
                      onClick={handleClearPin}
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      className="numpad-btn"
                      onClick={() => handlePinPress('0')}
                    >
                      0
                    </button>
                    <button
                      type="button"
                      className="numpad-btn util-btn"
                      onClick={handleBackspace}
                      title="Backspace"
                    >
                      <Delete size={20} />
                    </button>
                  </div>
                </div>

                {/* Live Action Column */}
                <div className="kiosk-actions-column">
                  <div className="kiosk-actions-title">Attendance Actions</div>
                  <div className="kiosk-actions-subtitle">
                    Enter your PIN on the keypad, then tap your action:
                  </div>

                  <div className="kiosk-action-buttons">
                    {/* 1. CLOCK IN (shown when not clocked in or already clocked out) */}
                    {(selectedEmpStatus?.status === 'not_clocked_in' || selectedEmpStatus?.status === 'clocked_out') && (
                      <button
                        type="button"
                        className="kiosk-act-btn btn-clock-in"
                        disabled={submitting || pin.length !== 4}
                        onClick={() => handlePunch('clock_in')}
                      >
                        <Play size={22} className="act-icon" />
                        <div className="act-text-wrap">
                          <span className="act-title">
                            {selectedEmpStatus?.status === 'clocked_out' ? 'Clock In Again' : 'Clock In'}
                          </span>
                          <span className="act-sub">
                            Live timestamp: {format(currentTime, 'hh:mm a')}
                          </span>
                        </div>
                      </button>
                    )}

                    {/* 2. ON DUTY ACTIONS: Start Break OR Clock Out */}
                    {selectedEmpStatus?.status === 'on_duty' && (
                      <>
                        <button
                          type="button"
                          className="kiosk-act-btn btn-break"
                          disabled={submitting || pin.length !== 4}
                          onClick={() => handlePunch('start_break')}
                        >
                          <Coffee size={22} className="act-icon" />
                          <div className="act-text-wrap">
                            <span className="act-title">Start Break</span>
                            <span className="act-sub">Pause working shift</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          className="kiosk-act-btn btn-clock-out"
                          disabled={submitting || pin.length !== 4}
                          onClick={() => handlePunch('clock_out')}
                        >
                          <LogOut size={22} className="act-icon" />
                          <div className="act-text-wrap">
                            <span className="act-title">Clock Out</span>
                            <span className="act-sub">End working shift for today</span>
                          </div>
                        </button>
                      </>
                    )}

                    {/* 3. ON BREAK ACTIONS: End Break OR Clock Out */}
                    {selectedEmpStatus?.status === 'on_break' && (
                      <>
                        <button
                          type="button"
                          className="kiosk-act-btn btn-end-break"
                          disabled={submitting || pin.length !== 4}
                          onClick={() => handlePunch('end_break')}
                        >
                          <Play size={22} className="act-icon" />
                          <div className="act-text-wrap">
                            <span className="act-title">End Break</span>
                            <span className="act-sub">Resume on-duty shift</span>
                          </div>
                        </button>

                        <button
                          type="button"
                          className="kiosk-act-btn btn-clock-out"
                          disabled={submitting || pin.length !== 4}
                          onClick={() => handlePunch('clock_out')}
                        >
                          <LogOut size={22} className="act-icon" />
                          <div className="act-text-wrap">
                            <span className="act-title">Clock Out</span>
                            <span className="act-sub">End shift directly</span>
                          </div>
                        </button>
                      </>
                    )}
                  </div>

                  <div className="kiosk-pin-hint">
                    🔒 PIN protects your attendance punches from unauthorized changes.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* STEP 3: SUCCESS ANIMATED DISPLAY */
            <div className="kiosk-success-view">
              <motion.div
                className="kiosk-success-card"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 15 }}
              >
                <div className="kiosk-success-check">
                  <CheckCircle2 size={68} />
                </div>
                <h2 className="kiosk-success-title">Punch Recorded!</h2>
                <p className="kiosk-success-msg">{successMessage}</p>
                <div className="kiosk-auto-close-bar">
                  <motion.div
                    className="kiosk-progress-fill"
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ duration: 2, ease: 'linear' }}
                  />
                </div>
                <span className="kiosk-dismiss-hint">
                  Auto-closing in 2 seconds...
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: 16 }}
                  onClick={onClose}
                >
                  Return to POS Now
                </button>
              </motion.div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
