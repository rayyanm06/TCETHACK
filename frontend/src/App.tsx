import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth.tsx';

// Citizen Views
import { Login } from './citizen/pages/Login.tsx';
import { CitizenShell } from './citizen/components/CitizenShell.tsx';
import { CitizenHome } from './citizen/pages/CitizenHome.tsx';
import { ReportWaste } from './citizen/pages/ReportWaste.tsx';
import { MyReports } from './citizen/pages/MyReports.tsx';
import { ReportDetails } from './citizen/pages/ReportDetails.tsx';
import { MyImpact } from './citizen/pages/MyImpact.tsx';

// Municipal Operator Views
import { OpsShell } from './ops/OpsShell.tsx';
import { QueueTable } from './ops/pages/QueueTable.tsx';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactElement; requiredRole?: 'OPERATOR' | 'CITIZEN' }> = ({
  children,
  requiredRole,
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center text-xs font-semibold text-ink-3">
        Connecting to CivicClean...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={user.role === 'OPERATOR' ? '/operator' : '/citizen'} replace />;
  }

  return children;
};

export const App: React.FC = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Citizen Protected Routes */}
      <Route
        path="/citizen"
        element={
          <ProtectedRoute requiredRole="CITIZEN">
            <CitizenShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<CitizenHome />} />
        <Route path="report" element={<ReportWaste />} />
        <Route path="reports" element={<MyReports />} />
        <Route path="reports/:id" element={<ReportDetails />} />
        <Route path="impact" element={<MyImpact />} />
      </Route>

      {/* Operator Protected Routes */}
      <Route
        path="/operator"
        element={
          <ProtectedRoute requiredRole="OPERATOR">
            <OpsShell />
          </ProtectedRoute>
        }
      />
      <Route
        path="/operator/routes"
        element={
          <ProtectedRoute requiredRole="OPERATOR">
            <OpsShell />
          </ProtectedRoute>
        }
      />
      <Route
        path="/operator/forecast"
        element={
          <ProtectedRoute requiredRole="OPERATOR">
            <OpsShell />
          </ProtectedRoute>
        }
      />
      <Route
        path="/operator/impact"
        element={
          <ProtectedRoute requiredRole="OPERATOR">
            <OpsShell />
          </ProtectedRoute>
        }
      />
      <Route
        path="/operator/queue"
        element={
          <ProtectedRoute requiredRole="OPERATOR">
            <QueueTable />
          </ProtectedRoute>
        }
      />

      {/* Aliases & Backward-Compatibility */}
      <Route path="/ops/*" element={<Navigate to="/operator" replace />} />
      <Route path="/ops" element={<Navigate to="/operator" replace />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Navigate to={user?.role === 'OPERATOR' ? '/operator' : '/citizen'} replace />
          </ProtectedRoute>
        }
      />
      <Route path="/report" element={<Navigate to="/citizen/report" replace />} />
      <Route path="/reports" element={<Navigate to="/citizen/reports" replace />} />
      <Route path="/reports/:id" element={<Navigate to="/citizen/reports/:id" replace />} />
      <Route path="/impact" element={<Navigate to="/citizen/impact" replace />} />

      {/* Catch-all */}
      <Route
        path="*"
        element={
          <ProtectedRoute>
            <Navigate to={user?.role === 'OPERATOR' ? '/operator' : '/citizen'} replace />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

