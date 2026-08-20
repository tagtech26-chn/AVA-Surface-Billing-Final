import React, { useState } from 'react';
import { UserProfile, UserRole } from '../types';
import { ShieldCheck, UserPlus, KeyRound, CheckCircle2, Lock, AlertCircle, X } from 'lucide-react';

interface UserControlModalProps { isOpen: boolean; onClose: () => void; users: UserProfile[]; activeUser: UserProfile; onSwitchUser: (user: UserProfile) => void; onCreateUser: (newUser: Omit<UserProfile, 'id'>) => void; currencySymbol: string; }

export const UserControlModal: React.FC<UserControlModalProps> = ({ isOpen, onClose, users, activeUser, onSwitchUser }) => {
  const [selected, setSelected] = useState<UserProfile | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  if (!isOpen) return null;

  const confirm = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    if (pin !== selected.pin) return setError('Incorrect PIN code.');
    onSwitchUser(selected); setSelected(null); setPin(''); setError(''); onClose();
  };

  const canSwitch = activeUser.role === 'ADMIN';

  return <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl text-slate-100">
    <div className="p-5 border-b border-slate-800 flex items-center justify-between"><div className="flex items-center gap-3"><div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400"><ShieldCheck className="w-5 h-5"/></div><div><h2 className="text-lg font-black text-white">User Control</h2><p className="text-xs text-slate-400">Administrator-only staff session control.</p></div></div><button onClick={onClose} className="p-2 text-slate-400 hover:text-white"><X className="w-5 h-5"/></button></div>
    <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">{!canSwitch ? <div className="rounded-2xl border border-amber-500/30 bg-amber-950/30 p-5 text-sm text-amber-200 flex items-center gap-3"><Lock className="w-5 h-5 shrink-0"/>Only an Administrator can switch staff sessions or manage users. Please sign out and authenticate as Administrator.</div> : <>
      {selected && <form onSubmit={confirm} className="rounded-2xl border border-indigo-500/40 bg-indigo-950/40 p-4 space-y-3"><div className="flex items-center justify-between"><div><div className="font-black text-white">Switch to {selected.name}</div><div className="text-xs text-indigo-300">{selected.role}</div></div><button type="button" onClick={() => { setSelected(null); setError(''); }} className="text-xs text-slate-400">Cancel</button></div><div className="flex gap-2"><div className="relative flex-1"><KeyRound className="absolute left-3 top-3 w-4 h-4 text-slate-500"/><input autoFocus type="password" value={pin} onChange={e => { setPin(e.target.value); setError(''); }} className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white" placeholder="Security PIN"/></div><button className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs">Authenticate</button></div>{error && <div className="text-xs text-rose-300 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>{error}</div>}</form>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{users.map(user => <div key={user.id} className={`p-4 rounded-2xl border ${user.id === activeUser.id ? 'border-indigo-500 bg-indigo-600/10' : 'border-slate-700 bg-slate-800/60'}`}><div className="flex items-center justify-between gap-3"><div><div className="font-bold text-white">{user.name}</div><div className="text-[10px] uppercase text-slate-400 mt-1">{user.role}</div></div>{user.id === activeUser.id ? <span className="text-[10px] text-emerald-300 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/>Active</span> : <button onClick={() => { setSelected(user); setPin(''); setError(''); }} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-indigo-600 text-xs font-bold">Switch</button>}</div></div>)}</div>
      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-400 flex items-center gap-2"><UserPlus className="w-4 h-4"/>New staff creation remains an Administrator function through the secured backend.</div>
    </>}</div>
  </div></div>;
};
