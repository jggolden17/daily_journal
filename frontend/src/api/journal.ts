import { apiClient } from './client';
import { authApi } from './auth';
import type { JournalEntry, CalendarEntry } from '../types/journal';

// Backend response types
interface SingleItemResponse<T> {
  data: T | null;
}

interface EntryWithDateResponse {
  id: string;
  thread_id: string;
  raw_markdown: string | null;
  date: string; // ISO date string (YYYY-MM-DD)
  written_at: string; // ISO datetime string
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
}

interface EntryResponse {
  id: string;
  thread_id: string;
  raw_markdown: string | null;
  written_at: string; // ISO datetime string
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
}

interface CalendarEntryResponse {
  date: string; // ISO date string (YYYY-MM-DD)
  hasEntry: boolean;
}

// Helper function to get user ID
async function getUserId(): Promise<string> {
  const user = await authApi.getMe();
  if (!user || !user.id) {
    throw new Error('User not authenticated. Please log in.');
  }
  return user.id;
}

// Helper function to map backend entry to frontend entry
function mapEntryToFrontend(entry: EntryWithDateResponse): JournalEntry {
  return {
    id: entry.id,
    date: entry.date,
    content: entry.raw_markdown || '',
    writtenAt: entry.written_at,
    createdAt: entry.created_at,
    updatedAt: entry.updated_at,
  };
}

// Helper function to map backend entry (without date) to frontend entry, preserving date
function mapEntryToFrontendWithDate(
  entry: EntryResponse,
  date: string
): JournalEntry {
  return {
    id: entry.id,
    date: date,
    content: entry.raw_markdown || '',
    writtenAt: entry.written_at,
    createdAt: entry.created_at,
    updatedAt: entry.updated_at,
  };
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export const journalApi = {
  async getToday(): Promise<JournalEntry[]> {
    const today = getTodayDate();
    return this.getByDate(today);
  },

  async getByDate(date: string): Promise<JournalEntry[]> {
    const user_id = await getUserId();
    const response = await apiClient.get<
      SingleItemResponse<EntryWithDateResponse[]>
    >(`/latest/entries/date/${date}?user_id=${user_id}`);
    
    if (!response.data) {
      return [];
    }
    
    return response.data.map(mapEntryToFrontend);
  },

  async createEntry(date: string, content: string): Promise<JournalEntry> {
    const user_id = await getUserId();
    const response = await apiClient.post<
      SingleItemResponse<EntryWithDateResponse>
    >('/latest/entries/with-thread', {
      user_id: user_id,
      date: date,
      raw_markdown: content,
    });
    
    if (!response.data) {
      throw new Error('Failed to create entry: no data returned');
    }
    
    return mapEntryToFrontend(response.data);
  },

  async updateEntry(id: string, content: string, writtenAt?: string): Promise<JournalEntry> {
    // First, get the entry to preserve the date
    const user_id = await getUserId();
    const today = getTodayDate();
    
    // Try to find the entry to get its date
    // We'll search today first, then try a few days around today
    let entry: EntryWithDateResponse | null = null;
    const datesToCheck = [
      today,
      ...Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i - 3);
        return d.toISOString().split('T')[0];
      }),
    ];
    
    for (const date of datesToCheck) {
      try {
        const entriesResponse = await apiClient.get<
          SingleItemResponse<EntryWithDateResponse[]>
        >(`/latest/entries/date/${date}?user_id=${user_id}`);
        
        if (entriesResponse.data) {
          const found = entriesResponse.data.find((e) => e.id === id);
          if (found) {
            entry = found;
            break;
          }
        }
      } catch {
        // Continue searching
      }
    }
    
    if (!entry) {
      throw new Error('Entry not found');
    }
    
    // Build patch payload
    const patchPayload: { id: string; raw_markdown?: string; written_at?: string } = {
      id: id,
    };
    
    if (content !== undefined) {
      patchPayload.raw_markdown = content;
    }
    
    if (writtenAt !== undefined) {
      patchPayload.written_at = writtenAt;
    }
    
    // update using PATCH endpoint
    const patchResponse = await apiClient.patch<
      SingleItemResponse<EntryResponse[]>
    >('/latest/entries', [patchPayload]);
    
    if (!patchResponse.data || patchResponse.data.length === 0) {
      throw new Error('Failed to update entry: no data returned');
    }
    
    return mapEntryToFrontendWithDate(patchResponse.data[0], entry.date);
  },

  async deleteEntry(id: string): Promise<void> {
    await apiClient.delete(`/latest/entries/${id}`);
  },

  async getCalendar(): Promise<CalendarEntry[]> {
    const user_id = await getUserId();
    
    // Get calendar for current month
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    const response = await apiClient.get<
      SingleItemResponse<CalendarEntryResponse[]>
    >(
      `/latest/entries/calendar?user_id=${user_id}&start_date=${startDateStr}&end_date=${endDateStr}`
    );
    
    if (!response.data) {
      return [];
    }
    
    return response.data.map((entry) => ({
      date: entry.date,
      hasEntry: entry.hasEntry,
    }));
  },
};
