import React, { useState, useMemo } from 'react';
import { Invoice, InvoiceStatus, PaymentMethod } from '../types';
import { formatCurrency, formatDateTime } from '../lib/utils';
import {
  Receipt,
  Search,
  CheckCircle2,
  Clock,
  RotateCcw,
  Printer,
  DollarSign,
  User,
  AlertCircle,
  X,
  Calendar,
  ChevronDown,
  ChevronUp,
  Award,
  Boxes,
  Weight,
  Phone,
  Tag,
  Filter
} from 'lucide-react';

interface InvoicesViewProps {
  invoices: Invoice[];
  onRecordPayment: (invoiceId: string, paymentAmount: number, method: PaymentMethod, notes?: string) => void;
  onProcessRefund: (invoiceId: string, restockItems: boolean) => void;
  onSelectInvoiceToPrint: (invoice: Invoice) => void;
  currencySymbol: string;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  invoices,
  onRecordPayment,
  onProcessRefund,
  onSelectInvoiceToPrint,
  currencySymbol
}) => {
  const [activeViewMode, setActiveViewMode] = useState<'ALL' | 'TODAY'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedSalesperson, setSelectedSalesperson] = useState<string>('ALL');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  // Record Payment Modal State
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [payAmountInput, setPayAmountInput] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('CASH');
  const [payNotes, setPayNotes] = useState('');

  // Refund Modal State
  const [refundingInvoice, setRefundingInvoice] = useState<Invoice | null>(null);
  const [restockToggle, setRestockToggle] = useState(true);

  // Today's Date String Comparison Helper
  const isTodayDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  // Get list of unique salespersons across invoices
  const salespersonsList = useMemo(() => {
    const set = new Set<string>();
    invoices.forEach((inv) => {
      if (inv.cashierName) set.add(inv.cashierName);
    });
    return Array.from(set);
  }, [invoices]);

  // Today's Invoices subset
  const todaysInvoices = useMemo(() => {
    return invoices.filter((inv) => isTodayDate(inv.date));
  }, [invoices]);

  // Today's Salesperson Performance Breakdown
  const salespersonPerformance = useMemo(() => {
    const map: Record<string, { totalSales: number; billCount: number; weightKg: number; invoices: Invoice[] }> = {};

    todaysInvoices.forEach((inv) => {
      const sp = inv.cashierName || 'Unassigned';
      if (!map[sp]) {
        map[sp] = { totalSales: 0, billCount: 0, weightKg: 0, invoices: [] };
      }
      map[sp].totalSales += inv.grandTotal;
      map[sp].billCount += 1;
      map[sp].invoices.push(inv);

      // calculate weight
      const weight = inv.items.reduce((w, item) => {
        return w + (item.itemWeightKg || (item.quantity * (item.product.weightPerBoxKg || 25)));
      }, 0);
      map[sp].weightKg += weight;
    });

    return Object.entries(map).map(([name, data]) => ({
      name,
      ...data
    })).sort((a, b) => b.totalSales - a.totalSales);
  }, [todaysInvoices]);

  // Filter Invoices (Search across Invoice #, Customer Name, Customer Phone, GST, Cashier, Item Name, Item Code/SKU/Barcode)
  const filteredInvoices = useMemo(() => {
    let list = activeViewMode === 'TODAY' ? todaysInvoices : invoices;

    if (selectedSalesperson !== 'ALL') {
      list = list.filter((inv) => inv.cashierName === selectedSalesperson);
    }

    if (statusFilter !== 'ALL') {
      list = list.filter((inv) => inv.status === statusFilter);
    }

    if (!searchTerm.trim()) return list;

    const searchLower = searchTerm.trim().toLowerCase();

    return list.filter((inv) => {
      // 1. Invoice Number
      const matchInvNum = inv.invoiceNumber.toLowerCase().includes(searchLower);

      // 2. Customer Name / GST Names
      const matchCustomerName =
        (inv.customer?.name || '').toLowerCase().includes(searchLower) ||
        (inv.customer?.gstTradeName || '').toLowerCase().includes(searchLower) ||
        (inv.customer?.gstLegalName || '').toLowerCase().includes(searchLower);

      // 3. Customer Mobile Phone
      const matchCustomerPhone = (inv.customer?.phone || '').toLowerCase().includes(searchLower);

      // 4. Salesperson / Cashier Name
      const matchSalesperson = inv.cashierName.toLowerCase().includes(searchLower);

      // 5. Item Name or Item Code / SKU / Barcode
      const matchItem = inv.items.some((item) => {
        const prod = item.product;
        return (
          prod.name.toLowerCase().includes(searchLower) ||
          prod.sku.toLowerCase().includes(searchLower) ||
          prod.barcode.toLowerCase().includes(searchLower) ||
          prod.id.toLowerCase().includes(searchLower) ||
          (prod.tileDimensions && prod.tileDimensions.toLowerCase().includes(searchLower)) ||
          (prod.category && prod.category.toLowerCase().includes(searchLower))
        );
      });

      return matchInvNum || matchCustomerName || matchCustomerPhone || matchSalesperson || matchItem;
    });
  }, [invoices, todaysInvoices, activeViewMode, selectedSalesperson, statusFilter, searchTerm]);

  // Today's KPI Metrics
  const todayTotalRevenue = useMemo(() => {
    return todaysInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
  }, [todaysInvoices]);

  const todayTotalWeightKg = useMemo(() => {
    return todaysInvoices.reduce((sum, inv) => {
      return sum + inv.items.reduce((w, item) => w + (item.itemWeightKg || (item.quantity * (item.product.weightPerBoxKg || 25))), 0);
    }, 0);
  }, [todaysInvoices]);

  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingInvoice || payAmountInput <= 0) return;

    onRecordPayment(payingInvoice.id, payAmountInput, payMethod, payNotes);
    setPayingInvoice(null);
    setPayNotes('');
  };

  const handleRefundSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundingInvoice) return;

    onProcessRefund(refundingInvoice.id, restockToggle);
    setRefundingInvoice(null);
  };

  const getStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Paid</span>
          </span>
        );
      case 'PARTIAL':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase bg-amber-500/10 text-amber-300 border border-amber-500/30">
            <Clock className="w-3 h-3 text-amber-400" />
            <span>Partial</span>
          </span>
        );
      case 'UNPAID':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase bg-rose-500/10 text-rose-300 border border-rose-500/30">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            <span>Unpaid / AR</span>
          </span>
        );
      case 'REFUNDED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase bg-slate-800 text-slate-400 border border-slate-700">
            <RotateCcw className="w-3 h-3 text-slate-400" />
            <span>Refunded</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Primary View Toggle Header */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center space-x-2">
            <Receipt className="w-6 h-6 text-indigo-400" />
            <span>Invoices &amp; Bill Search Engine</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Search historical bills by customer name, invoice #, phone number, item name, or product code.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex bg-slate-800/90 p-1 rounded-2xl border border-slate-700 w-full md:w-auto">
          <button
            onClick={() => {
              setActiveViewMode('ALL');
              setSelectedSalesperson('ALL');
            }}
            className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 ${
              activeViewMode === 'ALL'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>All Historical Invoices ({invoices.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveViewMode('TODAY');
            }}
            className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 ${
              activeViewMode === 'TODAY'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4 text-emerald-300" />
            <span>Today's Invoices ({todaysInvoices.length})</span>
          </button>
        </div>
      </div>

      {/* TODAY'S INVOICE DASHBOARD & SALESPERSON BREAKDOWN SECTION */}
      {activeViewMode === 'TODAY' && (
        <div className="space-y-4">
          {/* Today's KPI Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/80 to-slate-900 border border-indigo-500/40 shadow-lg flex items-center space-x-4">
              <div className="p-3 bg-indigo-600/30 rounded-2xl text-indigo-400 border border-indigo-500/30">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Today's Total Sales</p>
                <h3 className="text-xl font-extrabold text-white mt-0.5">
                  {formatCurrency(todayTotalRevenue, currencySymbol)}
                </h3>
                <p className="text-[10px] text-emerald-400 font-medium">Recorded across {todaysInvoices.length} bills</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/80 to-slate-900 border border-emerald-500/40 shadow-lg flex items-center space-x-4">
              <div className="p-3 bg-emerald-600/30 rounded-2xl text-emerald-400 border border-emerald-500/30">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Today's Bills Count</p>
                <h3 className="text-xl font-extrabold text-white mt-0.5">
                  {todaysInvoices.length} Invoices
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">Generated today</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/80 to-slate-900 border border-amber-500/40 shadow-lg flex items-center space-x-4">
              <div className="p-3 bg-amber-600/30 rounded-2xl text-amber-400 border border-amber-500/30">
                <Weight className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Today's Dispatch Weight</p>
                <h3 className="text-xl font-extrabold text-white mt-0.5">
                  {todayTotalWeightKg.toFixed(1)} kg
                </h3>
                <p className="text-[10px] text-amber-300 font-mono">
                  {(todayTotalWeightKg / 1000).toFixed(2)} Metric Tons
                </p>
              </div>
            </div>
          </div>

          {/* Salesperson Performance Breakdown */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Award className="w-4 h-4 text-amber-400" />
                <span>Today's Salesperson Performance &amp; Bill Breakdown</span>
              </h3>
              <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700">
                {salespersonPerformance.length} Active Staff Today
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {salespersonPerformance.length === 0 ? (
                <div className="col-span-full py-4 text-center text-xs text-slate-500">
                  No bills created yet today.
                </div>
              ) : (
                salespersonPerformance.map((sp) => {
                  const isSelected = selectedSalesperson === sp.name;
                  return (
                    <div
                      key={sp.name}
                      onClick={() => setSelectedSalesperson(isSelected ? 'ALL' : sp.name)}
                      className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-indigo-950/80 border-indigo-500 text-white shadow-lg'
                          : 'bg-slate-800/80 border-slate-700/80 text-slate-200 hover:border-slate-600'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <User className="w-4 h-4 text-indigo-400 shrink-0" />
                          <span className="font-extrabold text-xs text-white truncate">{sp.name}</span>
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {sp.billCount} {sp.billCount === 1 ? 'Bill' : 'Bills'} Issued Today
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-emerald-400 block">
                          {formatCurrency(sp.totalSales, currencySymbol)}
                        </span>
                        <span className="text-[9px] text-amber-300 font-mono">
                          {sp.weightKg.toFixed(0)} kg
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Bill Search & Filter Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 shadow-md">
        {/* Universal Search Input */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-indigo-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search customer name, phone, inv #, item name or code..."
            className="w-full pl-10 pr-8 py-2 bg-slate-800 border border-slate-700/80 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Salesperson Filter & Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Salesperson Selector */}
          <div className="flex items-center space-x-1.5 bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-700 text-xs">
            <User className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <select
              value={selectedSalesperson}
              onChange={(e) => setSelectedSalesperson(e.target.value)}
              className="bg-transparent text-slate-200 font-semibold focus:outline-none cursor-pointer text-xs"
            >
              <option value="ALL" className="bg-slate-900 text-slate-400">All Salespersons</option>
              {salespersonsList.map((sp) => (
                <option key={sp} value={sp} className="bg-slate-900 text-white">{sp}</option>
              ))}
            </select>
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center space-x-1 overflow-x-auto">
            {['ALL', 'PAID', 'UNPAID', 'PARTIAL', 'REFUNDED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {st === 'ALL' ? 'All Status' : st === 'UNPAID' ? 'Unpaid AR' : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Invoices List Table with Expandable Bill Item Details & Clear Salesperson Name */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="p-4">Invoice # &amp; Date</th>
                <th className="p-4">Salesperson Name</th>
                <th className="p-4">Customer Details</th>
                <th className="p-4">Items / Products</th>
                <th className="p-4">Status</th>
                <th className="p-4">Total Amount</th>
                <th className="p-4">Paid / Due</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <Receipt className="w-10 h-10 mx-auto opacity-30 text-indigo-400 mb-2" />
                    <p className="text-sm font-bold text-slate-400">No matching bills found.</p>
                    <p className="text-xs text-slate-500">Try adjusting your search criteria or filters.</p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const balanceDue = Math.max(0, inv.grandTotal - inv.amountPaid);
                  const isExpanded = expandedInvoiceId === inv.id;

                  // Compute total weight
                  const invWeightKg = inv.items.reduce((acc, i) => {
                    return acc + (i.itemWeightKg || (i.quantity * (i.product.weightPerBoxKg || 25)));
                  }, 0);

                  return (
                    <React.Fragment key={inv.id}>
                      <tr className={`hover:bg-slate-800/40 transition ${isExpanded ? 'bg-slate-850/60' : ''}`}>
                        <td className="p-4">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                              className="text-slate-400 hover:text-white p-0.5 rounded transition"
                              title="Toggle Item Details"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-indigo-400" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            <div>
                              <div className="font-mono font-bold text-slate-100 text-xs">{inv.invoiceNumber}</div>
                              <div className="text-[10px] text-slate-400">{formatDateTime(inv.date)}</div>
                            </div>
                          </div>
                        </td>

                        {/* Salesperson / Cashier Name Highlighted Badge */}
                        <td className="p-4">
                          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-indigo-950/80 border border-indigo-500/30 rounded-xl">
                            <User className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="font-extrabold text-xs text-indigo-200">{inv.cashierName || 'Cashier'}</span>
                          </div>
                        </td>

                        {/* Customer Details with Phone Number & GST */}
                        <td className="p-4">
                          <div className="font-bold text-slate-200 text-xs">
                            {inv.customer?.name || 'Walk-in Retail Customer'}
                          </div>
                          {inv.customer?.phone && (
                            <div className="text-[10px] text-slate-400 flex items-center space-x-1 font-mono">
                              <Phone className="w-3 h-3 text-emerald-400" />
                              <span>{inv.customer.phone}</span>
                            </div>
                          )}
                          {inv.customer?.gstNumber && (
                            <div className="text-[9px] text-emerald-300 font-mono">
                              GST: {inv.customer.gstNumber}
                            </div>
                          )}
                        </td>

                        {/* Items Summary Pill */}
                        <td className="p-4">
                          <div className="text-xs text-slate-300 font-medium truncate max-w-[200px]">
                            {inv.items.map((i) => `${i.quantity}x ${i.product.name}`).join(', ')}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center space-x-2 font-mono">
                            <span>{inv.items.length} line {inv.items.length === 1 ? 'item' : 'items'}</span>
                            <span>•</span>
                            <span className="text-amber-400">{invWeightKg.toFixed(1)} kg</span>
                          </div>
                        </td>

                        <td className="p-4">{getStatusBadge(inv.status)}</td>

                        <td className="p-4 font-extrabold text-white text-sm">
                          {formatCurrency(inv.grandTotal, currencySymbol)}
                        </td>

                        <td className="p-4">
                          <span className={`font-semibold ${balanceDue > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {formatCurrency(inv.amountPaid, currencySymbol)}
                          </span>
                          {balanceDue > 0 && (
                            <div className="text-[10px] text-rose-400 font-bold">
                              Due: {formatCurrency(balanceDue, currencySymbol)}
                            </div>
                          )}
                        </td>

                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {balanceDue > 0 && inv.status !== 'REFUNDED' && (
                              <button
                                onClick={() => {
                                  setPayingInvoice(inv);
                                  setPayAmountInput(balanceDue);
                                }}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold shadow transition"
                                title="Record Payment"
                              >
                                Receive Payment
                              </button>
                            )}

                            <button
                              onClick={() => onSelectInvoiceToPrint(inv)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-semibold transition"
                              title="Print Printable Receipt"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            {inv.status !== 'REFUNDED' && (
                              <button
                                onClick={() => setRefundingInvoice(inv)}
                                className="p-1.5 bg-rose-950/40 hover:bg-rose-900 text-rose-300 rounded-lg text-[11px] font-semibold transition"
                                title="Process Refund"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Line Items Details Drawer */}
                      {isExpanded && (
                        <tr className="bg-slate-950/90 border-b border-slate-800">
                          <td colSpan={8} className="p-4">
                            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 text-xs">
                              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                <span className="font-extrabold text-indigo-400 uppercase tracking-wider flex items-center space-x-2">
                                  <Boxes className="w-4 h-4" />
                                  <span>Bill Line Items &amp; Item Codes ({inv.items.length})</span>
                                </span>
                                <span className="text-slate-400 font-mono">
                                  Payment Mode: <strong className="text-white">{inv.paymentMethod}</strong>
                                </span>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {inv.items.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="p-2.5 bg-slate-800/70 rounded-xl border border-slate-700/60 flex items-center justify-between"
                                  >
                                    <div className="min-w-0 space-y-0.5">
                                      <p className="font-bold text-white truncate">{item.product.name}</p>
                                      <p className="text-[10px] text-indigo-300 font-mono">
                                        SKU/Code: <strong>{item.product.sku}</strong> • Barcode: {item.product.barcode || 'N/A'}
                                      </p>
                                      <p className="text-[10px] text-slate-400">
                                        Dimensions: {item.product.tileDimensions || 'Standard'} • Lot: {item.product.batchNo || 'L1'}
                                      </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <span className="font-extrabold text-white block">
                                        {item.quantity} boxes @ {formatCurrency(item.finalUnitPrice, currencySymbol)}
                                      </span>
                                      <span className="text-[10px] text-emerald-400 font-bold">
                                        Subtotal: {formatCurrency(item.totalPrice, currencySymbol)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {inv.notes && (
                                <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                                  <strong>Invoice Notes:</strong> {inv.notes}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold text-base text-white">
              Record Payment for {payingInvoice.invoiceNumber}
            </h3>
            <div className="p-3 bg-slate-800 rounded-xl text-xs space-y-1 text-slate-300">
              <div className="flex justify-between">
                <span>Total Invoice Bill:</span>
                <span>{formatCurrency(payingInvoice.grandTotal, currencySymbol)}</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>Amount Paid so far:</span>
                <span>{formatCurrency(payingInvoice.amountPaid, currencySymbol)}</span>
              </div>
              <div className="flex justify-between font-bold text-amber-400 pt-1 border-t border-slate-700">
                <span>Remaining Outstanding Balance:</span>
                <span>{formatCurrency(payingInvoice.grandTotal - payingInvoice.amountPaid, currencySymbol)}</span>
              </div>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Payment Amount ({currencySymbol})</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  max={payingInvoice.grandTotal - payingInvoice.amountPaid}
                  value={payAmountInput}
                  onChange={(e) => setPayAmountInput(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                >
                  <option value="CASH">Cash</option>
                  <option value="CARD">Credit / Debit Card</option>
                  <option value="UPI_QR">UPI / QR</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Notes / Ref #</label>
                <input
                  type="text"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="e.g. Received via Bank Transfer"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingInvoice(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold shadow"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Process Refund Modal */}
      {refundingInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold text-base text-white">
              Process Refund for {refundingInvoice.invoiceNumber}
            </h3>
            <p className="text-xs text-slate-300">
              This will mark the invoice status as REFUNDED and adjust revenue reporting.
            </p>

            <form onSubmit={handleRefundSubmit} className="space-y-3 text-xs">
              <div className="flex items-center space-x-2 p-3 bg-slate-800 rounded-xl">
                <input
                  type="checkbox"
                  id="restock"
                  checked={restockToggle}
                  onChange={(e) => setRestockToggle(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="restock" className="text-slate-200 cursor-pointer">
                  Automatically return items back into inventory stock
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRefundingInvoice(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 text-white rounded-xl font-bold shadow"
                >
                  Confirm Refund
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
