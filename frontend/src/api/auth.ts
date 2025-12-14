import { apiClient } from './client';

export interface User {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

const TOKEN_KEY = 'auth_token';

// Mock token constant - must match backend
export const MOCK_GOOGLE_ID_TOKEN = 'mock-google-id-token-dev';

// Token storage helpers
export const tokenStorage = {
  get: (): string | null => {
    return localStorage.getItem(TOKEN_KEY);
  },
  set: (token: string): void => {
    localStorage.setItem(TOKEN_KEY, token);
  },
  remove: (): void => {
    localStorage.removeItem(TOKEN_KEY);
  },
};

export const authApi = {
  async getMe(): Promise<User | null> {
    const token = tokenStorage.get();
    if (!token) {
      return null;
    }
    
    try {
      const response = await apiClient.get<{ data: User }>('/latest/auth/me');
      return response.data;
    } catch (error) {
      // If 401, token is invalid, remove it
      if (error && typeof error === 'object' && 'status' in error && error.status === 401) {
        tokenStorage.remove();
      }
      return null;
    }
  },

  async loginWithGoogle(idToken: string): Promise<User> {
    const response = await apiClient.post<{ data: AuthResponse }>('/latest/auth/google', {
      id_token: idToken,
    });
    
    // Store the access token
    tokenStorage.set(response.data.access_token);
    
    return response.data.user;
  },

  async logout(): Promise<void> {
    const token = tokenStorage.get();
    if (token) {
      try {
        await apiClient.post('/latest/auth/logout');
      } catch (error) {
        // Ignore errors on logout
        console.error('Logout error:', error);
      }
    }
    tokenStorage.remove();
  },
};
