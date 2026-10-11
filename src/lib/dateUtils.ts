// ─── Local Date Utilities for Espro POS ───
// Ensures date boundaries align with local timezone (e.g., Asia/Manila, UTC+8)
// and prevents UTC day-shifting bugs.

/**
 * Returns the start of the day in local time for a 'yyyy-MM-dd' string (00:00:00.000).
 */
export function startOfDayLocal(dateStr: string): Date {
  if (!dateStr) return new Date();
  return new Date(`${dateStr}T00:00:00`);
}

/**
 * Returns the end of the day in local time for a 'yyyy-MM-dd' string (23:59:59.999).
 */
export function endOfDayLocal(dateStr: string): Date {
  if (!dateStr) return new Date();
  return new Date(`${dateStr}T23:59:59.999`);
}

/**
 * Converts a date input (string 'yyyy-MM-dd' or Date) to local noon (12:00:00),
 * ensuring date values stored in ISO/UTC never shift calendar days.
 */
export function toLocalNoon(dateInput: string | Date): Date {
  if (typeof dateInput === 'string') {
    const match = dateInput.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) {
      return new Date(`${match[0]}T12:00:00`);
    }
    return new Date(dateInput);
  }
  const y = dateInput.getFullYear();
  const m = String(dateInput.getMonth() + 1).padStart(2, '0');
  const d = String(dateInput.getDate()).padStart(2, '0');
  return new Date(`${y}-${m}-${d}T12:00:00`);
}

/**
 * Formats a Date object to local YYYY-MM-DD string without UTC day shift.
 */
export function formatLocalDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export type DatePresetKey = 'all' | 'today' | 'yesterday' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface DatePresetOption {
  key: DatePresetKey;
  label: string;
}

export const DATE_PRESET_OPTIONS: DatePresetOption[] = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
  { key: 'custom', label: 'Custom' },
];

/**
 * Calculates start and end YYYY-MM-DD date range for a given preset in local timezone.
 */
export function getPresetDateRange(
  preset: DatePresetKey,
  refDate: Date = new Date()
): { dateFrom: string; dateTo: string } {
  const todayStr = formatLocalDate(refDate);

  switch (preset) {
    case 'today':
      return { dateFrom: todayStr, dateTo: todayStr };

    case 'yesterday': {
      const yesterday = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - 1);
      const yesterdayStr = formatLocalDate(yesterday);
      return { dateFrom: yesterdayStr, dateTo: yesterdayStr };
    }

    case 'weekly': {
      // Start of current week (Monday)
      const day = refDate.getDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday
      const diffToMonday = day === 0 ? 6 : day - 1;
      const monday = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - diffToMonday);
      return {
        dateFrom: formatLocalDate(monday),
        dateTo: todayStr,
      };
    }

    case 'monthly': {
      // 1st of current month to today
      const firstOfMonth = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
      return {
        dateFrom: formatLocalDate(firstOfMonth),
        dateTo: todayStr,
      };
    }

    case 'yearly': {
      // Jan 1 of current year to today
      const firstOfYear = new Date(refDate.getFullYear(), 0, 1);
      return {
        dateFrom: formatLocalDate(firstOfYear),
        dateTo: todayStr,
      };
    }

    case 'all':
    case 'custom':
    default:
      return { dateFrom: '', dateTo: '' };
  }
}
