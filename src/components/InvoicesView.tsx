import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calendar, CheckCircle2, Clock, Printer, Receipt, RefreshCw, ShieldCheck, Timer } from 'lucide-react';
import { Invoice, InvoiceStatus, PaymentMethod } from '../types';
import { formatCurrency, formatDateTime } from '../lib/utils';
import { hydrateInvoicesFromServer } from '../lib/invoiceHydration';
import { Storage } from '../lib/storage';

interface InvoicesViewProps {
  invoices: Invoice[];
  onRecordPayment: (invoiceId: string, paymentAmount: number, method: PaymentMethod, notes?: string) => void;
  onProcessRefund: (invoiceId: string, restockItems: boolean) => void;
  onSelectInvoiceToPrint: (invoice: Invoice) => void;
  currencySymbol: string;
}

type CreditNoteViewStatus = 'NOT_REQUESTED' | 'PENDING' | 'APPROVED' | 'REJECTED';

export const InvoicesView: React.FC<InvoicesViewProps> = ({ invoices, onSelectInvoiceToPrint, currencySymbol }) => {
  const [mode, setMode] = useState<'ALL' | 'TODAY'>('ALL');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | InvoiceStatus>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [liveInvoices, setLiveInvoices] = useState<Invoice[]>(invoices);
  const [refreshing, setRefreshing] = useState(false);
  const activeUser = Storage.getUsers().find((user) => user.id === Storage.getActiveUserId());
  const canSeeCreditNote = activeUser?.role === 'ADMIN' || activeUser?.role === 'ACCOUNTANT' || activeUser?.role === 'MANAGER' || activeUser?.role === 'BRANCH_MANAGER';

  useEffect(() => { setLiveInvoices(invoices); }, [invoices]);

  const refreshFromServer = async () => {
    setRefreshing(true);
    try {
      const latest = await hydrateInvoicesFromServer();
      if (latest.length > 0) setLiveInvoices(latest);
    } finally { setRefreshing(false); }
  };

  useEffect(() => {
    void refreshFromServer();
    const timer = window.setInterval(() => { void refreshFromServer(); }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const isToday = (value: string) => {
    const date = new Date(value); const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  };

  const visibleInvoices = useMemo(() => {
    const query = search.trim().toLowerCase();
    return liveInvoices.filter((invoice) => {
      if (mode === 'TODAY' && !isToday(invoice.date)) return false;
      if (status !== 'ALL' && invoice.status !== status) return false;
      if (!query) return true;
      return invoice.invoiceNumber.toLowerCase().includes(query) ||
        (invoice.customer?.name || '').toLowerCase().includes(query) ||
        (invoice.customer?.phone || '').toLowerCase().includes(query) ||
        (invoice.salespersonName || '').toLowerCase().includes(query) ||
        invoice.items.some((item) => item.product.name.toLowerCase().includes(query) || item.product.sku.toLowerCase().includes(query));
    });
  }, [liveInvoices, mode, search, status]);

  // Always show the first invoice on the right when the list has data.
  // If the current selection is filtered out or disappears after refresh, select the new first invoice.
  useEffect(() => {
    if (visibleInvoices.length === 0) {
      setSelectedId(null);
      return;
    }
    const currentIsVisible = selectedId ? visibleInvoices.some((invoice) => invoice.id === selectedId) : false;
    if (!currentIsVisible) setSelectedId(visibleInvoices[0].id);
  }, [visibleInvoices, selectedId]);

  const selected = visibleInvoices.find((invoice) => invoice.id === selectedId) || visibleInvoices[0] || null;

  const statusBadge = (value: InvoiceStatus) => {
    if (value === 'PAID') return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-black"><CheckCircle2 className="w-3 h-3" />PAID</span>;
    if (value === 'PARTIAL') return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-black"><Clock className="w-3 h-3" />PARTIAL</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/30 text-[10px] font-black"><AlertCircle className="w-3 h-3" />UNPAID</span>;
  };

  const creditNoteStatus = (invoice: Invoice): CreditNoteViewStatus => {
    const amount = Number(invoice.creditNoteAmount || 0);
    if (amount <= 0) return 'NOT_REQUESTED';
    const workflow = invoice.workflowStatus || '';
    if (workflow === 'MANAGER_APPROVAL_PENDING') return 'PENDING';
    if (workflow === 'PAYMENT_PENDING' || workflow === 'PAYMENT_CONFIRMED' || workflow === 'COMPLETED') return 'APPROVED';
    return 'REJECTED';
  };

  const approvalBadge = (value: CreditNoteViewStatus) => {
    if (value === 'APPROVED') return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-black"><ShieldCheck className="w-3 h-3" />APPROVED</span>;
    if (value === 'PENDING') return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-black"><Timer className="w-3 h-3" />PENDING APPROVAL</span>;
    if (value === 'REJECTED') return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/30 text-[10px] font-black"><AlertCircle className="w-3 h-3" />REJECTED</span>;
    return <span className="text-[10px] font-black text-slate-500">NOT REQUESTED</span>;
  };

  const paymentReference = selected?.paymentSpecificReference || selected?.paymentsHistory?.at(-1)?.referenceNumber;
  const paymentDate = selected?.paymentConfirmedAtUtc || selected?.paymentsHistory?.at(-1)?.date;

  return (
    <div className="space-y-5">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><Receipt className="w-6 h-6 text-indigo-400" /><h2 className="text-xl font-black text-white">Invoice History</h2></div>
          <p className="text-xs text-slate-400 mt-1">Billing view shows invoice and payment status only. Credit-note details are restricted to Manager, Branch Manager, Accounts and Admin.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void refreshFromServer()} disabled={refreshing} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black flex items-center gap-2 disabled:opacity-50"><RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />Refresh</button>
          <div className="flex gap-2 bg-slate-800 p-1 rounded-xl">
            <button onClick={() => setMode('ALL')} className={`px-4 py-2 rounded-lg text-xs font-black ${mode === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>All Invoices ({liveInvoices.length})</button>
            <button onClick={() => setMode('TODAY')} className={`px-4 py-2 rounded-lg text-xs font-black ${mode === 'TODAY' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}><Calendar className="inline w-3 h-3 mr-1" />Today</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-3">
        <div className="relative"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice, customer, phone, salesperson, item..." className="w-full pl-4 pr-3 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs outline-none focus:border-indigo-500" /></div>
        <select value={status} onChange={(e) => setStatus(e.target.value as 'ALL' | InvoiceStatus)} className="px-3 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs"><option value="ALL">All Status</option><option value="UNPAID">Unpaid</option><option value="PARTIAL">Partial</option><option value="PAID">Paid</option><option value="REFUNDED">Refunded</option></select>
      </div>

      {visibleInvoices.length === 0 ? <div className="p-10 text-center bg-slate-900 border border-slate-800 rounded-3xl text-slate-500">No invoices found.</div> : (
        <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2 max-h-[700px] overflow-y-auto">
            {visibleInvoices.map((invoice) => (
              <button key={invoice.id} onClick={() => setSelectedId(invoice.id)} className={`w-full text-left p-3 rounded-xl border ${selectedId === invoice.id ? 'border-indigo-500 bg-indigo-950/30' : 'border-slate-800 hover:border-slate-700'}`}>
                <div className="flex items-center justify-between gap-3"><span className="font-mono font-black text-white text-sm">{invoice.invoiceNumber}</span>{statusBadge(invoice.status)}</div>
                <div className="mt-1 text-xs text-slate-300">{invoice.customer?.name || 'Customer'}</div>
                <div className="mt-1 text-[10px] text-slate-500">{formatDateTime(invoice.date)} · {invoice.salespersonName || 'No salesperson'}</div>
                <div className="mt-2 text-right text-sm font-black text-white">{formatCurrency(invoice.grandTotal, currencySymbol)}</div>
              </button>
            ))}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            {!selected ? <div className="min-h-60 flex items-center justify-center text-slate-500">Select an invoice to view details.</div> : (
              <div className="space-y-5">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div><div className="text-xl font-black text-white">{selected.invoiceNumber}</div><div className="text-xs text-slate-400 mt-1">{selected.customer?.name || 'Customer'} · {selected.customer?.phone || 'No phone'}</div><div className="text-xs text-slate-500 mt-1">Salesperson: {selected.salespersonName || '—'}</div></div>
                  <div className="text-right"><div className="text-[10px] uppercase text-slate-500">Invoice Value</div><div className="text-2xl font-black text-white">{formatCurrency(selected.grandTotal, currencySymbol)}</div>{statusBadge(selected.status)}</div>
                </div>

                <div className={`grid grid-cols-2 ${canSeeCreditNote ? 'md:grid-cols-5' : 'md:grid-cols-3'} gap-3`}>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800"><div className="text-[10px] text-slate-500">Subtotal</div><div className="font-black text-white">{formatCurrency(selected.subtotal, currencySymbol)}</div></div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800"><div className="text-[10px] text-slate-500">Discount</div><div className="font-black text-violet-300">{formatCurrency((selected.itemDiscountsTotal || 0) + (selected.promoDiscountAmount || 0) + (selected.branchManagerDiscountAmount || 0), currencySymbol)}</div></div>
                  {canSeeCreditNote && <>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800"><div className="text-[10px] text-slate-500">Credit Note</div><div className="font-black text-amber-300">{formatCurrency(selected.creditNoteAmount || 0, currencySymbol)}</div></div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800"><div className="text-[10px] text-slate-500">Credit Note Status</div><div className="mt-1">{approvalBadge(creditNoteStatus(selected))}</div></div>
                  </>}
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800"><div className="text-[10px] text-slate-500">Paid</div><div className="font-black text-emerald-300">{formatCurrency(selected.amountPaid, currencySymbol)}</div><div className="text-[10px] text-slate-500 mt-1">{selected.status === 'PAID' ? 'Payment confirmed' : 'Awaiting Accounts'}</div></div>
                </div>

                {canSeeCreditNote && (selected.creditNoteAmount || 0) > 0 && <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/20 text-xs"><div className="text-amber-200 font-bold">Credit Note Reason</div><div className="text-slate-300 mt-1">{selected.creditNoteReason || 'No reason recorded'}</div></div>}

                <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="w-full text-xs"><thead className="bg-slate-950 text-slate-400"><tr><th className="p-3 text-left">Item</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Rate</th><th className="p-3 text-right">Total</th></tr></thead><tbody>{selected.items.map((item) => <tr key={`${selected.id}-${item.product.id}`} className="border-t border-slate-800"><td className="p-3 text-white">{item.product.name}</td><td className="p-3 text-right text-slate-300">{item.quantity} {item.selectedUnit || item.product.unit}</td><td className="p-3 text-right text-slate-300">{formatCurrency(item.finalUnitPrice, currencySymbol)}</td><td className="p-3 text-right text-white font-bold">{formatCurrency(item.totalPrice, currencySymbol)}</td></tr>)}</tbody></table></div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800"><div className="text-slate-500">Workflow</div><div className="font-black text-white mt-1">{selected.workflowStatus || (selected.status === 'PAID' ? 'PAYMENT_CONFIRMED' : 'PAYMENT_PENDING')}</div></div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800"><div className="text-slate-500">Payment Method</div><div className="font-black text-white mt-1">{selected.paymentMethodConfirmed || selected.paymentMethod}</div></div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800"><div className="text-slate-500">Payment Reference</div><div className="font-black text-white mt-1 break-all">{paymentReference || '—'}</div>{paymentDate && <div className="text-[10px] text-slate-500 mt-1">{formatDateTime(paymentDate)}</div>}</div>
                </div>

                <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 text-xs text-indigo-200">This screen is read-only. Billing/Cashier users cannot edit historical invoices or collect payments. Accounts confirms payment; this view refreshes from the backend automatically.</div>
                <div className="flex justify-end"><button onClick={() => onSelectInvoiceToPrint(selected)} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-2"><Printer className="w-4 h-4" /> Print Invoice</button></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
