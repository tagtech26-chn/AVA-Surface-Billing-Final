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
  Lock,
  Truck,
  FileSpreadsheet,
  ShieldCheck,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen
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
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('bizflow_nav_collapsed') === 'true';
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('bizflow_nav_collapsed', String(next));
      return next;
    });
  };

  const navItems = [
    {
      id: 'pos',
      label: 'POS & Billing',
      shortLabel: 'POS',
      icon: ShoppingCart,
      action: 'CREATE_POS_BILL' as const,
      badge: null
    },
    {
      id: 'inventory',
      label: 'Inventory',
      shortLabel: 'Stock',
      icon: Package,
      action: 'MANAGE_PRODUCTS' as const,
      badge: lowStockCount > 0 ? `${lowStockCount}` : null,
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
    },
    {
      id: 'warehouse',
      label: 'Warehouse & Logistics',
      shortLabel: 'Dispatch',
      icon: Truck,
      action: 'MANAGE_WAREHOUSE' as const,
      badge: pendingDispatchCount > 0 ? `${pendingDispatchCount}` : null,
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40'
    },
    {
      id: 'promos',
      label: 'Promos & Offers',
      shortLabel: 'Promos',
      icon: Tag,
      action: 'MANAGE_PROMOS' as const,
      badge: activePromoCount > 0 ? `${activePromoCount}` : null,
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
    },
    {
      id: 'invoices',
      label: 'Invoices & AR',
      shortLabel: 'Bills',
      icon: Receipt,
      action: 'CREATE_POS_BILL' as const,
      badge: unpaidInvoiceCount > 0 ? `${unpaidInvoiceCount}` : null,
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40'
    },
    {
      id: 'eway',
      label: 'e-Way & e-Invoicing',
      shortLabel: 'e-Way',
      icon: ShieldCheck,
      action: 'MANAGE_EWAY_INVOICE' as const,
      badge: null
    },
    {
      id: 'tally',
      label: 'Tally ERP Bridge',
      shortLabel: 'Tally',
      icon: FileSpreadsheet,
      action: 'EXPORT_TALLY' as const,
      badge: null
    },
    {
      id: 'reports',
      label: 'Financial Reports',
      shortLabel: 'Reports',
      icon: BarChart3,
      action: 'VIEW_FINANCIAL_REPORTS' as const,
      badge: null
    },
    {
      id: 'users',
      label: 'User Control',
      shortLabel: 'Users',
      icon: Users,
      action: 'MANAGE_USERS' as const,
      badge: null
    },
    {
      id: 'audit',
      label: 'System Audit Logs',
      shortLabel: 'Audit',
      icon: ShieldAlert,
      action: 'VIEW_AUDIT_LOGS' as const,
      badge: null
    }
  ];

  return (
    <>
      {/* Desktop Navigation Sidebar (Left Column - Collapsible) */}
      <aside
        className={`hidden md:flex flex-col bg-slate-900 border-r border-slate-800 p-3 shrink-0 space-y-4 min-h-[calc(100vh-4rem)] transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Toggle Collapse Bar */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-2'} pt-1 pb-2 border-b border-slate-800/80`}>
          {!isCollapsed && (
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Navigation Menu
            </p>
          )}

          <button
            onClick={toggleCollapse}
            className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700/80 transition flex items-center justify-center shadow-md group"
            title={isCollapsed ? 'Expand Navigation Sidebar' : 'Collapse Navigation Sidebar'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
            ) : (
              <PanelLeftClose className="w-4 h-4 text-slate-400 group-hover:text-indigo-400 group-hover:scale-110 transition-transform" />
            )}
          </button>
        </div>

        {/* Navigation Items List */}
        <div className="flex-1 px-1">
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const hasPermission = canPerformAction(userRole, item.action);
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  title={`${item.label}${!hasPermission ? ' (Restricted)' : ''}`}
                  className={`w-full flex items-center ${
                    isCollapsed ? 'justify-center py-3 px-2' : 'justify-between px-3 py-2.5'
                  } rounded-xl font-medium text-xs transition group relative ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} min-w-0`}>
                    <div className="relative shrink-0">
                      <Icon className={`w-4 h-4 transition ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400'}`} />
                      
                      {/* Badge dot overlay when collapsed */}
                      {isCollapsed && item.badge && (
                        <span className="absolute -top-1.5 -right-2 px-1 py-0.2 min-w-[14px] text-[9px] font-extrabold rounded-full bg-rose-500 text-white shadow-sm flex items-center justify-center">
                          {item.badge}
                        </span>
                      )}
                    </div>

                    {!isCollapsed && (
                      <span className="truncate font-medium">{item.label}</span>
                    )}
                  </div>

                  {!isCollapsed && (
                    <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                      {item.badge && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.badgeColor || 'bg-slate-800 text-slate-300 border-slate-700'}`}>
                          {item.badge}
                        </span>
                      )}
                      {!hasPermission && (
                        <Lock className="w-3.5 h-3.5 text-slate-500" title="Restricted by User Role" />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Current Active Role Capabilities Summary */}
        {!isCollapsed ? (
          <div className="mt-auto p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-xs text-slate-300">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-white">Active Access Level</span>
              <span className="text-[10px] uppercase font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                {userRole}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {userRole === 'ADMIN' && 'Full system control, financial statements, inventory & user permissions.'}
              {userRole === 'MANAGER' && 'POS sales, inventory adjustment, promo creation & financial review.'}
              {userRole === 'CASHIER' && 'Billing POS terminal, product lookups & receipt issuing.'}
              {userRole === 'ACCOUNTANT' && 'Full financial reports, Tally XML/JSON bridge, expenses ledger & tax overview.'}
              {userRole === 'WAREHOUSE' && 'Order dispatch tracking, packing slip printing & stock updates.'}
            </p>
          </div>
        ) : (
          <div className="mt-auto pt-2 flex flex-col items-center">
            <div
              className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-indigo-400 font-extrabold text-[10px] uppercase shadow"
              title={`Active Role: ${userRole}`}
            >
              {userRole.substring(0, 3)}
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-1 py-1.5 flex justify-around items-center shadow-2xl overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition relative shrink-0 ${
                isActive ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className="w-4 h-4" />
                {item.badge && (
                  <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-rose-500" />
                )}
              </div>
              <span className="text-[9px] mt-0.5 tracking-tight">{item.shortLabel || item.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};

