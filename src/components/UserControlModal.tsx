import React from 'react';
import { UserProfile } from '../types';
import { ShieldCheck, LogOut, X } from 'lucide-react';

interface UserControlModalProps { isOpen: boolean; onClose: () => void; users: UserProfile[]; activeUser: UserProfile; onSwitchUser: (user: UserProfile) => void; onCreateUser: (newUser: Omit<UserProfile, 'id'>) => void; currencySymbol: string; }

export const UserControlModal: React.FC<UserControlModalProps> = ({ isOpen, onClose, activeUser }) => {
  if (!isOpen) return null;
  const signOut = () => {
    sessionStorage.removeItem('avasurface_auth_token');
    sessionStorage.removeItem('avasurface_auth_user');
    localStorage.removeItem('avasurface_auth_token');
    localStorage.removeItem('avasurface_auth_user');
    localStorage.removeItem('bizflow_active_user_id_v1');
    window.location.reload();
  };
  return <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl text-slate-100">
    <div className="p-5 border-b border-slate-800 flex items-center justify-between"><div className="flex items-center gap-3"><div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400"><ShieldCheck className="w-5 h-5"/></div><div><h2 className="text-lg font-black text-white">Authenticated Session</h2><p className="text-xs text-slate-400">Users cannot switch sessions without signing in.</p></div></div><button onClick={onClose} className="p-2 text-slate-400 hover:text-white"><X className="w-5 h-5"/></button></div>
    <div className="p-5 space-y-4"><div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/30 p-4"><div className="text-[10px] uppercase tracking-wider text-indigo-300 font-bold">Current authenticated user</div><div className="mt-1 text-lg font-black text-white">{activeUser.name}</div><div className="text-xs text-slate-400 mt-1">{activeUser.role}</div></div><div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 text-xs text-amber-200">Switching to another user from the current session has been disabled. To change user, sign out and authenticate with that user's credentials.</div><button onClick={signOut} className="w-full px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center justify-center gap-2"><LogOut className="w-4 h-4"/> Sign Out</button></div>
  </div></div>;
};
