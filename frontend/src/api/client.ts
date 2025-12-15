import { authApi } from './auth';

let API_BASE_URL = '/api';
const envUrl = import.meta.env.VITE_API_BACKEND_URL;
if (envUrl && (envUrl.startsWith('http://localhost') || envUrl.startsWith('https://'))) {
  API_BASE_URL = envUrl;
} else if (envUrl && envUrl.includes('backend:')) {
  console.warn('Detected Docker hostname in browser context. Using Vite proxy instead.');
  API_BASE_URL = '/api';
}

export interface ApiError {
  message: string;
  status?: number;
}

// Track if we're currently refreshing to avoid multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  retryOn401 = true
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  const config: RequestInit = {
    ...options,
    headers,
    credentials: 'include',
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const response = await fetch(url, {
      ...config,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      // Handle 401 Unauthorized - try to refresh token
      // Skip refresh for auth endpoints to avoid infinite loops
      const isAuthEndpoint = endpoint.includes('/auth/me') || endpoint.includes('/auth/refresh');
      if (response.status === 401 && retryOn401 && !isAuthEndpoint) {
        // Try to refresh the token
        try {
          await attemptTokenRefresh();
          // Retry the original request once after refresh
          return request<T>(endpoint, options, false);
        } catch (refreshError) {
          // Refresh failed, user needs to log in again
          // Don't redirect here - let the component handle it
        }
      }
      
      // Try to extract error message from response body
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          if (errorData.detail) {
            errorMessage = errorData.detail;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        }
      } catch (e) {
        // If we can't parse the error, use the default message
      }
      
      const error: ApiError = {
        message: errorMessage,
        status: response.status,
      };
      throw error;
    }

    // Handle 204 No Content responses (no body)
    if (response.status === 204) {
      return null as T;
    }

    // Check if response has content
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }

    // If no JSON content, return null
    return null as T;
  } catch (error) {
    if (error instanceof Error) {
      throw { message: error.message } as ApiError;
    }
    throw error;
  }
}

async function attemptTokenRefresh(): Promise<void> {
  // If already refreshing, wait for the existing refresh to complete
  if (isRefreshing && refreshPromise) {
    await refreshPromise;
    return;
  }

  // Start a new refresh
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      await authApi.refreshToken();
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  await refreshPromise;
}

export const apiClient = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),
  put: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),
  patch: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};

