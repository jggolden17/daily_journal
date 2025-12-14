import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../hooks/useAuth';

declare global {
  interface Window {
    google: any;
  }
}

const isLocalEnvironment = import.meta.env.VITE_ENVIRONMENT === 'local';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Reset error when component mounts or location changes
  useEffect(() => {
    setError(null);
    setLoading(false);
  }, [location.pathname]);

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setLoading(true);
    setError(null);
    
    try {
      if (!credentialResponse.credential) {
        throw new Error('No credential received from Google');
      }
      
      // credentialResponse.credential is the ID token
      const userData = await login(credentialResponse.credential);
      
      if (userData) {
        navigate('/');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google Sign-In failed. Please try again.');
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Daily Journal</h2>
          <p className="mt-2 text-sm text-gray-600">Sign in to continue</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {!isLocalEnvironment && (
          <div className="mt-6 flex justify-center">
            {loading ? (
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-sm text-gray-600">Signing in...</p>
              </div>
            ) : (
              <GoogleLogin
                key={location.pathname}
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
              />
            )}
          </div>
        )}
        {isLocalEnvironment && (
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">Auto-logging in with mock user...</p>
          </div>
        )}
      </div>
    </div>
  );
}

