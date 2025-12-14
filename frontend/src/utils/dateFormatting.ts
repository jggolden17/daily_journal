/**
 * Parses a date string (YYYY-MM-DD) as a local date to avoid timezone issues
 */
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Formats a date string or Date object to the format "Saturday, Jan 1st 2025"
 * @param date - Date string (YYYY-MM-DD) or Date object
 * @returns Formatted date string
 */
export function formatDisplayDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseLocalDate(date) : date;
  
  if (Number.isNaN(dateObj.getTime())) {
    return formatDisplayDate(new Date());
  }

  const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const month = dateObj.toLocaleDateString('en-US', { month: 'short' });
  const day = dateObj.getDate();
  const year = dateObj.getFullYear();

  const ordinalSuffix = getOrdinalSuffix(day);

  return `${dayOfWeek}, ${month} ${day}${ordinalSuffix} ${year}`;
}

/**
 * Gets the ordinal suffix for a day number (1st, 2nd, 3rd, 4th, etc.)
 * @param day - Day of the month (1-31)
 * @returns Ordinal suffix string (st, nd, rd, or th)
 */
function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return 'th';
  
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

/**
 * Formats a Date object to YYYY-MM-DD string (local date, not UTC)
 */
function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates the previous day from a given date
 * @param date - Date string (YYYY-MM-DD) or Date object
 * @returns Previous day as YYYY-MM-DD string
 */
export function getPreviousDay(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseLocalDate(date) : date;
  const previous = new Date(dateObj);
  previous.setDate(previous.getDate() - 1);
  return formatDateString(previous);
}

/**
 * Calculates the next day from a given date
 * @param date - Date string (YYYY-MM-DD) or Date object
 * @returns Next day as YYYY-MM-DD string
 */
export function getNextDay(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseLocalDate(date) : date;
  const next = new Date(dateObj);
  next.setDate(next.getDate() + 1);
  return formatDateString(next);
}
