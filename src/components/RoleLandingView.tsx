import React from 'react';
import { BarChart3, ClipboardCheck, CreditCard, PackageCheck, ShoppingCart } from 'lucide-react';
import { UserRole } from '../types';

interface RoleLandingViewProps {
  role: UserRole;
  onOpen: (tab: string) => void;
}

const config: Record<UserRole, { title: string; description: string; tab: string; icon: React.ComponentType<{className?: string}> }> = {
  ADMIN: { title: 'Enterprise Dashboard', description: 'System administration, oversight and operational controls.', tab: 'enterprise', icon: BarChart3 },
  MANAGER: { title: 'Manager Invoice Review', description: 'Review quotations and invoices, approve discounts and monitor workflow status.', tab: 'accounts', icon: ClipboardCheck },
  BRANCH_MANAGER: { title: 'Branch Invoice Review', description: 'Review branch quotations and invoices, approve discounts and monitor workflow status.', tab: 'accounts', icon: ClipboardCheck },
  CASHIER: { title: 'POS & Billing', description: 'Create quotations and invoices for customers.', tab: 'pos', icon: ShoppingCart },
  BILLING_USER: { title: 'POS & Billing', description: 'Create quotations and invoices for customers.', tab: 'pos', icon: ShoppingCart },
  ACCOUNTANT: { title: 'Accounts Payment', description: 'Review approved invoices, verify amounts and confirm payments.', tab: 'accounts', icon: CreditCard },
  WAREHOUSE: { title: 'Warehouse Loading & Completion', description: 'Process approved and payment-confirmed invoices for dispatch.', tab: 'accounts', icon: PackageCheck }
};

export const RoleLandingView: React.FC<RoleLandingViewProps> = ({ role, onOpen }) => {
  const item = config[role];
  const Icon = item.icon;
  return <div className="flex-1 p-6 flex items-center justify-center bg-slate-950">
    <div className="max-w-xl w-full rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">
      <div className="mx-auto mb-5 w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center"><Icon className="w-8 h-8 text-indigo-400" /></div>
      <p className="text-[10px] uppercase tracking-[0.2em] font-black text-indigo-400 mb-2">{role}</p>
      <h1 className="text-2xl font-black text-white">{item.title}</h1>
      <p className="mt-2 text-sm text-slate-400">{item.description}</p>
      <button onClick={() => onOpen(item.tab)} className="mt-6 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold">Open Workspace</button>
    </div>
  </div>;
};
