import React, { useState } from 'react';
import { UserRole } from '../types';
import { canPerformAction } from '../lib/utils';
import {
  ShoppingCart,
  Package,
  Tag,
  BarChart3,
  Receipt,
  Users,
  Truck,
  FileSpreadsheet,
  ShieldCheck,
  ShieldAlert,
  PanelLeftClose,
  PanelLeftOpen,
  CreditCard,
  Percent
} from 'lucide-react';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole: UserRole;
  lowStockCount: number;
  activePromoCount: number;
  unpaidInvoiceCount: number;
  pendingDispatchCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  userRole,
  lowStockCount,
  activePromoCount,
  unpaidInvoiceCount,
  pendingDispatchCount = 0
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => localStorage.getItem('bizflow_nav_collapsed') === 'true');

  const navItems = [
    { id: 'pos', label: 'POS & Billing', shortLabel: 'POS', icon: ShoppingCart, action: 'CREATE_POS_BILL' as const, badge: null },
    { id: 'inventory', label: 'Inventory', shortLabel: 'Stock', icon: Package, action: 'MANAGE_PRODUCTS' as const, badge: lowStockCount > 0 ? `${lowStockCount}` : null, badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
    { id: 'accounts', label: userRole === 'BRANCH_MANAGER' ? 'Additional Discount Approval' : 'Accounts Payment Confirmation', shortLabel: userRole === 'BRANCH_MANAGER' ? 'Approvals' : 'Accounts', icon: userRole === 'BRANCH_MANAGER' ? Percent : CreditCard, action: userRole === 'BRANCH_MANAGER' ? 'APPROVE_BRANCH_MANAGER_DISCOUNT' as const : 'CONFIRM_PAYMENTS' as const, badge: unpaidInvoiceCount > 0 && userRole !== 'BRANCH_MANAGER' ? `${unpaidInvoiceCount}` : null, badgeColor: userRole === 'BRANCH_MANAGER' ? 'bg-violet-500/20 text-violet-300 border-violet-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
    { id: userRole === 'WAREHOUSE' ? 'accounts' : 'warehouse', label: userRole === 'WAREHOUSE' ? 'Warehouse Loading & Delivery' : 'Warehouse & Logistics', shortLabel: 'Dispatch', icon: Truck, action: 'MANAGE_WAREHOUSE' as const, badge: pendingDispatchCount > 0 ? `${pendingDispatchCount}` : null, badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
    { id: 'promos', label: 'Promos & Offers', shortLabel: 'Promos', icon: Tag, action: 'MANAGE_PROMOS' as const, badge: activePromoCount > 0 ? `${activePromoCount}` : null, badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
    { id: 'invoices', label: 'Invoices & AR', shortLabel: 'Bills', icon: Receipt, action: 'CREATE_POS_BILL' as const, badge: unpaidInvoiceCount > 0 ? `${unpaidInvoiceCount}` : null, badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
    { id: 'eway', label: 'e-Way & e-Invoicing', shortLabel: 'e-Way', icon: ShieldCheck, action: 'MANAGE_EWAY_INVOICE' as const, badge: null },
    { id: 'tally', label: 'Tally ERP Bridge', shortLabel: 'Tally', icon: FileSpreadsheet, action: 'EXPORT_TALLY' as const, badge: null },
    { id: 'reports', label: 'Financial Reports', shortLabel: 'Reports', icon: BarChart3, action: 'VIEW_FINANCIAL_REPORTS' as const, badge: null },
    { id: 'users', label: 'User Control', shortLabel: 'Users', icon: Users, action: 'MANAGE_USERS' as const, badge: null },
    { id: 'audit', label: 'System Audit Logs', shortLabel: 'Audit', icon: ShieldAlert, action: 'VIEW_AUDIT_LOGS' as const, badge: null }
  ];

  const visibleItems = navItems.filter((item) => canPerformAction(userRole, item.action));

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('bizflow_nav_collapsed', String(next));
      return next;
    });
  };

  const roleDescription = {
    ADMIN: 'Full system control, billing, inventory, reports and user permissions.',
    MANAGER: 'POS sales, inventory, promotions, financial review and operations.',
    BRANCH_MANAGER: 'Branch billing, inventory, promotions and additional discount approval.',
    CASHIER: 'Billing POS, product lookup and receipt issuing.',
    ACCOUNTANT: 'Financial reports, payment confirmation, expenses, Tally bridge, e-Way and audit review.',
    WAREHOUSE: 'Dispatch, payment-released invoices, loading verification and delivery confirmation.'
  }[userRole];

  return (
    <>
      <aside className={`hidden md:flex flex-col bg-slate-900 border-r border-slate-800 p-3 shrink-0 space-y-4 min-h-[calc(100vh-4rem)] transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-2'} pt-1 pb-2 border-b border-slate-800/80`}>
          {!isCollapsed && <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{userRole} MENU</p>}
          <button onClick={toggleCollapse} className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700/80 transition" title={isCollapsed ? 'Expand Navigation Sidebar' : 'Collapse Navigation Sidebar'}>
            {isCollapsed ? <PanelLeftOpen className="w-4 h-4 text-indigo-400" /> : <PanelLeftClose className="w-4 h-4 text-slate-400" />}
          </button>
        </div>

        <div className="flex-1 px-1">
          <nav className="space-y-1.5">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button key={item.label} onClick={() => setActiveTab(item.id)} title={item.label} className={`w-full flex items-center ${isCollapsed ? 'justify-center py-3 px-2' : 'justify-between px-3 py-2.5'} rounded-xl font-medium text-xs transition group ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-semibold' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
                  <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} min-w-0`}>
                    <div className="relative shrink-0">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400'}`} />
                      {isCollapsed && item.badge && <span className="absolute -top-1.5 -right-2 px-1 min-w-[14px] text-[9px] font-extrabold rounded-full bg-rose-500 text-white flex items-center justify-center">{item.badge}</span>}
                    </div>
                    {!isCollapsed && <span className="truncate font-medium">{item.label}</span>}
                  </div>
                  {!isCollapsed && item.badge && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'}`}>{item.badge}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {!isCollapsed && (
          <div className="mt-auto p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-xs text-slate-300">
            <div className="flex items-center justify-between mb-1"><span className="font-semibold text-white">Access Level</span><span className="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">{userRole}</span></div>
            <p className="text-[11px] text-slate-400 leading-relaxed">{roleDescription}</p>
          </div>
        )}
      </aside>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-1 py-1.5 flex justify-around items-center shadow-2xl overflow-x-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return <button key={item.label} onClick={() => setActiveTab(item.id)} title={item.label} className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition relative shrink-0 ${isActive ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'}`}><div className="relative"><Icon className="w-4 h-4" />{item.badge && <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-rose-500" />}</div><span className="text-[9px] mt-0.5 tracking-tight">{item.shortLabel}</span></button>;
        })}
      </nav>
    </>
  );
};
