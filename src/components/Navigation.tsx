import React, { useState } from 'react';
import { UserRole } from '../types';
import { canPerformAction } from '../lib/utils';
import { ShoppingCart, Package, Tag, BarChart3, Receipt, Users, Truck, FileSpreadsheet, ShieldCheck, ShieldAlert, PanelLeftClose, PanelLeftOpen, CreditCard, ClipboardList } from 'lucide-react';

interface NavigationProps { activeTab: string; setActiveTab: (tab: string) => void; userRole: UserRole; lowStockCount: number; activePromoCount: number; unpaidInvoiceCount: number; pendingDispatchCount?: number; }

export const Navigation: React.FC<NavigationProps> = ({ activeTab, setActiveTab, userRole, lowStockCount, activePromoCount, unpaidInvoiceCount, pendingDispatchCount = 0 }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isManager = userRole === 'MANAGER' || userRole === 'BRANCH_MANAGER';
  const isAccounts = userRole === 'ACCOUNTANT';
  const navItems = [
    { id: 'pos', label: 'POS & Billing', shortLabel: 'POS', icon: ShoppingCart, action: 'CREATE_POS_BILL' as const, badge: null },
    { id: 'inventory', label: 'Inventory', shortLabel: 'Stock', icon: Package, action: 'MANAGE_PRODUCTS' as const, badge: lowStockCount ? String(lowStockCount) : null, badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
    ...(isManager ? [{ id: 'accounts', label: 'Manager Invoices', shortLabel: 'Manager', icon: ClipboardList, action: 'VIEW_ALL_INVOICES' as const, badge: unpaidInvoiceCount ? String(unpaidInvoiceCount) : null, badgeColor: 'bg-violet-500/20 text-violet-300 border-violet-500/40' }] : []),
    ...(isAccounts ? [{ id: 'accounts', label: 'Accounts Payment', shortLabel: 'Accounts', icon: CreditCard, action: 'CONFIRM_PAYMENTS' as const, badge: unpaidInvoiceCount ? String(unpaidInvoiceCount) : null, badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' }] : []),
    { id: userRole === 'WAREHOUSE' ? 'accounts' : 'warehouse', label: userRole === 'WAREHOUSE' ? 'Warehouse Loading & Completion' : 'Warehouse & Logistics', shortLabel: 'Dispatch', icon: Truck, action: 'MANAGE_WAREHOUSE' as const, badge: pendingDispatchCount ? String(pendingDispatchCount) : null, badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
    { id: 'promos', label: 'Promos & Offers', shortLabel: 'Promos', icon: Tag, action: 'MANAGE_PROMOS' as const, badge: activePromoCount ? String(activePromoCount) : null, badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
    { id: 'invoices', label: 'Invoices & AR', shortLabel: 'Bills', icon: Receipt, action: 'VIEW_ALL_INVOICES' as const, badge: unpaidInvoiceCount ? String(unpaidInvoiceCount) : null, badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
    { id: 'eway', label: 'e-Way & e-Invoicing', shortLabel: 'e-Way', icon: ShieldCheck, action: 'MANAGE_EWAY_INVOICE' as const, badge: null },
    { id: 'tally', label: 'Tally ERP Bridge', shortLabel: 'Tally', icon: FileSpreadsheet, action: 'EXPORT_TALLY' as const, badge: null },
    { id: 'reports', label: 'Financial Reports', shortLabel: 'Reports', icon: BarChart3, action: 'VIEW_FINANCIAL_REPORTS' as const, badge: null },
    { id: 'users', label: 'User Control', shortLabel: 'Users', icon: Users, action: 'MANAGE_USERS' as const, badge: null },
    { id: 'audit', label: 'System Audit Logs', shortLabel: 'Audit', icon: ShieldAlert, action: 'VIEW_AUDIT_LOGS' as const, badge: null }
  ];
  const visibleItems = navItems.filter(item => canPerformAction(userRole, item.action));
  const roleDescription: Record<UserRole, string> = { ADMIN: 'System administration and oversight.', MANAGER: 'Review all invoices, manage additional discounts and credit notes before payment.', BRANCH_MANAGER: 'Review branch invoices, manage additional discounts and credit notes before payment.', CASHIER: 'Billing POS and invoice creation. Payment is collected by Accounts.', BILLING_USER: 'Billing POS and invoice creation. Payment is collected by Accounts.', ACCOUNTANT: 'Accounts payment collection and financial reconciliation.', WAREHOUSE: 'Warehouse loading and completion after Accounts confirms payment.' };
  return <>
    <aside className={`hidden md:flex flex-col bg-slate-900 border-r border-slate-800 p-3 shrink-0 space-y-4 min-h-[calc(100vh-4rem)] transition-all ${isCollapsed ? 'w-20' : 'w-64'}`}>
      <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-2'} pt-1 pb-2 border-b border-slate-800/80`}>{!isCollapsed && <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{userRole} MENU</p>}<button onClick={() => setIsCollapsed(prev => !prev)} className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700/80">{isCollapsed ? <PanelLeftOpen className="w-4 h-4 text-indigo-400" /> : <PanelLeftClose className="w-4 h-4 text-slate-400" />}</button></div>
      <div className="flex-1 px-1"><nav className="space-y-1.5">{visibleItems.map(item => { const Icon = item.icon; const active = activeTab === item.id; return <button key={`${item.id}-${item.label}`} onClick={() => setActiveTab(item.id)} title={item.label} className={`w-full flex items-center ${isCollapsed ? 'justify-center py-3 px-2' : 'justify-between px-3 py-2.5'} rounded-xl font-medium text-xs transition ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}><div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} min-w-0`}><Icon className="w-4 h-4 shrink-0" />{!isCollapsed && <span className="truncate">{item.label}</span>}</div>{!isCollapsed && item.badge && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'}`}>{item.badge}</span>}</button>; })}</nav></div>
      {!isCollapsed && <div className="mt-auto p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-xs text-slate-300"><div className="flex items-center justify-between mb-1"><span className="font-semibold text-white">Access Level</span><span className="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">{userRole}</span></div><p className="text-[11px] text-slate-400 leading-relaxed">{roleDescription[userRole]}</p></div>}
    </aside>
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 border-t border-slate-800 px-1 py-1.5 flex justify-around overflow-x-auto">{visibleItems.map(item => { const Icon = item.icon; return <button key={`m-${item.id}-${item.label}`} onClick={() => setActiveTab(item.id)} className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl shrink-0 ${activeTab === item.id ? 'text-indigo-400 font-bold' : 'text-slate-400'}`}><Icon className="w-4 h-4" /><span className="text-[9px] mt-0.5">{item.shortLabel}</span></button>; })}</nav>
  </>;
};
