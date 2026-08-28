import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calendar, CheckCircle2, Clock, Eye, Printer, Receipt, RefreshCw, ShieldCheck, Tag, Timer, UserCheck } from 'lucide-react';
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
type DocumentType = 'QUOTATIONS' | 'INVOICES';

export const InvoicesView: React.FC<InvoicesViewProps> = ({ invoices, onSelectInvoiceToPrint, currencySymbol }) => {
  const [documentType, setDocumentType] = useState<DocumentType>('QUOTATIONS');
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

  const isFinalInvoice = (invoice: Invoice) => invoice.status === 'PAID' || invoice.status === 'REFUNDED' || invoice.workflowStatus === 'PAYMENT_CONFIRMED' || invoice.workflowStatus === 'COMPLETED';
  const isToday = (value: string) => { const date = new Date(value); const now = new Date(); return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate(); };
  const quotationCount = liveInvoices.filter((invoice) => !isFinalInvoice(invoice)).length;
  const invoiceCount = liveInvoices.filter(isFinalInvoice).length;

  const visibleInvoices = useMemo(() => {
    const query = search.trim().toLowerCase();
    return liveInvoices.filter((invoice) => {
      if (documentType === 'INVOICES' ? !isFinalInvoice(invoice) : isFinalInvoice(invoice)) return false;
      if (mode === 'TODAY' && !isToday(invoice.date)) return false;
      if (status !== 'ALL' && invoice.status !== status) return false;
      if (!query) return true;
      return invoice.invoiceNumber.toLowerCase().includes(query) || (invoice.quotationNumber || '').toLowerCase().includes(query) || (invoice.customer?.name || '').toLowerCase().includes(query) || (invoice.customer?.phone || '').toLowerCase().includes(query) || (invoice.salespersonName || '').toLowerCase().includes(query) || invoice.items.some((item) => item.product.name.toLowerCase().includes(query) || item.product.sku.toLowerCase().includes(query));
    });
  }, [liveInvoices, documentType, mode, search, status]);

  useEffect(() => {
    if (visibleInvoices.length === 0) { setSelectedId(null); return; }
    const currentIsVisible = selectedId ? visibleInvoices.some((invoice) => invoice.id === selectedId) : false;
    if (!currentIsVisible) setSelectedId(visibleInvoices[0].id);
  }, [visibleInvoices, selectedId]);

  const selected = visibleInvoices.find((invoice) => invoice.id === selectedId) || visibleInvoices[0] || null;

  const statusBadge = (value: InvoiceStatus) => {
    if (value === 'PAID') return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-black"><CheckCircle2 className="w-3 h-3" />PAID</span>;
    if (value === 'PARTIAL') return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-black"><Clock className="w-3 h-3" />PARTIAL</span>;
    if (value === 'REFUNDED') return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-500/10 text-slate-300 border border-slate-500/30 text-[10px] font-black">REFUNDED</span>;
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

  const managerStatus = (invoice: Invoice) => {
    const workflow = invoice.workflowStatus || '';
    if (['PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'COMPLETED'].includes(workflow)) return 'APPROVED';
    if (workflow === 'MANAGER_APPROVAL_REJECTED') return 'REJECTED';
    if (workflow === 'MANAGER_APPROVAL_PENDING') return 'PENDING';
    return Number(invoice.branchManagerDiscountPercent || 0) > 0 || Number(invoice.branchManagerDiscountAmount || 0) > 0 || !!invoice.branchManagerRemarks ? 'APPROVED' : 'NOT REQUIRED';
  };

  const managerStatusBadge = (invoice: Invoice) => {
    const value = managerStatus(invoice);
    if (value === 'APPROVED') return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-black"><UserCheck className="w-3 h-3" />MANAGER APPROVED</span>;
    if (value === 'PENDING') return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-black"><Timer className="w-3 h-3" />MANAGER PENDING</span>;
    if (value === 'REJECTED') return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/30 text-[10px] font-black"><AlertCircle className="w-3 h-3" />MANAGER REJECTED</span>;
    return <span className="text-[10px] font-black text-slate-500">NOT REQUIRED</span>;
  };

  const paymentReference = selected?.paymentSpecificReference || selected?.paymentsHistory?.at(-1)?.referenceNumber;
  const paymentDate = selected?.paymentConfirmedAtUtc || selected?.paymentsHistory?.at(-1)?.date;
  const documentLabel = documentType === 'INVOICES' ? 'Invoice' : 'Quotation';

  const openDocumentView = (invoice: Invoice) => {
    const popupWindow = window.open('', '_blank', 'width=1100,height=800,scrollbars=yes,resizable=yes');
    if (!popupWindow) { window.alert('Please allow pop-ups to view the document.'); return; }
    const paid = isFinalInvoice(invoice);
    const label = paid ? 'INVOICE' : 'QUOTATION';
    const number = invoice.invoiceNumber || invoice.quotationNumber || '—';
    const itemRows = (invoice.items || []).map((item) => `<tr><td>${item.product.name}</td><td>${item.quantity} ${item.selectedUnit || item.product.unit || ''}</td><td>${formatCurrency(Number(item.finalUnitPrice || 0), currencySymbol)}</td><td>${formatCurrency(Number(item.totalPrice || 0), currencySymbol)}</td></tr>`).join('');
    const discount = Number(invoice.itemDiscountsTotal || 0) + Number(invoice.promoDiscountAmount || 0) + Number(invoice.branchManagerDiscountAmount || 0);
    popupWindow.document.write(`<!doctype html><html><head><title>${label} ${number}</title><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;margin:0;padding:32px;color:#111827;background:#fff}h1{margin:0;font-size:28px}h2{margin:4px 0 0;font-size:18px;color:#374151}small{color:#6b7280}.top{display:flex;justify-content:space-between;border-bottom:2px solid #111827;padding-bottom:18px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:24px 0}.box{border:1px solid #d1d5db;border-radius:8px;padding:14px}.label{font-size:11px;color:#6b7280;text-transform:uppercase;font-weight:700}.value{font-weight:700;margin-top:4px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border-bottom:1px solid #e5e7eb;padding:10px;text-align:left}th{background:#f3f4f6;font-size:12px}.right{text-align:right}.totals{margin-left:auto;width:320px;margin-top:20px}.row{display:flex;justify-content:space-between;padding:6px 0}.grand{font-size:20px;font-weight:800;border-top:2px solid #111827;margin-top:6px;padding-top:10px}.status{display:inline-block;margin-top:12px;padding:6px 10px;border-radius:999px;background:#ecfdf5;color:#047857;font-size:11px;font-weight:700}.print{margin-top:24px;padding:10px 16px;border:0;border-radius:7px;background:#111827;color:#fff;font-weight:700;cursor:pointer}@media print{.print{display:none}}</style></head><body><div class="top"><div><h1>AVASurface Billing</h1><h2>${label}</h2><small>${number}</small></div><div class="right"><div class="label">Date</div><div class="value">${formatDateTime(invoice.date)}</div><div class="status">${invoice.workflowStatus || invoice.status}</div></div></div><div class="grid"><div class="box"><div class="label">Customer</div><div class="value">${invoice.customer?.name || '—'}</div><div>${invoice.customer?.phone || '—'}</div><div>${invoice.customer?.billingAddress || invoice.customer?.address || '—'}</div></div><div class="box"><div class="label">Salesperson</div><div class="value">${invoice.salespersonName || '—'}</div><div>${invoice.salespersonMobile || '—'}</div></div></div><table><thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th class="right">Total</th></tr></thead><tbody>${itemRows || '<tr><td colspan="4">No item details available.</td></tr>'}</tbody></table><div class="totals"><div class="row"><span>Subtotal</span><strong>${formatCurrency(Number(invoice.subtotal || invoice.grandTotal), currencySymbol)}</strong></div><div class="row"><span>Discount</span><strong>${formatCurrency(discount, currencySymbol)}</strong></div>${invoice.creditNoteAmount ? `<div class="row"><span>Credit Note</span><strong>${formatCurrency(Number(invoice.creditNoteAmount), currencySymbol)}</strong></div>` : ''}<div class="row grand"><span>${paid ? 'Invoice Total' : 'Quotation Total'}</span><strong>${formatCurrency(Number(invoice.grandTotal || 0), currencySymbol)}</strong></div></div>${paid ? `<p><strong>Payment:</strong> ${invoice.paymentMethodConfirmed || invoice.paymentMethod || '—'} ${paymentReference ? `· ${paymentReference}` : ''}</p>` : ''}<button class="print" onclick="window.print()">Print ${label}</button></body></html>`);
    popupWindow.document.close();
    popupWindow.focus();
  };

  return <div className="space-y-5">
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div><div className="flex items-center gap-2"><Receipt className="w-6 h-6 text-indigo-400" /><h2 className="text-xl font-black text-white">Quotations &amp; Invoices</h2></div><p className="text-xs text-slate-400 mt-1">Unconfirmed payments remain as Quotations. Once Accounts confirms payment, the document automatically moves to Invoices.</p></div>
      <button onClick={() => void refreshFromServer()} disabled={refreshing} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black flex items-center gap-2 disabled:opacity-50"><RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />Refresh</button>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <button onClick={() => { setDocumentType('QUOTATIONS'); setStatus('ALL'); }} className={`p-4 rounded-2xl border text-left transition ${documentType === 'QUOTATIONS' ? 'bg-amber-950/30 border-amber-500/50' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}><div className="flex items-center justify-between"><span className="text-xs font-black uppercase tracking-wider text-amber-300">Quotations</span><Timer className="w-4 h-4 text-amber-300" /></div><div className="text-2xl font-black text-white mt-1">{quotationCount}</div><div className="text-[10px] text-slate-500 mt-1">Payment pending / approval pending</div></button>
      <button onClick={() => { setDocumentType('INVOICES'); setStatus('ALL'); }} className={`p-4 rounded-2xl border text-left transition ${documentType === 'INVOICES' ? 'bg-emerald-950/30 border-emerald-500/50' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}><div className="flex items-center justify-between"><span className="text-xs font-black uppercase tracking-wider text-emerald-300">Invoices</span><CheckCircle2 className="w-4 h-4 text-emerald-300" /></div><div className="text-2xl font-black text-white mt-1">{invoiceCount}</div><div className="text-[10px] text-slate-500 mt-1">Accounts payment confirmed</div></button>
    </div>
    <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
      <div className="flex gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800 w-fit"><button onClick={() => setMode('ALL')} className={`px-4 py-2 rounded-lg text-xs font-black ${mode === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>All ({documentType === 'QUOTATIONS' ? quotationCount : invoiceCount})</button><button onClick={() => setMode('TODAY')} className={`px-4 py-2 rounded-lg text-xs font-black ${mode === 'TODAY' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}><Calendar className="inline w-3 h-3 mr-1" />Today</button></div>
      <div className="flex flex-col md:flex-row gap-3 flex-1 md:justify-end"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${documentLabel.toLowerCase()}, customer, phone, salesperson, item...`} className="md:w-[420px] px-4 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs outline-none focus:border-indigo-500" /><select value={status} onChange={(e) => setStatus(e.target.value as 'ALL' | InvoiceStatus)} className="md:w-[180px] px-3 py-3 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs"><option value="ALL">All Status</option><option value="UNPAID">Unpaid</option><option value="PARTIAL">Partial</option><option value="PAID">Paid</option><option value="REFUNDED">Refunded</option></select></div>
    </div>
    {visibleInvoices.length === 0 ? <div className="p-10 text-center bg-slate-900 border border-slate-800 rounded-3xl text-slate-500">No {documentLabel.toLowerCase()}s found.</div> : <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2 max-h-[700px] overflow-y-auto">{visibleInvoices.map((invoice) => <button key={invoice.id} onClick={() => setSelectedId(invoice.id)} className={`w-full text-left p-3 rounded-xl border ${selectedId === invoice.id ? 'border-indigo-500 bg-indigo-950/30' : 'border-slate-800 hover:border-slate-700'}`}><div className="flex items-center justify-between gap-3"><span className="font-mono font-black text-white text-sm">{invoice.invoiceNumber}</span>{statusBadge(invoice.status)}</div><div className="mt-1 text-xs text-slate-300">{invoice.customer?.name || 'Customer'}</div><div className="mt-1 text-[10px] text-slate-500">{formatDateTime(invoice.date)} · {invoice.salespersonName || 'No salesperson'}</div><div className="mt-2 text-right text-sm font-black text-white">{formatCurrency(invoice.grandTotal, currencySymbol)}</div></button>)}</div>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">{!selected ? <div className="min-h-60 flex items-center justify-center text-slate-500">Select a {documentLabel.toLowerCase()} to view details.</div> : <div className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4"><div><div className="text-[10px] uppercase tracking-wider text-indigo-300 font-black">{documentLabel}</div><div className="text-xl font-black text-white">{selected.invoiceNumber || selected.quotationNumber}</div><div className="text-xs text-slate-400 mt-1">{selected.customer?.name || 'Customer'} · {selected.customer?.phone || 'No phone'}</div><div className="text-xs text-slate-500 mt-1">Salesperson: {selected.salespersonName || '—'}</div></div><div className="text-right"><div className="text-[10px] uppercase text-slate-500">{documentLabel} Value</div><div className="text-2xl font-black text-white">{formatCurrency(selected.grandTotal, currencySymbol)}</div>{statusBadge(selected.status)}</div></div>

        {documentType === 'QUOTATIONS' && <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-violet-950/30 border border-violet-500/30"><div className="flex items-center gap-2 text-violet-200 font-black text-xs"><UserCheck className="w-4 h-4" />Manager Approval</div><div className="mt-2">{managerStatusBadge(selected)}</div><div className="text-[10px] text-slate-400 mt-2">Discount: {formatCurrency(Number(selected.branchManagerDiscountAmount || 0), currencySymbol)} ({Number(selected.branchManagerDiscountPercent || 0).toFixed(2)}%)</div>{selected.branchManagerRemarks && <div className="text-[10px] text-slate-400 mt-1">Remarks: {selected.branchManagerRemarks}</div>}</div>
          <div className="p-4 rounded-2xl bg-fuchsia-950/30 border border-fuchsia-500/30"><div className="flex items-center gap-2 text-fuchsia-200 font-black text-xs"><Tag className="w-4 h-4" />Promotions</div><div className="mt-2 text-sm font-black text-white">{selected.promoCodeApplied || 'No promotion applied'}</div><div className="text-[10px] text-slate-400 mt-1">Promotion discount: {formatCurrency(Number(selected.promoDiscountAmount || 0), currencySymbol)}</div></div>
          <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30"><div className="flex items-center gap-2 text-amber-200 font-black text-xs"><ShieldCheck className="w-4 h-4" />Credit Note</div><div className="mt-2 text-sm font-black text-white">{formatCurrency(Number(selected.creditNoteAmount || 0), currencySymbol)}</div><div className="mt-1">{approvalBadge(creditNoteStatus(selected))}</div>{selected.creditNoteReason && <div className="text-[10px] text-slate-400 mt-1">{selected.creditNoteReason}</div>}</div>
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800"><div className="flex items-center gap-2 text-slate-300 font-black text-xs"><Timer className="w-4 h-4" />Workflow</div><div className="mt-2 text-sm font-black text-white">{selected.workflowStatus || 'PAYMENT_PENDING'}</div><div className="text-[10px] text-slate-500 mt-1">Payment: {selected.paymentMethodRequested || selected.paymentMethod || '—'}</div></div>
        </div>}

        {documentType === 'QUOTATIONS' && <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800"><div className="text-xs font-black text-white mb-3">Quotation Workflow</div><div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[10px]"><div className="p-3 rounded-xl border border-slate-800"><div className="text-slate-500">1. POS Created</div><div className="text-white font-bold mt-1">Quotation {selected.quotationNumber || selected.invoiceNumber || '—'}</div></div><div className={`p-3 rounded-xl border ${managerStatus(selected) === 'APPROVED' ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-slate-800'}`}><div className="text-slate-500">2. Manager</div><div className="text-white font-bold mt-1">{managerStatus(selected)}</div></div><div className="p-3 rounded-xl border border-slate-800"><div className="text-slate-500">3. Accounts</div><div className="text-white font-bold mt-1">{selected.workflowStatus === 'PAYMENT_PENDING' ? 'READY FOR PAYMENT' : selected.workflowStatus === 'PAYMENT_CONFIRMED' || selected.workflowStatus === 'COMPLETED' ? 'PAYMENT CONFIRMED' : 'WAITING'}</div></div><div className="p-3 rounded-xl border border-slate-800"><div className="text-slate-500">4. Invoice</div><div className="text-white font-bold mt-1">{isFinalInvoice(selected) ? selected.invoiceNumber || 'Generated' : 'Not generated yet'}</div></div></div></div>}

        <div className={`grid grid-cols-2 ${canSeeCreditNote ? 'md:grid-cols-5' : 'md:grid-cols-3'} gap-3`}><div className="p-3 rounded-xl bg-slate-950 border border-slate-800"><div className="text-[10px] text-slate-500">Subtotal</div><div className="font-black text-white">{formatCurrency(selected.subtotal, currencySymbol)}</div></div><div className="p-3 rounded-xl bg-slate-950 border border-slate-800"><div className="text-[10px] text-slate-500">Discount</div><div className="font-black text-violet-300">{formatCurrency((selected.itemDiscountsTotal || 0) + (selected.promoDiscountAmount || 0) + (selected.branchManagerDiscountAmount || 0), currencySymbol)}</div></div>{canSeeCreditNote && <><div className="p-3 rounded-xl bg-slate-950 border border-slate-800"><div className="text-[10px] text-slate-500">Credit Note</div><div className="font-black text-amber-300">{formatCurrency(selected.creditNoteAmount || 0, currencySymbol)}</div></div><div className="p-3 rounded-xl bg-slate-950 border border-slate-800"><div className="text-[10px] text-slate-500">Credit Note Status</div><div className="mt-1">{approvalBadge(creditNoteStatus(selected))}</div></div></>}{documentType === 'INVOICES' ? <div className="p-3 rounded-xl bg-slate-950 border border-slate-800"><div className="text-[10px] text-slate-500">Paid</div><div className="font-black text-emerald-300">{formatCurrency(selected.amountPaid, currencySymbol)}</div><div className="text-[10px] text-emerald-400 mt-1">Payment confirmed</div></div> : <div className="p-3 rounded-xl bg-slate-950 border border-slate-800"><div className="text-[10px] text-slate-500">Payment Status</div><div className="font-black text-amber-300 mt-1">Awaiting Accounts</div><div className="text-[10px] text-slate-500 mt-1">No confirmed payment yet</div></div>}</div>
        {canSeeCreditNote && (selected.creditNoteAmount || 0) > 0 && <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/20 text-xs"><div className="text-amber-200 font-bold">Credit Note Reason</div><div className="text-slate-300 mt-1">{selected.creditNoteReason || 'No reason recorded'}</div></div>}
        <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="w-full text-xs"><thead className="bg-slate-950 text-slate-400"><tr><th className="p-3 text-left">Item</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Rate</th><th className="p-3 text-right">Total</th></tr></thead><tbody>{selected.items.map((item) => <tr key={`${selected.id}-${item.product.id}`} className="border-t border-slate-800"><td className="p-3 text-white">{item.product.name}</td><td className="p-3 text-right text-slate-300">{item.quantity} {item.selectedUnit || item.product.unit}</td><td className="p-3 text-right text-slate-300">{formatCurrency(item.finalUnitPrice, currencySymbol)}</td><td className="p-3 text-right text-white font-bold">{formatCurrency(item.totalPrice, currencySymbol)}</td></tr>)}</tbody></table></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs"><div className="p-3 rounded-xl bg-slate-950 border border-slate-800"><div className="text-slate-500">Workflow</div><div className="font-black text-white mt-1">{selected.workflowStatus || (isFinalInvoice(selected) ? 'PAYMENT_CONFIRMED' : 'PAYMENT_PENDING')}</div></div><div className="p-3 rounded-xl bg-slate-950 border border-slate-800"><div className="text-slate-500">Payment Method</div><div className="font-black text-white mt-1">{selected.paymentMethodConfirmed || selected.paymentMethod}</div></div><div className="p-3 rounded-xl bg-slate-950 border border-slate-800"><div className="text-slate-500">Payment Reference</div><div className="font-black text-white mt-1 break-all">{paymentReference || '—'}</div>{paymentDate && <div className="text-[10px] text-slate-500 mt-1">{formatDateTime(paymentDate)}</div>}</div></div>
        <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 text-xs text-indigo-200">{documentType === 'QUOTATIONS' ? 'This quotation remains outside the final invoice register until Accounts confirms payment.' : 'This is a final invoice. Payment has been confirmed by Accounts.'}</div>
        <div className="flex justify-end gap-2"><button onClick={() => openDocumentView(selected)} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-2"><Eye className="w-4 h-4" /> View {documentLabel}</button>{documentType === 'INVOICES' && <button onClick={() => onSelectInvoiceToPrint(selected)} className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-black flex items-center gap-2"><Printer className="w-4 h-4" /> Print Invoice</button>}</div>
      </div>}</div>
    </div>}
  </div>;
};