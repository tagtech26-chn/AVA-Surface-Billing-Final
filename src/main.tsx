import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { LoginView } from './components/LoginView';
import { Storage, hydrateProductsFromServer } from './lib/storage';
import { hydrateInvoicesFromServer } from './lib/invoiceHydration';
import { UserProfile } from './types';
import './index.css';
import './modern-pos.css';

const AUTH_TOKEN_KEY = 'avasurface_auth_token';
const AUTH_USER_KEY = 'avasurface_auth_user';

function clearAuth() {
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem('bizflow_active_user_id_v1');
  localStorage.removeItem('bizflow_active_user_id');
}

function installAuthenticatedFetch() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const isLoginRequest = url.includes('/api/auth/login');
    const method = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (!token || isLoginRequest) return originalFetch(input, init);
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    headers.set('Authorization', `Bearer ${token}`);
    const isManagerDecision = url.includes('/api/manager/invoices/') && url.endsWith('/decision');
    const isPaymentConfirmation = url.includes('/api/accounts/invoices/') && url.endsWith('/confirm-payment');
    const isWorkflowWrite = method !== 'GET' && (isManagerDecision || isPaymentConfirmation);
    try {
      const response = await originalFetch(input, { ...init, headers });
      if (response.status === 401) {
        clearAuth();
        window.location.reload();
        return response;
      }
      if (isWorkflowWrite && !response.ok) {
        let detail = `HTTP ${response.status}`;
        try {
          const body = await response.clone().text();
          if (body) {
            try { const parsed = JSON.parse(body) as { message?: string; detail?: string; title?: string }; detail = parsed.message || parsed.detail || parsed.title || body; }
            catch { detail = body; }
          }
        } catch { /* keep HTTP status */ }
        window.alert(`SAVE FAILED\n\n${detail}`);
      } else if (isWorkflowWrite && response.ok) {
        window.alert(isManagerDecision ? 'SUCCESS\n\nManager discount and credit note were saved successfully.' : 'SUCCESS\n\nPayment was confirmed and the invoice was locked successfully.');
      }
      return response;
    } catch (error) {
      if (isWorkflowWrite) window.alert(`SAVE FAILED\n\n${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  };
}

installAuthenticatedFetch();

function AuthenticatedApp() {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
      const raw = sessionStorage.getItem(AUTH_USER_KEY);
      return token && raw ? JSON.parse(raw) as UserProfile : null;
    } catch {
      clearAuth();
      return null;
    }
  });
  const [hydrating, setHydrating] = useState(true);

  useEffect(() => {
    if (!user) { setHydrating(false); return; }
    let active = true;
    (async () => {
      try { await Promise.all([hydrateProductsFromServer(), hydrateInvoicesFromServer()]); }
      finally { if (active) setHydrating(false); }
    })();
    return () => { active = false; };
  }, [user]);

  if (hydrating) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Loading BizFlow...</div>;
  if (!user) return <LoginView onLogin={(profile) => {
    // Keep the server-issued identity as the active application user. App.tsx
    // still uses the legacy Storage user list for several legacy screens, so
    // ensure the authenticated DB user is present there and selected by ID.
    const existingUsers = Storage.getUsers();
    const mergedUsers = existingUsers.some((candidate) => candidate.id === profile.id)
      ? existingUsers.map((candidate) => candidate.id === profile.id ? profile : candidate)
      : [profile, ...existingUsers];
    Storage.saveUsers(mergedUsers);
    Storage.saveActiveUserId(profile.id);
    setUser(profile);
  }} />;

  return <App activeUser={user} onLogout={() => {
    clearAuth();
    setUser(null);
    setHydrating(false);
  }} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthenticatedApp />
  </StrictMode>
);
