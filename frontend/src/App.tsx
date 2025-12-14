import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { TodayPage } from './pages/TodayPage';
import { DayPage } from './pages/DayPage';
import { MetricsPage } from './pages/MetricsPage';
import { LoginPage } from './pages/LoginPage';
import { useAuth } from './hooks/useAuth';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout>
                <TodayPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/day/:date"
          element={
            <ProtectedRoute>
              <AppLayout>
                <DayPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/metrics"
          element={
            <ProtectedRoute>
              <AppLayout>
                <MetricsPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </HashRouter>
  );
}

export default App;

