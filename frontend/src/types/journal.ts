export interface JournalEntry {
  id: string;
  date: string; // ISO date string (YYYY-MM-DD)
  content: string;
  writtenAt: string; // ISO datetime string
  createdAt: string; // ISO datetime string
  updatedAt: string; // ISO datetime string
}

export interface CalendarEntry {
  date: string; // ISO date string (YYYY-MM-DD)
  hasEntry: boolean;
  hasMetrics?: boolean;
  hasSleepMetrics?: boolean;
  hasCompleteMetrics?: boolean;
}

