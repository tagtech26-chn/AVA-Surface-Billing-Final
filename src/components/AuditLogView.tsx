import React, { useState, useMemo } from 'react';
import { AuditLog, AuditCategory, AuditSeverity, UserRole } from '../types';
import { formatDateTime } from '../lib/utils';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  Download,
  Trash2,
  Tag,
  DollarSign,
  UserCheck,
  Receipt,
  Package,
  Settings,
  AlertTriangle,
  Info,
  Clock,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  X,
  User
} from 'lucide-react';

interface AuditLogViewProps {
  auditLogs: AuditLog[];
  onClearLogs?: () => void;
  userRole: UserRole;
  currencySymbol: string;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({
  auditLogs,
  onClearLogs,
  userRole,
  currencySymbol
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('ALL'); // 'ALL' | 'TODAY' | 'WEEK' | 'MONTH'
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Trigger brief floating toast notification
  const notify = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Helper for relative time string
  const getRelativeTime = (isoString: string): string => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  // Filtered Audit Logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      // Search term matching
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        log.action.toLowerCase().includes(term) ||
        log.performedBy.toLowerCase().includes(term) ||
        (log.targetName && log.targetName.toLowerCase().includes(term)) ||
        log.details.toLowerCase().includes(term) ||
        (log.ipAddress && log.ipAddress.includes(term));

      // Category filter
      const matchesCategory =
        selectedCategory === 'ALL' || log.category === selectedCategory;

      // Severity filter
      const matchesSeverity =
        selectedSeverity === 'ALL' || log.severity === selectedSeverity;

      // Date filter
      let matchesDate = true;
      if (dateFilter !== 'ALL') {
        const logTime = new Date(log.timestamp).getTime();
        const now = Date.now();
        if (dateFilter === 'TODAY') {
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);
          matchesDate = logTime >= startOfToday.getTime();
        } else if (dateFilter === 'WEEK') {
          matchesDate = logTime >= now - 7 * 24 * 60 * 60 * 1000;
        } else if (dateFilter === 'MONTH') {
          matchesDate = logTime >= now - 30 * 24 * 60 * 60 * 1000;
        }
      }

      return matchesSearch && matchesCategory && matchesSeverity && matchesDate;
    });
  }, [auditLogs, searchTerm, selectedCategory, selectedSeverity, dateFilter]);

  // Statistics
  const totalCount = auditLogs.length;
  const criticalCount = auditLogs.filter(
    (l) => l.severity === 'CRITICAL' || l.severity === 'HIGH'
  ).length;
  const priceEditsCount = auditLogs.filter(
    (l) => l.category === 'PRODUCT' || l.action.toLowerCase().includes('price')
  ).length;
  const userRoleEditsCount = auditLogs.filter(
    (l) => l.category === 'USER' || l.action.toLowerCase().includes('user') || l.action.toLowerCase().includes('role')
  ).length;

  // Export to CSV Function
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      notify('No audit log entries available to export.');
      return;
    }

    const headers = [
      'Log ID',
      'Timestamp',
      'Category',
      'Severity',
      'Action',
      'Performed By',
      'User Role',
      'Target Object',
      'Details',
      'Previous Value',
      'New Value',
      'IP Address'
    ];

    const rows = filteredLogs.map((l) => [
      `"${l.id}"`,
      `"${formatDateTime(l.timestamp)}"`,
      `"${l.category}"`,
      `"${l.severity}"`,
      `"${l.action.replace(/"/g, '""')}"`,
      `"${l.performedBy.replace(/"/g, '""')}"`,
      `"${l.performedByRole}"`,
      `"${(l.targetName || l.targetId || '').replace(/"/g, '""')}"`,
      `"${l.details.replace(/"/g, '""')}"`,
      `"${(l.previousValue || '').replace(/"/g, '""')}"`,
      `"${(l.newValue || '').replace(/"/g, '""')}"`,
      `"${l.ipAddress || ''}"`
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `System_Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    notify('Audit log CSV exported successfully!');
  };

  // Get icon for category
  const getCategoryIcon = (category: AuditCategory) => {
    switch (category) {
      case 'PRODUCT':
        return <DollarSign className="w-4 h-4 text-emerald-400" />;
      case 'INVOICE':
        return <Receipt className="w-4 h-4 text-indigo-400" />;
      case 'USER':
        return <UserCheck className="w-4 h-4 text-purple-400" />;
      case 'PROMO':
        return <Tag className="w-4 h-4 text-amber-400" />;
      case 'STOCK':
        return <Package className="w-4 h-4 text-blue-400" />;
      case 'SYSTEM':
        return <Settings className="w-4 h-4 text-rose-400" />;
      default:
        return <Info className="w-4 h-4 text-slate-400" />;
    }
  };

  // Get color for severity badge
  const getSeverityBadge = (severity: AuditSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center space-x-1 animate-pulse">
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            <span>CRITICAL</span>
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center space-x-1">
            <ShieldAlert className="w-3 h-3 text-amber-400" />
            <span>HIGH</span>
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center space-x-1">
            <Info className="w-3 h-3 text-blue-400" />
            <span>MEDIUM</span>
          </span>
        );
      case 'LOW':
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-slate-800 text-slate-300 border border-slate-700">
            LOW
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert Banner */}
      {toastMsg && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white font-bold text-xs px-4 py-2.5 rounded-2xl shadow-2xl border border-emerald-400 flex items-center space-x-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-white" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                System Audit Trail & Security Logs
              </h1>
              <p className="text-xs text-slate-400">
                Track critical administrative events, product price modifications, invoice deletions & staff permission edits.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center space-x-2 transition"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV Report</span>
          </button>

          {userRole === 'ADMIN' && onClearLogs && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 hover:border-rose-500/40 flex items-center space-x-1.5 transition"
              title="Clear all system audit logs"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Purge Logs</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Metrics Board */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Total Logged Events</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-black text-white">{totalCount}</p>
          <p className="text-[10px] text-slate-500">Recorded action trail</p>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Critical & High Severity</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-black text-rose-400">{criticalCount}</p>
          <p className="text-[10px] text-slate-500">Security & high risk actions</p>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Product & Price Edits</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400">{priceEditsCount}</p>
          <p className="text-[10px] text-slate-500">Price overrides & updates</p>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>User Role & Access Edits</span>
            <UserCheck className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-black text-purple-400">{userRoleEditsCount}</p>
          <p className="text-[10px] text-slate-500">Permission modifications</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search audit actions, user name, target SKU, invoice number or details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 text-white text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-indigo-500 transition placeholder:text-slate-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-950 text-slate-200 text-xs px-3 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-indigo-500 font-medium"
            >
              <option value="ALL">All Categories</option>
              <option value="PRODUCT">Product & Price</option>
              <option value="INVOICE">Invoices & Refunds</option>
              <option value="USER">User & Permissions</option>
              <option value="PROMO">Promos & Discounts</option>
              <option value="STOCK">Stock Adjustments</option>
              <option value="SYSTEM">System & Settings</option>
            </select>

            {/* Severity Filter */}
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="bg-slate-950 text-slate-200 text-xs px-3 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-indigo-500 font-medium"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical Only</option>
              <option value="HIGH">High Severity</option>
              <option value="MEDIUM">Medium Severity</option>
              <option value="LOW">Low Severity</option>
            </select>

            {/* Date Preset Filter */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-slate-950 text-slate-200 text-xs px-3 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-indigo-500 font-medium"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today Only</option>
              <option value="WEEK">Last 7 Days</option>
              <option value="MONTH">Last 30 Days</option>
            </select>
          </div>
        </div>

        {/* Category Pills Quick Toggle */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/80">
          <span className="text-[11px] font-bold text-slate-500 mr-2 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Quick Filter:
          </span>

          {[
            { id: 'ALL', label: 'All Logs' },
            { id: 'PRODUCT', label: 'Price & Products' },
            { id: 'INVOICE', label: 'Invoices & Refunds' },
            { id: 'USER', label: 'User Roles' },
            { id: 'PROMO', label: 'Promos' },
            { id: 'STOCK', label: 'Stock Logs' },
            { id: 'SYSTEM', label: 'System' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                selectedCategory === cat.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Log Table / Timeline List */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-sm text-white flex items-center space-x-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span>Audit History Records ({filteredLogs.length})</span>
          </h3>

          <span className="text-xs text-slate-500 font-mono">
            Showing {filteredLogs.length} of {auditLogs.length} events
          </span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-3">
            <ShieldCheck className="w-12 h-12 mx-auto text-slate-700" />
            <p className="text-sm font-bold text-slate-300">No Audit Logs Match Your Filters</p>
            <p className="text-xs text-slate-500">
              Try adjusting your search query, severity level, or category filter above.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 hover:bg-slate-800/50 transition space-y-2.5"
              >
                {/* Top Row: Timestamp, Severity, Category, Performer */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2.5">
                    {/* Category Icon Badge */}
                    <div className="p-2 bg-slate-950 rounded-xl border border-slate-800 shrink-0">
                      {getCategoryIcon(log.category)}
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-sm text-white">{log.action}</span>
                        {getSeverityBadge(log.severity)}
                      </div>
                      <p className="text-[11px] text-slate-400 flex items-center space-x-2 mt-0.5">
                        <span className="font-medium text-slate-300">Target:</span>
                        <span className="text-indigo-300 font-semibold">{log.targetName || log.targetId || 'N/A'}</span>
                      </p>
                    </div>
                  </div>

                  {/* Performer & Relative Time */}
                  <div className="flex items-center space-x-3 text-right">
                    <div className="text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-bold text-white">{log.performedBy}</span>
                        <span className="text-[9px] uppercase font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                          {log.performedByRole}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center justify-end space-x-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{formatDateTime(log.timestamp)}</span>
                        <span className="text-slate-600">({getRelativeTime(log.timestamp)})</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Details & Value Diff Container */}
                <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800/80 space-y-2">
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    {log.details}
                  </p>

                  {/* Previous vs New Value Diff Comparison */}
                  {(log.previousValue || log.newValue) && (
                    <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-slate-800/60 text-xs">
                      {log.previousValue && (
                        <div className="flex items-center space-x-1 bg-rose-950/40 text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded-lg">
                          <span className="text-[10px] uppercase font-bold text-rose-400 mr-1">Previous:</span>
                          <span className="font-mono text-xs font-semibold line-through decoration-rose-500/60">{log.previousValue}</span>
                        </div>
                      )}

                      {log.previousValue && log.newValue && (
                        <span className="text-slate-500 font-bold">→</span>
                      )}

                      {log.newValue && (
                        <div className="flex items-center space-x-1 bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                          <span className="text-[10px] uppercase font-bold text-emerald-400 mr-1">Updated To:</span>
                          <span className="font-mono text-xs font-bold">{log.newValue}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* IP Address footer stamp */}
                  {log.ipAddress && (
                    <div className="text-[10px] text-slate-500 font-mono flex items-center justify-end space-x-1 pt-1">
                      <span>Machine IP:</span>
                      <span className="text-slate-400">{log.ipAddress}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clear Logs Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400">
              <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-black text-lg text-white">Purge System Audit Trail?</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete all recorded audit logs? This action is irreversible and clears security event tracking history.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  if (onClearLogs) onClearLogs();
                  setShowClearConfirm(false);
                  notify('System audit logs purged.');
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/30"
              >
                Yes, Purge Audit History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
