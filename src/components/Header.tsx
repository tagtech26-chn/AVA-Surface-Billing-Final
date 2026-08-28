import React, { useState } from 'react';
import { UserProfile, BusinessStoreDetails, Product } from '../types';
import { Store, User, RefreshCw, Smartphone, Bell, AlertTriangle, ArrowRight, Package } from 'lucide-react';
import { AvaSurfacesLogo } from './AvaSurfacesLogo';

interface HeaderProps {
  storeDetails: BusinessStoreDetails;
  activeUser: UserProfile;
  onOpenUserControl: () => void;
  onResetSeedData: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  lowStockProducts?: Product[];
}

export const Header: React.FC<HeaderProps> = ({
  storeDetails,
  activeUser,
  onOpenUserControl,
  onResetSeedData,
  setActiveTab,
  lowStockProducts = []
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const lowStockCount = lowStockProducts.length;

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200';
      case 'MANAGER':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200';
      case 'ACCOUNTANT':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200';
      case 'CASHIER':
      default:
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200';
    }
  };

  return (
    <header className="bg-slate-950 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-[76px] flex items-center justify-between gap-6">
        <div className="flex items-center min-w-0 cursor-pointer" onClick={() => setActiveTab('pos')}>
          <div className="shrink-0 pr-5 border-r border-slate-700">
            <AvaSurfacesLogo />
          </div>
          <div className="pl-5 min-w-0">
            <div className="font-serif font-bold text-2xl sm:text-3xl tracking-tight text-white leading-none">Vero</div>
            <div className="font-serif italic text-sm sm:text-base text-amber-400 mt-1 whitespace-nowrap">Where every surface tells a story</div>
          </div>
          <div className="hidden xl:block h-12 border-r border-slate-700 mx-7" />
          <div className="hidden xl:block font-serif font-bold text-2xl text-white whitespace-nowrap">Vero Billing System</div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1 bg-slate-900 rounded-lg border border-slate-700 text-xs text-slate-300">
            <Smartphone className="w-3.5 h-3.5 text-amber-400" />
            <span>Mobile Ready POS</span>
          </div>

          <div className="relative">
            <button onClick={() => setShowNotifications(!showNotifications)} className="p-2 text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition border border-slate-700 relative flex items-center justify-center" title="Low Stock Notifications">
              <Bell className="w-4 h-4" />
              {lowStockCount > 0 && <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-rose-500 text-white font-black text-[10px] rounded-full min-w-[18px] text-center shadow-md">{lowStockCount}</span>}
            </button>
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl z-50 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center space-x-2 text-rose-400"><AlertTriangle className="w-4 h-4" /><span className="font-bold text-xs text-white">Reorder Level Alerts</span></div>
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">{lowStockCount} Items Low</span>
                </div>
                {lowStockCount === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">All products are well stocked above reorder levels!</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">{lowStockProducts.map((p) => (
                    <div key={p.id} className="p-2.5 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
                      <div><p className="font-bold text-slate-200 truncate max-w-[180px] sm:max-w-[220px]">{p.name}</p><p className="text-[10px] text-slate-500 font-mono">SKU: {p.sku}</p></div>
                      <div className="text-right"><span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 font-bold text-[10px] rounded-full border border-rose-500/30">{p.stock} left (Reorder: {p.reorderLevel})</span></div>
                    </div>
                  ))}</div>
                )}
                <button onClick={() => { setShowNotifications(false); setActiveTab('inventory'); }} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition">
                  <Package className="w-3.5 h-3.5" /><span>Manage Stock in Inventory</span><ArrowRight className="w-3 h-3 ml-1" />
                </button>
              </div>
            )}
          </div>

          <button onClick={onResetSeedData} title="Reset to Demo Seed Data" className="p-2 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition border border-slate-700 flex items-center gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" /><span className="hidden md:inline">Reset Demo</span>
          </button>

          <button onClick={onOpenUserControl} className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 transition-colors px-3 py-1.5 rounded-xl border border-slate-700 group text-left">
            <div className="relative"><img src={activeUser.avatar} alt={activeUser.name} className="w-8 h-8 rounded-lg object-cover ring-2 ring-amber-500/30 group-hover:ring-amber-400 transition" /><span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900" /></div>
            <div className="hidden sm:block"><div className="flex items-center space-x-1.5"><span className="text-xs font-semibold text-slate-200 group-hover:text-white transition">{activeUser.name}</span><span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getRoleBadgeColor(activeUser.role)}`}>{activeUser.role}</span></div><p className="text-[10px] text-slate-400">Click to switch role / PIN</p></div>
            <User className="w-4 h-4 text-slate-400 group-hover:text-amber-400 transition sm:hidden" />
          </button>
        </div>
      </div>
    </header>
  );
};
