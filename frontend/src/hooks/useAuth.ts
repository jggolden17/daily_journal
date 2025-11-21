import { useState, useEffect, useCallback } from 'react';
import { authApi, type User } from '../api/auth';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    authApi
      .getMe()
      .then((userData) => {
        setUser(userData);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
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

  const handleGoogleSignIn = useCallback(() => {
    // TODO: Implement Google Sign-In
    // This is a placeholder that simulates the flow
    // In production, use Google Identity Services:
    // https://developers.google.com/identity/gsi/web
    
    // For now, simulate login with a mock token
    login('mock-google-id-token');
  }, [login]);

  return {
    user,
    loading,
    login,
    logout,
    handleGoogleSignIn,
    isAuthenticated: !!user,
  };
}

