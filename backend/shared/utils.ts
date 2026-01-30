/**
 * Utility functions for backend operations
 * 
 * Note: Timestamp conversion functions are not included here
 * because they require firebase-admin, which should only be
 * imported in Cloud Functions, not in shared modules.
 * Use these functions in your Cloud Functions code directly.
 */

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toISOString().split('T')[0];
}

/**
 * Get week start date (Monday) for a given date
 */
export function getWeekStart(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const day = dateObj.getDay();
  const diff = dateObj.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(dateObj.setDate(diff));
  return formatDate(monday);
}

/**
 * Get week end date (Sunday) for a given date
 */
export function getWeekEnd(date: Date | string): string {
  const weekStart = new Date(getWeekStart(date));
  weekStart.setDate(weekStart.getDate() + 6);
  return formatDate(weekStart);
}
