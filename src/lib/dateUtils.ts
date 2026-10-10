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
