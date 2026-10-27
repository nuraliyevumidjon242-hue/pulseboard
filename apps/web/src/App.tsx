import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProviders } from './app/providers';
import { BootSplash, RequireAuth, RequirePermission } from './components/auth/guards';
import { AppShell } from './components/layout/app-shell';
import { useAuthStore } from './stores/auth-store';

const DashboardPage = lazy(() => import('./pages/dashboard'));
const SalesPage = lazy(() => import('./pages/sales'));
const InventoryPage = lazy(() => import('./pages/inventory'));
const AnalyticsPage = lazy(() => import('./pages/analytics'));
const TeamPage = lazy(() => import('./pages/team'));
const StoresPage = lazy(() => import('./pages/stores'));
const SettingsPage = lazy(() => import('./pages/settings'));
const NotFoundPage = lazy(() => import('./pages/not-found'));

const LoginPage = lazy(() => import('./pages/auth/login'));
const RegisterPage = lazy(() => import('./pages/auth/register'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/forgot-password'));
const ResetPasswordPage = lazy(() => import('./pages/auth/reset-password'));
const AcceptInvitationPage = lazy(() => import('./pages/auth/accept-invitation'));

/** Keeps signed-in users out of the auth screens without blocking invitation links. */
function PublicOnly({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);
  if (status === 'booting') return <BootSplash />;
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Suspense fallback={<BootSplash />}>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnly>
              <LoginPage />
            </PublicOnly>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnly>
              <RegisterPage />
            </PublicOnly>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicOnly>
              <ForgotPasswordPage />
            </PublicOnly>
          }
        />
        <Route
          path="/reset-password"
          element={
            <PublicOnly>
              <ResetPasswordPage />
            </PublicOnly>
          }
        />
        <Route path="/accept-invitation" element={<AcceptInvitationPage />} />

        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route
            path="sales"
            element={
              <RequirePermission permission="sales:read">
                <SalesPage />
              </RequirePermission>
            }
          />
          <Route
            path="inventory"
            element={
              <RequirePermission permission="products:read">
                <InventoryPage />
              </RequirePermission>
            }
          />
          <Route
            path="analytics"
            element={
              <RequirePermission permission="analytics:read">
                <AnalyticsPage />
              </RequirePermission>
            }
          />
          <Route
            path="team"
            element={
              <RequirePermission permission="team:read">
                <TeamPage />
              </RequirePermission>
            }
          />
          <Route path="stores" element={<StoresPage />} />
          <Route
            path="settings"
            element={
              <RequirePermission permission="store:read">
                <SettingsPage />
              </RequirePermission>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  );
}
