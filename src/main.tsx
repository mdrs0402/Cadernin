import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { ApiError } from './api/client';
import { AuthProvider } from './auth/AuthProvider';
import { ToastProvider } from './components/Toast';
import { CustomerHomePage } from './pages/customer/CustomerHomePage';
import { StoreAccountPage } from './pages/customer/StoreAccountPage';
import { LoginPage } from './pages/LoginPage';
import { CustomerDetailPage } from './pages/merchant/CustomerDetailPage';
import { CustomersPage } from './pages/merchant/CustomersPage';
import { MerchantHomePage } from './pages/merchant/MerchantHomePage';
import { MerchantLayout } from './pages/merchant/MerchantLayout';
import { RemindersPage } from './pages/merchant/RemindersPage';
import { StoreSettingsPage } from './pages/merchant/StoreSettingsPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { RequireAuth, RequireRole, RoleRedirect } from './routes/guards';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Não insiste em erros 4xx (sem permissão, não encontrado…).
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
      staleTime: 30_000,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/entrar" element={<LoginPage />} />
              <Route element={<RequireAuth />}>
                <Route path="/" element={<RoleRedirect />} />
                <Route path="/bem-vindo" element={<OnboardingPage />} />

                <Route element={<RequireRole role="merchant" />}>
                  <Route path="/loja" element={<MerchantLayout />}>
                    <Route index element={<MerchantHomePage />} />
                    <Route path="clientes" element={<CustomersPage />} />
                    <Route path="clientes/:id" element={<CustomerDetailPage />} />
                    <Route path="lembretes" element={<RemindersPage />} />
                    <Route path="ajustes" element={<StoreSettingsPage />} />
                  </Route>
                </Route>

                <Route element={<RequireRole role="customer" />}>
                  <Route path="/conta" element={<CustomerHomePage />} />
                  <Route path="/conta/lojas/:storeId" element={<StoreAccountPage />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
