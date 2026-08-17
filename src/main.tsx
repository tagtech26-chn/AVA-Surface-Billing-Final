import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { LoginView } from './components/LoginView';
import { Storage } from './lib/storage';
import { UserProfile } from './types';
import './index.css';

const AUTH_TOKEN_KEY = 'avasurface_auth_token';
const AUTH_USER_KEY = 'avasurface_auth_user';

function installAuthenticatedFetch() {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const isLoginRequest = url.includes('/api/auth/login');

    if (!token || isLoginRequest) {
      return originalFetch(input, init);
    }

    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    headers.set('Authorization', `Bearer ${token}`);

    const response = await originalFetch(input, { ...init, headers });

    if (response.status === 401) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
      localStorage.removeItem('bizflow_active_user_id_v1');
      window.location.reload();
    }

    return response;
  };
}

installAuthenticatedFetch();

function AuthenticatedApp() {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      const raw = localStorage.getItem(AUTH_USER_KEY);
      return token && raw ? JSON.parse(raw) as UserProfile : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!user) return;
    const users = Storage.getUsers();
    const nextUsers = [user, ...users.filter(existing => existing.id !== user.id)];
    Storage.saveUsers(nextUsers);
    Storage.saveActiveUserId(user.id);
  }, [user]);

  if (!user) {
    return <LoginView onLogin={setUser} />;
  }

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthenticatedApp />
  </StrictMode>,
);
