import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, PackageCheck, CreditCard, ClipboardList, Lock, Save, Truck } from 'lucide-react';
import { UserProfile } from '../types';
import { authHeaders, formatCurrency, formatDateTime } from '../lib/utils';

interface WorkflowInvoice {
  id: string; invoiceNumber: string; invoiceDate: string; grandTotal: number; subTotal?: number; discountAmount?: number; promoDiscountAmount?: number;
  branchManagerDiscountPercent?: number; branchManagerDiscountAmount?: number; creditNoteFlagged?: boolean; creditNoteAmount?: number; creditNoteReason?: string;
  branchManagerUserId?: string; branchManagerRemarks?: string; workflowStatus: string; status?: string; paymentMethodRequested?: string; paymentConfirmedAtUtc?: string;
  customer?: { name?: string; phone?: string }; salesperson?: { name?: string; mobile?: string }; salespersonName?: string; salespersonMobile?: string;
  lines?: Array<{ id?: string; quantity: number; unitPrice?: number; lineTotal?: number; product?: { name?: string; sku?: string; unit?: string; gstRate?: number } }>;
}

interface Props { activeUser: UserProfile; currencySymbol: string; onPaymentConfirmed?: (invoice: WorkflowInvoice) => void; }
const inputClass = 'px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-indigo-500';
const errorText = async (response: Response) => (await response.text()) || `HTTP ${response.status}`;

export const InvoiceWorkflowView: React.FC<Props> = ({ activeUser, currencySymbol, onPaymentConfirmed }) => {
  const isManager = activeUser.role === 'MANAGER' || activeUser.role === 'BRANCH_MANAGER';
  const isAccounts = activeUser.role === 'ACCOUNTANT';
  const isWarehouse = activeUser.role === 'WAREHOUSE';
  const [tab, setTab] = useState<'pending' | 'all' | 'paid'>(isManager ? 'pending' : 'pending');
  const [invoices, setInvoices] = useState<WorkflowInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [discountPercent, setDiscountPercent] = useState('');
  const [creditNoteAmount, setCreditNoteAmount] = useState('');
  const [creditNoteReason, setCreditNoteReason] = useState('');
  const [managerRemarks, setManagerRemarks] = useState('');
  const [method, setMethod] = useState('CASH');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [bankName, setBankName] = useState('');
  const [cardLast4, setCardLast4] = useState('');
  const [utr, setUtr] = useState('');
  const [remarks, setRemarks] = useState('');
  const [warehouseUserId, setWarehouseUserId] = useState('');
  const [loadedBy, setLoadedBy] = useState('');
  const [verifiedBy, setVerifiedBy] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [warehouseRemarks, setWarehouseRemarks] = useState('');

  const load = async () => {
    setLoading(true); setMessage('');
    try {
      let endpoint = '/api/invoice-workflow/warehouse-ready';
      if (isManager) endpoint = tab === 'paid' ? '/api/manager/invoices/paid' : tab === 'all' ? '/api/manager/invoices' : '/api/manager/invoices/unpaid';
      else if (isAccounts) endpoint = '/api/invoice-workflow/pending-payments';
      const response = await fetch(endpoint, { headers: authHeaders() });
      if (!response.ok) throw new Error(await errorText(response));
      const data = await response.json();
      setInvoices(Array.isArray(data) ? data : []);
      setSelectedId(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load invoices.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [activeUser.role, tab]);

  const selected = useMemo(() => invoices.find(x => x.id === selectedId) || null, [invoices, selectedId]);
  const amountToCollect = selected ? Math.max(0, Number(selected.grandTotal || 0) - Number(selected.creditNoteAmount || 0)) : 0;

  const selectManagerInvoice = (invoice: WorkflowInvoice) => {
    setSelectedId(selectedId === invoice.id ? null : invoice.id);
    setDiscountPercent(String(invoice.branchManagerDiscountPercent || 0));
    setCreditNoteAmount(String(invoice.creditNoteAmount || 0));
    setCreditNoteReason(invoice.creditNoteReason || '');
    setManagerRemarks(invoice.branchManagerRemarks || '');
  };

  const saveManagerDecision = async () => {
    if (!selected) return;
    const discount = Number(discountPercent || 0);
    const credit = Number(creditNoteAmount || 0);
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) return setMessage('Additional discount must be between 0% and 100%.');
    if (!Number.isFinite(credit) || credit < 0) return setMessage('Credit note amount cannot be negative.');
    if (credit > Number(selected.grandTotal || 0)) return setMessage('Credit note cannot exceed the final commercial invoice value.');
    if (credit > 0 && !creditNoteReason.trim()) return setMessage('Credit note reason is required.');
    const response = await fetch(`/api/manager/invoices/${selected.id}/decision`, { method: 'POST', headers: authHeaders(true), body: JSON.stringify({ userId: activeUser.id, additionalDiscountPercent: discount, creditNoteAmount: credit, creditNoteReason: credit > 0 ? creditNoteReason.trim() : null, remarks: managerRemarks.trim() || null }) });
    if (!response.ok) return setMessage(await errorText(response));
    setMessage('Manager decision saved. Invoice is now ready for Accounts.');
    setSelectedId(null); await load();
  };

  const confirmPayment = async () => {
    if (!selected) return;
    const paid = Number(amount);
    if (!Number.isFinite(paid) || Math.abs(paid - amountToCollect) > 0.01) return setMessage(`Accounts must collect exactly ${formatCurrency(amountToCollect, currencySymbol)}.`);
    if (!reference.trim()) return setMessage('Payment receipt/reference is required.');
    if (!['CASH','CARD','UPI_QR','BANK_TRANSFER'].includes(method)) return setMessage('Select a valid Accounts payment method.');
    if (method === 'CARD' && !/^\d{4}$/.test(cardLast4)) return setMessage('Card last 4 digits are required.');
    if ((method === 'UPI_QR' || method === 'BANK_TRANSFER') && !utr.trim()) return setMessage('UTR / transaction ID is required.');
    const response = await fetch(`/api/accounts/invoices/${selected.id}/confirm-payment`, { method: 'POST', headers: authHeaders(true), body: JSON.stringify({ userId: activeUser.id, amount: paid, method, reference: reference.trim(), bankName: bankName.trim() || null, cardLast4: cardLast4.trim() || null, utr: utr.trim() || null, remarks: remarks.trim() || null }) });
    if (!response.ok) return setMessage(await errorText(response));
    const confirmed = await response.json() as WorkflowInvoice;
    setMessage('Payment confirmed. Manager discount and credit note are now locked.');
    onPaymentConfirmed?.(confirmed); setSelectedId(null); await load();
  };

  const resolveWarehouseUser = async () => {
    const response = await fetch('/api/invoice-workflow/workflow-user?role=WAREHOUSE', { headers: authHeaders() });
    if (!response.ok) throw new Error(await errorText(response));
    const user = await response.json(); setWarehouseUserId(String(user.id)); return String(user.id);
  };

  const completeWarehouse = async () => {
    if (!selected) return;
    try {
      const id = warehouseUserId || await resolveWarehouseUser();
      if (!loadedBy.trim() || !verifiedBy.trim()) return setMessage('Loaded By and Verified By are required.');
      const response = await fetch(`/api/invoice-workflow/${selected.id}/load`, { method: 'POST', headers: authHeaders(true), body: JSON.stringify({ userId: id, loadedBy: loadedBy.trim(), verifiedBy: verifiedBy.trim(), vehicleNumber: vehicleNumber.trim() || null, remarks: warehouseRemarks.trim() || null }) });
      if (!response.ok) return setMessage(await errorText(response));
      setMessage('Warehouse loading completed. Invoice is now COMPLETED.'); setSelectedId(null); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to complete warehouse loading.'); }
  };

  const renderManager = () => <>
    <div className="flex items-center gap-2 mb-4"><button onClick={() => setTab('pending')} className={`px-4 py-2 rounded-xl text-xs font-black ${tab === 'pending' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-300'}`}>Pending / Unpaid</button><button onClick={() => setTab('all')} className={`px-4 py-2 rounded-xl text-xs font-black ${tab === 'all' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-300'}`}>All Invoices</button><button onClick={() => setTab('paid')} className={`px-4 py-2 rounded-xl text-xs font-black ${tab === 'paid' ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-300'}`}>Paid / Locked</button></div>
    {invoices.map(invoice => { const paid = invoice.workflowStatus === 'PAYMENT_CONFIRMED' || invoice.workflowStatus === 'COMPLETED' || invoice.status === 'PAID'; const editable = !paid; const isSelected = selectedId === invoice.id; return <div key={invoice.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-3"><div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div className="space-y-1"><div className="flex items-center gap-2 flex-wrap"><span className="font-mono font-black text-white">{invoice.invoiceNumber}</span><span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">{invoice.workflowStatus || invoice.status}</span>{paid && <Lock className="w-3.5 h-3.5 text-emerald-400" />}</div><div className="text-xs text-slate-300">{invoice.customer?.name || 'Customer'} · {invoice.customer?.phone || 'No phone'}</div><div className="text-[11px] text-slate-400">Salesperson: {invoice.salesperson?.name || invoice.salespersonName || '—'}</div><div className="text-[11px] text-slate-400">{formatDateTime(invoice.invoiceDate)} · {invoice.lines?.length || 0} line items</div></div><div className="flex items-center gap-3"><div className="text-right"><div className="text-[10px] text-slate-500">Invoice Value</div><div className="font-black text-white">{formatCurrency(invoice.grandTotal, currencySymbol)}</div></div>{editable && <button onClick={() => selectManagerInvoice(invoice)} className="px-3 py-2 bg-violet-600 hover:bg-violet-500 rounded-xl text-xs font-bold text-white">{isSelected ? 'Close' : 'Review / Finalize'}</button>}</div></div>{isSelected && editable && <div className="mt-4 pt-4 border-t border-slate-800 space-y-3"><div className="grid grid-cols-1 md:grid-cols-4 gap-3"><div><label className="text-[10px] text-slate-400">Original invoice</label><div className="text-lg font-black text-white">{formatCurrency(invoice.subTotal || invoice.grandTotal, currencySymbol)}</div></div><div><label className="text-[10px] text-slate-400">Current commercial value</label><div className="text-lg font-black text-white">{formatCurrency(invoice.grandTotal, currencySymbol)}</div></div><div><label className="text-[10px] text-slate-400">Manager discount</label><input value={discountPercent} onChange={e => setDiscountPercent(e.target.value)} type="number" min="0" max="100" step="0.01" className={`${inputClass} w-full`} /></div><div><label className="text-[10px] text-slate-400">Credit note</label><input value={creditNoteAmount} onChange={e => setCreditNoteAmount(e.target.value)} type="number" min="0" step="0.01" className={`${inputClass} w-full`} /></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><textarea value={creditNoteReason} onChange={e => setCreditNoteReason(e.target.value)} placeholder="Credit note reason (required when amount > 0)" className={`${inputClass} min-h-20`} /><textarea value={managerRemarks} onChange={e => setManagerRemarks(e.target.value)} placeholder="Manager remarks" className={`${inputClass} min-h-20`} /></div><div className="rounded-xl bg-indigo-950/40 border border-indigo-500/30 p-3 text-xs text-slate-300"><div>Only Manager Discount reduces the invoice value.</div><div className="text-violet-300 mt-1">Credit Note is separate and only reduces Accounts collection.</div><div className="mt-2 font-black text-white">After decision: Invoice Value = Original − Manager Discount</div><button onClick={() => void saveManagerDecision()} className="mt-3 px-4 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black text-xs flex items-center gap-2"><Save className="w-4 h-4" /> Save Final Manager Decision</button></div></div>}</div>; })}
  </>;

  const renderAccounts = () => <>{invoices.map(invoice => { const isSelected = selectedId === invoice.id; const net = Math.max(0, Number(invoice.grandTotal || 0) - Number(invoice.creditNoteAmount || 0)); return <div key={invoice.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-3"><div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div><div className="font-mono font-black text-white">{invoice.invoiceNumber}</div><div className="text-xs text-slate-300 mt-1">{invoice.customer?.name || 'Customer'} · Salesperson: {invoice.salesperson?.name || invoice.salespersonName || '—'}</div><div className="text-[11px] text-slate-400 mt-1">Invoice value: <b className="text-white">{formatCurrency(invoice.grandTotal, currencySymbol)}</b> · Credit note: <b className="text-amber-300">{formatCurrency(invoice.creditNoteAmount || 0, currencySymbol)}</b></div></div><div className="flex items-center gap-3"><div className="text-right"><div className="text-[10px] text-slate-500">Amount to collect</div><div className="font-black text-emerald-400">{formatCurrency(net, currencySymbol)}</div></div><button onClick={() => { setSelectedId(isSelected ? null : invoice.id); setMethod((invoice.paymentMethodRequested || 'CASH').toUpperCase()); setAmount(net.toFixed(2)); setReference(''); setBankName(''); setCardLast4(''); setUtr(''); setRemarks(''); }} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white">{isSelected ? 'Close' : 'Collect Payment'}</button></div></div>{isSelected && <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3"><select value={method} onChange={e => setMethod(e.target.value)} className={inputClass}><option value="CASH">Cash</option><option value="CARD">Card</option><option value="UPI_QR">UPI / QR</option><option value="BANK_TRANSFER">Bank Transfer</option></select><input value={amount} onChange={e => setAmount(e.target.value)} type="number" step="0.01" className={inputClass} placeholder="Amount received"/><input value={reference} onChange={e => setReference(e.target.value)} className={inputClass} placeholder="Receipt / payment reference *" />{method === 'CARD' && <input value={cardLast4} onChange={e => setCardLast4(e.target.value.replace(/\D/g, '').slice(0,4))} className={inputClass} placeholder="Card last 4 digits *" />}{(method === 'UPI_QR' || method === 'BANK_TRANSFER') && <input value={utr} onChange={e => setUtr(e.target.value)} className={inputClass} placeholder="UTR / transaction ID *" />}{method === 'BANK_TRANSFER' && <input value={bankName} onChange={e => setBankName(e.target.value)} className={inputClass} placeholder="Bank name" />}<textarea value={remarks} onChange={e => setRemarks(e.target.value)} className={`${inputClass} md:col-span-2`} placeholder="Accounts remarks" /><button onClick={() => void confirmPayment()} className="md:col-span-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-black text-white flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4" /> Confirm Payment &amp; Lock Invoice</button></div>}</div>; })}</>;

  const renderWarehouse = () => <>{invoices.map(invoice => { const isSelected = selectedId === invoice.id; return <div key={invoice.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-3"><div className="flex items-center justify-between gap-3"><div><div className="font-mono font-black text-white">{invoice.invoiceNumber}</div><div className="text-xs text-slate-300">{invoice.customer?.name || 'Customer'} · {formatCurrency(invoice.grandTotal, currencySymbol)}</div></div><button onClick={() => setSelectedId(isSelected ? null : invoice.id)} className="px-3 py-2 bg-amber-600 hover:bg-amber-500 rounded-xl text-xs font-bold text-white">{isSelected ? 'Close' : 'Load & Complete'}</button></div>{isSelected && <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3"><input value={loadedBy} onChange={e => setLoadedBy(e.target.value)} className={inputClass} placeholder="Loaded By *"/><input value={verifiedBy} onChange={e => setVerifiedBy(e.target.value)} className={inputClass} placeholder="Verified By *"/><input value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} className={inputClass} placeholder="Vehicle Number"/><textarea value={warehouseRemarks} onChange={e => setWarehouseRemarks(e.target.value)} className={`${inputClass} md:col-span-2`} placeholder="Warehouse remarks"/><button onClick={() => void completeWarehouse()} className="md:col-span-2 px-4 py-3 bg-amber-600 hover:bg-amber-500 rounded-xl text-xs font-black text-white flex items-center justify-center gap-2"><Truck className="w-4 h-4"/> Complete Warehouse Loading</button></div>}</div>; })}</>;

  return <div className="space-y-5"><div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex items-center gap-3">{isManager ? <ClipboardList className="w-6 h-6 text-violet-400"/> : isAccounts ? <CreditCard className="w-6 h-6 text-emerald-400"/> : <PackageCheck className="w-6 h-6 text-amber-400"/>}<div><h2 className="text-xl font-black text-white">{isManager ? 'Manager Invoice Review' : isAccounts ? 'Accounts Payment Collection' : 'Warehouse Loading & Completion'}</h2><p className="text-xs text-slate-400">Logged in as {activeUser.name} · {activeUser.role}</p></div></div>{message && <div className="p-3 rounded-xl bg-indigo-950/50 border border-indigo-500/30 text-xs text-indigo-200">{message}</div>}{loading ? <div className="p-8 text-center text-slate-400">Loading invoices...</div> : invoices.length === 0 ? <div className="p-10 text-center bg-slate-900 border border-slate-800 rounded-3xl text-slate-500">No invoices at this stage.</div> : isManager ? renderManager() : isAccounts ? renderAccounts() : renderWarehouse()}</div>;
};
