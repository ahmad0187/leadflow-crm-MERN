import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import './index.css';
import { AuthProvider, useAuth } from './lib/auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Import from './pages/Import.jsx';
import Leads from './pages/Leads.jsx';
import Login from './pages/Login.jsx';
import Pipeline from './pages/Pipeline.jsx';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: (n, err) => err?.status !== 401 && n < 2, refetchOnWindowFocus: false } },
});

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid h-screen place-items-center text-sm text-ink-400">Loading…</div>;
  return user ? children : <Navigate to="/login" replace />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<Protected><Layout /></Protected>}>
              <Route index element={<Dashboard />} />
              <Route path="pipeline" element={<Pipeline />} />
              <Route path="leads" element={<Leads />} />
              <Route path="import" element={<Import />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
