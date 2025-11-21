import { apiClient } from './client';
import { authApi } from './auth';

// Backend response types
interface SingleItemResponse<T> {
  data: T | null;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface ThreadResponse {
  id: string;
  user_id: string;
  date: string; // ISO date string (YYYY-MM-DD)
  created_at: string;
  updated_at: string;
}

// Helper function to get user ID
async function getUserId(): Promise<string> {
  const user = await authApi.getMe();
  if (!user || !user.id) {
    throw new Error('User not authenticated. Please log in.');
  }
  return user.id;
}

export const threadsApi = {
  /**
   * Get or create a thread for a specific date
   * Uses upsert to ensure we always have a thread for the date
   */
  async getOrCreateThread(date: string): Promise<ThreadResponse> {
    const user_id = await getUserId();
    
    // Use upsert to get or create the thread
    const response = await apiClient.post<SingleItemResponse<ThreadResponse[]>>(
      '/latest/threads/upsert',
      [
        {
          user_id: user_id,
          date: date,
        },
      ]
    );
    
    if (!response.data || response.data.length === 0) {
      throw new Error('Failed to get or create thread: no data returned');
    }
    
    return response.data[0];
  },

  /**
   * Get thread by date (if it exists)
   */
  async getThreadByDate(date: string): Promise<ThreadResponse | null> {
    const user_id = await getUserId();
    
    // Query threads with date filter
    // Note: The backend uses pagination, so we need to filter client-side
    // In a real app, you'd want a dedicated endpoint for this
    const response = await apiClient.get<PaginatedResponse<ThreadResponse>>(
      `/latest/threads?page=1&page_size=100`
    );
    
    const thread = response.data.find(
      (t) => t.date === date && t.user_id === user_id
    );
    
    return thread || null;
  },
};

