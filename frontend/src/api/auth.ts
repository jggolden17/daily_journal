import { apiClient } from './client';

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

// Mock user for development
let mockUser: User | null = null;

export const authApi = {
  async getMe(): Promise<User | null> {
    // TODO: Replace with: return apiClient.get<User>('/me');
    return mockUser;
  },

  async loginWithGoogle(idToken: string): Promise<User> {
    // TODO: Replace with: return apiClient.post<User>('/auth/google', { idToken });
    // For now, create a mock user
    mockUser = {
      id: 'fdd4773b-c740-4d4a-a6b6-0c51b47ed33a',
      email: 'user@example.com',
      name: 'Test User',
    };
    return mockUser;
  },

  async logout(): Promise<void> {
    // TODO: Replace with: return apiClient.post('/auth/logout');
    mockUser = null;
  },
};

