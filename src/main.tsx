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
}

function installAuthenticatedFetch() {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const isLoginRequest = url.includes('/api/auth/login');

    if (!token || isLoginRequest) return originalFetch(input, init);

    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    headers.set('Authorization', `Bearer ${token}`);
    const response = await originalFetch(input, { ...init, headers });

    if (response.status === 401) {
      clearAuth();
      window.location.reload();
    }
    return response;
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
    if (!user) {
      setHydrating(false);
      return;
    }

    let cancelled = false;
    const hydrate = async () => {
      const users = Storage.getUsers();
      Storage.saveUsers([user, ...users.filter(existing => existing.id !== user.id)]);
      Storage.saveActiveUserId(user.id);
      await Promise.allSettled([
        hydrateProductsFromServer(),
        hydrateInvoicesFromServer()
      ]);
      if (!cancelled) setHydrating(false);
    };

    void hydrate();
    return () => { cancelled = true; };
  }, [user]);

  if (!user) return <LoginView onLogin={setUser} />;
  if (hydrating) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center text-sm font-semibold">Loading billing data...</div>;

  const users = Storage.getUsers();
  const nextUsers = [user, ...users.filter(existing => existing.id !== user.id)];
  Storage.saveUsers(nextUsers);
  Storage.saveActiveUserId(user.id);
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthenticatedApp />
  </StrictMode>,
);
