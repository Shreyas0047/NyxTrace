import { useState, useEffect, lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import type { UserRole } from '../types';
import { useAuthStore } from '../stores/authStore';
import MainLayout from '../layouts/MainLayout';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import ManifestoPage from '../pages/ManifestoPage';
import DiscoverPage from '../pages/DiscoverPage';
import EnhancedDashboardPage from '../pages/EnhancedDashboardPage';
import InvestigationsPage from '../pages/InvestigationsPage';
import AlertsPage from '../pages/AlertsPage';
import EvidenceExplorerPage from '../pages/EvidenceExplorerPage';
import LiveTelemetryPage from '../pages/LiveTelemetryPage';
import BlockchainOperationsPage from '../pages/BlockchainOperationsPage';
import ThreatIntelligencePage from '../pages/ThreatIntelligencePage';
import ForensicAnalyticsPage from '../pages/ForensicAnalyticsPage';
import SettingsPage from '../pages/SettingsPage';
import ChainOfCustodyPage from '../pages/ChainOfCustodyPage';
import UsersPage from '../pages/UsersPage';

// Heavy pages — code-split so they download on demand instead of bloating
// the initial bundle. Each becomes its own chunk.
const AIAnalysisPage = lazy(() => import('../pages/AIAnalysisPage'));
const SandboxDashboardPage = lazy(() => import('../pages/SandboxDashboardPage'));
const LogsPage = lazy(() => import('../pages/LogsPage'));
const InvestigationDetailPage = lazy(() => import('../pages/InvestigationDetailPage'));
const ReportsPage = lazy(() => import('../pages/ReportsPage'));
const EvidenceArtifactsPage = lazy(() => import('../pages/EvidenceArtifactsPage'));
const SystemHealthPage = lazy(() => import('../pages/SystemHealthPage'));

// Loading screen shown during auth check
function AuthLoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0f172a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#22d3ee'
    }}>
      <h1 style={{ fontSize: '32px', marginBottom: '10px', color: '#fff' }}>NyxTrace</h1>
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid #0891b2',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginTop: '20px'
      }} />
      <p style={{ marginTop: '20px', color: '#94a3b8' }}>Loading platform...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// Protected Route Wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, checkAuth } = useAuthStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        await checkAuth();
      } catch {
        // ignore
      } finally {
        setChecking(false);
      }
    };
    init();
  }, [checkAuth]);

  if (checking) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Role-based Route Wrapper
function RoleRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: UserRole[] }) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user || !allowedRoles.includes(user.role as UserRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// Public Route Wrapper (redirect if already authenticated)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <PublicRoute>
        <LoginPage />
      </PublicRoute>
    ),
  },
  {
    path: '/register',
    element: (
      <PublicRoute>
        <RegisterPage />
      </PublicRoute>
    ),
  },
  {
    path: '/forgot-password',
    element: (
      <PublicRoute>
        <ForgotPasswordPage />
      </PublicRoute>
    ),
  },
  {
    path: '/manifesto',
    element: <ManifestoPage />,
  },
  {
    path: '/discover',
    element: <DiscoverPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: 'dashboard',
        element: <EnhancedDashboardPage />,
      },
      {
        path: 'investigations',
        element: <InvestigationsPage />,
      },
      {
        path: 'investigations/:id',
        element: <InvestigationDetailPage />,
      },
      {
        path: 'evidence',
        element: <EvidenceExplorerPage />,
      },
      {
        path: 'alerts',
        element: <AlertsPage />,
      },
      {
        path: 'sandbox',
        element: <SandboxDashboardPage />,
      },
      {
        path: 'ai-analysis',
        element: <AIAnalysisPage />,
      },
      {
        path: 'telemetry',
        element: <LiveTelemetryPage />,
      },
      {
        path: 'reports',
        element: <ReportsPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: 'audit',
        element: <LogsPage />,
      },
      {
        path: 'evidence-artifacts',
        element: <EvidenceArtifactsPage />,
      },
      {
        path: 'health',
        element: (
          <RoleRoute allowedRoles={['admin', 'super_admin']}>
            <SystemHealthPage />
          </RoleRoute>
        ),
      },
      {
        path: 'blockchain-operations',
        element: (
          <RoleRoute allowedRoles={['admin', 'super_admin', 'forensic_analyst']}>
            <BlockchainOperationsPage />
          </RoleRoute>
        ),
      },
      {
        path: 'chain-of-custody',
        element: (
          <RoleRoute allowedRoles={['admin', 'super_admin', 'forensic_analyst']}>
            <ChainOfCustodyPage />
          </RoleRoute>
        ),
      },
      {
        path: 'threat-intelligence',
        element: (
          <RoleRoute allowedRoles={['admin', 'super_admin', 'forensic_analyst']}>
            <ThreatIntelligencePage />
          </RoleRoute>
        ),
      },
      {
        path: 'forensic-analytics',
        element: (
          <RoleRoute allowedRoles={['admin', 'super_admin']}>
            <ForensicAnalyticsPage />
          </RoleRoute>
        ),
      },
      {
        path: 'users',
        element: (
          <RoleRoute allowedRoles={['admin', 'super_admin']}>
            <UsersPage />
          </RoleRoute>
        ),
      },
      {
        path: '',
        element: <Navigate to="/dashboard" replace />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);

export default router;
