import React, { useState } from 'react';
import { UserProfile, UserRole } from '../types';
import { ShieldCheck, UserPlus, KeyRound, CheckCircle2, Lock, User, AlertCircle, X } from 'lucide-react';

interface UserControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserProfile[];
  activeUser: UserProfile;
  onSwitchUser: (user: UserProfile) => void;
  onCreateUser: (newUser: Omit<UserProfile, 'id'>) => void;
  currencySymbol: string;
}

export const UserControlModal: React.FC<UserControlModalProps> = ({
  isOpen,
  onClose,
  users,
  activeUser,
  onSwitchUser,
  onCreateUser
}) => {
  const [selectedUserToSwitch, setSelectedUserToSwitch] = useState<UserProfile | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // New user form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('CASHIER');
  const [newPin, setNewPin] = useState('1234');
  const [newPhone, setNewPhone] = useState('');

  if (!isOpen) return null;

  const handleConfirmPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserToSwitch) return;

    if (pinInput === selectedUserToSwitch.pin) {
      onSwitchUser(selectedUserToSwitch);
      setSelectedUserToSwitch(null);
      setPinInput('');
      setPinError('');
      onClose();
    } else {
      setPinError('Incorrect PIN code. Please try again.');
    }
  };

  const handleCreateUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;

    onCreateUser({
      name: newName,
      email: newEmail,
      role: newRole,
      pin: newPin,
      avatar: `https://images.unsplash.com/photo-${1500000000000 + Math.floor(Math.random() * 1000000)}?w=150&auto=format&fit=crop&q=80`,
      phone: newPhone
    });

    setNewName('');
    setNewEmail('');
    setShowAddForm(false);
  };

  const rolesMatrix: { role: UserRole; label: string; color: string; desc: string; permissions: string[] }[] = [
    {
      role: 'ADMIN',
      label: 'Administrator',
      color: 'bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/30',
      desc: 'Full System Ownership',
      permissions: ['POS Billing & Counter Sales', 'Inventory & Stock Adjustments', 'Discount & Promo Management', 'Financial Reports & P&L', 'User Role & PIN Management']
    },
    {
      role: 'MANAGER',
      label: 'Store Manager',
      color: 'bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/30',
      desc: 'Operations & Inventory Lead',
      permissions: ['POS Billing & Counter Sales', 'Inventory & Stock Adjustments', 'Discount & Promo Management', 'Financial Reports Review']
    },
    {
      role: 'CASHIER',
      label: 'Billing Staff / Cashier',
      color: 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30',
      desc: 'Front-desk Sales & Invoicing',
      permissions: ['POS Billing & Counter Sales', 'Product Catalog Lookup', 'Customer Account Assignment']
    },
    {
      role: 'ACCOUNTANT',
      label: 'Financial Accountant',
      color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
      desc: 'Ledger & Audit Specialist',
      permissions: ['Financial Reports & P&L', 'Expense Logging & Audit', 'Accounts Receivable Reconciliation', 'Tax & Invoice Overview']
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl text-slate-100">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">User Control & Role Management</h2>
              <p className="text-xs text-slate-400">Switch active user session, verify PIN, or configure role permissions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* PIN Verification Step Modal Popup overlay if selecting a user */}
          {selectedUserToSwitch && (
            <div className="p-5 rounded-2xl bg-indigo-950/60 border border-indigo-500/40 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <img
                    src={selectedUserToSwitch.avatar}
                    alt={selectedUserToSwitch.name}
                    className="w-10 h-10 rounded-xl object-cover ring-2 ring-indigo-400"
                  />
                  <div>
                    <h3 className="font-bold text-white text-sm">Switch to {selectedUserToSwitch.name}</h3>
                    <p className="text-xs text-indigo-300">Role: {selectedUserToSwitch.role}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedUserToSwitch(null); setPinError(''); }}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleConfirmPin} className="space-y-3">
                <label className="block text-xs font-semibold text-slate-300">
                  Enter Security PIN for {selectedUserToSwitch.name}:
                </label>
                <div className="flex items-center space-x-3">
                  <div className="relative flex-1">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="password"
                      maxLength={6}
                      value={pinInput}
                      onChange={(e) => { setPinInput(e.target.value); setPinError(''); }}
                      placeholder="e.g. 1234"
                      autoFocus
                      className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-indigo-500/50 rounded-xl text-white text-center tracking-widest font-mono text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl transition shadow-lg shadow-indigo-600/30"
                  >
                    Authenticate
                  </button>
                </div>
                {pinError && (
                  <div className="flex items-center space-x-1.5 text-xs text-rose-400">
                    <AlertCircle className="w-4 h-4" />
                    <span>{pinError}</span>
                  </div>
                )}
                <p className="text-[11px] text-slate-400 italic">
                  Demo Default PINs: Admin (1234), Manager (2222), Cashier (1111), Accountant (3333)
                </p>
              </form>
            </div>
          )}

          {/* User List & Profile Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                Staff Accounts ({users.length})
              </h3>
              {activeUser.role === 'ADMIN' && (
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="flex items-center space-x-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-3 py-1.5 rounded-xl border border-indigo-500/20 transition"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{showAddForm ? 'Cancel New Profile' : 'Add Staff User'}</span>
                </button>
              )}
            </div>

            {/* Add User Form */}
            {showAddForm && (
              <form onSubmit={handleCreateUserSubmit} className="mb-4 p-4 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-3">
                <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">New Staff Profile Setup</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
                    <input
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Alex Rivera"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="alex@bizflow.com"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Role Permission</label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as UserRole)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="CASHIER">CASHIER (Billing POS)</option>
                      <option value="MANAGER">MANAGER (Operations)</option>
                      <option value="ACCOUNTANT">ACCOUNTANT (Finance)</option>
                      <option value="ADMIN">ADMIN (Full Control)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">4-Digit PIN Code</label>
                    <input
                      type="password"
                      maxLength={6}
                      required
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      placeholder="1234"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-md transition"
                  >
                    Save User Profile
                  </button>
                </div>
              </form>
            )}

            {/* Grid of Users */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {users.map((user) => {
                const isCurrent = user.id === activeUser.id;
                return (
                  <div
                    key={user.id}
                    className={`p-3.5 rounded-2xl border transition flex items-center justify-between ${
                      isCurrent
                        ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500/40'
                        : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/80'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-11 h-11 rounded-xl object-cover ring-1 ring-slate-600"
                      />
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-white">{user.name}</span>
                          {isCurrent && (
                            <span className="flex items-center space-x-1 text-[10px] font-semibold text-indigo-300 bg-indigo-500/20 px-1.5 py-0.2 rounded border border-indigo-400/30">
                              <CheckCircle2 className="w-3 h-3 text-indigo-400" />
                              <span>Active</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">
                            {user.role}
                          </span>
                          <span className="text-xs text-slate-400 truncate max-w-[120px]">
                            {user.email}
                          </span>
                        </div>
                      </div>
                    </div>

                    {!isCurrent && (
                      <button
                        onClick={() => {
                          setSelectedUserToSwitch(user);
                          setPinInput('');
                          setPinError('');
                        }}
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-700 hover:bg-indigo-600 text-slate-200 hover:text-white rounded-xl transition shadow-sm"
                      >
                        Switch
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Role Permissions Reference Table */}
          <div className="pt-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">
              Role Access & Capabilities Matrix
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rolesMatrix.map((item) => (
                <div key={item.role} className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${item.color}`}>
                      {item.label}
                    </span>
                    <span className="text-[11px] text-slate-400">{item.desc}</span>
                  </div>
                  <ul className="space-y-1 pt-1">
                    {item.permissions.map((perm, idx) => (
                      <li key={idx} className="flex items-center space-x-1.5 text-xs text-slate-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{perm}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl transition"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
};
