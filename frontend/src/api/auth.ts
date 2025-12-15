import { apiClient } from './client';

export interface User {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
}

export interface AuthResponse {
  user: User;
}

// Mock token constant - must match backend
export const MOCK_GOOGLE_ID_TOKEN = 'mock-google-id-token-dev';

export const authApi = {
  async getMe(): Promise<User | null> {
    try {
      const response = await apiClient.get<{ data: User }>('/latest/auth/me');
      return response.data;
    } catch (error) {
      // If 401, user is not authenticated - return null instead of throwing
      if (error && typeof error === 'object' && 'status' in error && error.status === 401) {
        return null;
      }
      // For other errors, log but still return null to prevent loading state from hanging
      // The useAuth hook's finally block will set loading to false
      console.error('Error checking auth status:', error);
      return null;
    }
  },

  async loginWithGoogle(idToken: string): Promise<User> {
    try {
      const response = await apiClient.post<{ data: AuthResponse }>('/latest/auth/google', {
        id_token: idToken,
      });
      
      // Response should have { data: { user: User } }
      if (!response?.data?.user) {
        throw new Error('Invalid response format from login endpoint');
      }
      return response.data.user;
    } catch (error) {
      // Re-throw with more context
      if (error && typeof error === 'object' && 'status' in error) {
        const statusError = error as { status?: number; message?: string };
        throw new Error(
          `Login failed: ${statusError.message || `HTTP ${statusError.status}`}`
        );
      }
      throw error instanceof Error ? error : new Error('Unknown login error');
    }
  },

  async refreshToken(): Promise<User> {
    const response = await apiClient.post<{ data: User }>('/latest/auth/refresh');
    return response.data;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/latest/auth/logout');
    } catch (error) {
      // Ignore errors on logout
      console.error('Logout error:', error);
    }
  },
};
