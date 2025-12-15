import { useState, useEffect, useCallback } from 'react';
import { authApi, type User, MOCK_GOOGLE_ID_TOKEN } from '../api/auth';

const isLocalEnvironment = import.meta.env.VITE_ENVIRONMENT === 'local';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if user is already logged in
        const userData = await authApi.getMe();
        
        if (userData) {
          setUser(userData);
          return;
        }

        // If not logged in and in local dev mode, auto-login with mock token
        if (isLocalEnvironment) {
          try {
            const mockUserData = await authApi.loginWithGoogle(MOCK_GOOGLE_ID_TOKEN);
            setUser(mockUserData);
          } catch (error) {
            console.error('Auto-login failed in dev mode:', error);
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(async (idToken: string) => {
    try {
      const userData = await authApi.loginWithGoogle(idToken);
      setUser(userData);
      return userData;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, []);

  return {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
  };
}
