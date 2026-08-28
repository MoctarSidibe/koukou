import { Navigate, Route, Routes } from 'react-router-dom';
import { FarmProvider } from './app/FarmContext';
import { RequiresAuth, RequiresPlatformAdmin } from './auth/guards';
import { useAuth } from './auth/AuthContext';
import { LoginPage } from './auth/LoginPage';
import { Shell } from './components/Shell';
import { DashboardPage } from './pages/DashboardPage';
import { BatchesPage } from './pages/BatchesPage';
import { AlertsPage } from './pages/AlertsPage';
import { SalesPage } from './pages/SalesPage';
import { CaissePage } from './pages/CaissePage';
import { CustomersPage } from './pages/CustomersPage';
import { PromotionsPage } from './pages/PromotionsPage';
import { StockPage } from './pages/StockPage';
import { SanitaryPage } from './pages/SanitaryPage';
import { SlaughterPage } from './pages/SlaughterPage';
import { TeamPage } from './pages/TeamPage';
import { SettingsPage } from './pages/SettingsPage';
import { PlatformPage } from './pages/PlatformPage';

function HomeRedirect() {
  const { user } = useAuth();
  return (
    <Navigate
      to={user?.role === 'PLATFORM_ADMIN' ? '/app/platform' : '/app/dashboard'}
      replace
    />
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route element={<RequiresAuth />}>
        <Route
          path="/app"
          element={
            <FarmProvider>
              <Shell />
            </FarmProvider>
          }
        >
          <Route index element={<HomeRedirect />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="batches" element={<BatchesPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="finance" element={<SalesPage />} />
          <Route path="finance/ventes" element={<SalesPage />} />
          <Route path="finance/caisse" element={<CaissePage />} />
          <Route path="finance/clients" element={<CustomersPage />} />
          <Route path="finance/promotions" element={<PromotionsPage />} />
          <Route path="stock" element={<StockPage />} />
          <Route path="sanitary" element={<SanitaryPage />} />
          <Route path="slaughter" element={<SlaughterPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route element={<RequiresPlatformAdmin />}>
            <Route path="platform" element={<PlatformPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}