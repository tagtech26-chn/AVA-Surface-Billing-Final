import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import { UserProfile } from '../types';

interface LoginViewProps {
  onLogin: (user: UserProfile) => void;
}

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
        body: JSON.stringify({ userName, password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Login failed.');
      onLogin({
        id: data.id,
        username: data.userName,
        name: data.displayName,
        role: data.role,
        isActive: data.isActive
      } as UserProfile);
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
          <div className="inline-flex items-center justify-center rounded-2xl bg-indigo-500/10 p-3 text-indigo-400 mb-4"><LogIn className="w-6 h-6" /></div>
          <h1 className="text-2xl font-bold text-white">AVASurface Billing</h1>
          <p className="text-sm text-slate-400 mt-1">Sign in to continue</p>
        </div>
        <label className="block text-sm text-slate-300 mb-2">Username</label>
        <input value={userName} onChange={e => setUserName(e.target.value)} autoComplete="username" className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-white mb-5 outline-none focus:border-indigo-500" />
        <label className="block text-sm text-slate-300 mb-2">Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" className="w-full rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-white mb-5 outline-none focus:border-indigo-500" />
        {error && <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
        <button disabled={busy} className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-3 font-semibold text-white">{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
