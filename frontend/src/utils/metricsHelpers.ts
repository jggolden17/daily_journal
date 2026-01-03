import { journalApi } from '../api/journal';

/**
 * Finds dates with threads that have incomplete metrics in a date range
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @returns Array of date strings (YYYY-MM-DD) sorted by date (most recent first)
 */
export async function getDatesWithIncompleteMetrics(
  startDate: string,
  endDate: string
): Promise<string[]> {
  const calendarEntries = await journalApi.getCalendarRange(startDate, endDate);
  
  const incompleteDates = calendarEntries
    .filter((entry) => !entry.hasCompleteMetrics)
    .map((entry) => entry.date);
  
  // Sort by date (most recent first)
  incompleteDates.sort((a, b) => {
    const dateA = new Date(a);
    const dateB = new Date(b);
    return dateB.getTime() - dateA.getTime();
  });
  
  return incompleteDates;
}

