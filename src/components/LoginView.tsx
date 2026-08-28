import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { AvaSurfacesLogo } from './AvaSurfacesLogo';

interface LoginViewProps { onLogin: (user: UserProfile) => void; }

const normalizeRole = (role: string): UserRole => {
  const normalized = String(role || '').trim().toUpperCase();
  if (normalized === 'ACCOUNTS' || normalized === 'ACCOUNTANT') return 'ACCOUNTANT';
  if (normalized === 'BRANCH_MANAGER') return 'BRANCH_MANAGER';
  if (normalized === 'BILLING_USER') return 'BILLING_USER';
  if (normalized === 'CASHIER') return 'CASHIER';
  if (normalized === 'WAREHOUSE') return 'WAREHOUSE';
  if (normalized === 'MANAGER') return 'MANAGER';
  if (normalized === 'ADMIN') return 'ADMIN';
  throw new Error(`Login rejected: unsupported user role '${role || 'empty'}'.`);
};

export function LoginView({ onLogin }: LoginViewProps) {
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: userName.trim(), password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Login failed.');
      if (!data.token || !data.id || !data.userName || !data.role) throw new Error('Login failed: server returned an incomplete user identity.');

      const user: UserProfile = {
        id: data.id,
        username: data.userName,
        name: data.displayName,
        email: '',
        pin: '',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(data.displayName || data.userName)}&background=312e81&color=fff`,
        role: normalizeRole(data.role),
        phone: undefined
      };

      sessionStorage.setItem('avasurface_auth_token', data.token);
      sessionStorage.setItem('avasurface_auth_user', JSON.stringify(user));
      localStorage.removeItem('avasurface_auth_token');
      localStorage.removeItem('avasurface_auth_user');
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <div className="mb-8">
          <div className="flex items-start gap-5 mb-6">
            <div className="shrink-0 pr-5 border-r border-slate-700"><AvaSurfacesLogo /></div>
            <div className="pt-1">
              <div className="font-serif font-bold text-2xl text-white leading-none">Vero</div>
              <div className="font-serif italic text-sm text-amber-400 mt-1">Where every surface tells a story</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-amber-400 mb-2"><LogIn className="w-4 h-4" /><span className="text-[10px] uppercase tracking-[0.2em] font-black">Secure Access</span></div>
          <h1 className="text-2xl font-bold text-white">Vero Billing System</h1>
          <p className="text-sm text-slate-400 mt-1">Sign in to continue</p>
        </div>
        <label className="block text-sm text-slate-300 mb-2">Username</label>
        <input value={userName} onChange={e => setUserName(e.target.value)} autoComplete="username" required className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-white mb-5 outline-none focus:border-amber-500" />
        <label className="block text-sm text-slate-300 mb-2">Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-white mb-5 outline-none focus:border-amber-500" />
        {error && <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
        <button disabled={busy} className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 px-4 py-3 font-semibold text-slate-950 flex items-center justify-center gap-2">{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
