import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ToastProvider from './components/common/ToastProvider';
import { queryClient } from './api/queryClient';
import ProtectedRoute from './components/common/ProtectedRoute';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PasswordlessLogin from './pages/PasswordlessLogin';
import Transactions from './pages/Transactions';
import Settings from './pages/Settings';
import P2POrders from './pages/P2POrders';
import DexAnalytics from './pages/DexAnalytics';
import Webhooks from './pages/Webhooks';
import useTheme from './hooks/useTheme';

function App() {
  // initialize theme (applies dark class on documentElement)
  useTheme();
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/auth/passwordless" element={<PasswordlessLogin />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="p2p-orders" element={<P2POrders />} />
              <Route path="dex-analytics" element={<DexAnalytics />} />
              <Route path="webhooks" element={<Webhooks />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
          {/* Toast provider for notifications */}
          <ToastProvider />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
