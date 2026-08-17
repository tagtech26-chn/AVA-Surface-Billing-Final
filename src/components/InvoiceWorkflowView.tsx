import React, { useEffect, useState } from 'react';
import { CheckCircle2, PackageCheck, CreditCard, Percent, XCircle } from 'lucide-react';
import { UserProfile } from '../types';
import { formatCurrency, formatDateTime } from '../lib/utils';

interface WorkflowInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  grandTotal: number;
  subTotal?: number;
  discountAmount?: number;
  promoDiscountAmount?: number;
  branchManagerDiscountPercent?: number;
  branchManagerDiscountAmount?: number;
  branchManagerUserId?: string;
  branchManagerRemarks?: string;
  workflowStatus: string;
  paymentMethodRequested?: string;
  paymentMethodConfirmed?: string;
  paymentSpecificReference?: string;
  customer?: { name?: string; phone?: string };
  salespersonName?: string;
  salespersonMobile?: string;
  lines?: Array<{ quantity: number; product?: { name?: string; sku?: string; unit?: string } }>;
}

interface Props { activeUser: UserProfile; currencySymbol: string; onPaymentConfirmed?: (invoice: WorkflowInvoice) => void; }
const inputClass = 'px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-indigo-500';

export const InvoiceWorkflowView: React.FC<Props> = ({ activeUser, currencySymbol, onPaymentConfirmed }) => {
  const isAccounts = activeUser.role === 'ACCOUNTANT';
  const isWarehouse = activeUser.role === 'WAREHOUSE';
  const isManager = activeUser.role === 'BRANCH_MANAGER' || activeUser.role === 'MANAGER';
  const [backendUserId, setBackendUserId] = useState('');
  const [invoices, setInvoices] = useState<WorkflowInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [method, setMethod] = useState('CASH');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [bankName, setBankName] = useState('');
  const [cardLast4, setCardLast4] = useState('');
  const [utr, setUtr] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loadedBy, setLoadedBy] = useState('');
  const [verifiedBy, setVerifiedBy] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [warehouseRemarks, setWarehouseRemarks] = useState('');
  const [managerDiscount, setManagerDiscount] = useState('');
  const [managerRemarks, setManagerRemarks] = useState('');

  const resolveBackendUser = async () => {
    const role = activeUser.role === 'MANAGER' ? 'BRANCH_MANAGER' : activeUser.role;
    const response = await fetch(`/api/invoice-workflow/workflow-user?role=${encodeURIComponent(role)}`);
    if (!response.ok) throw new Error('No backend workflow user is configured for this role.');
    const user = await response.json();
    const id = String(user.id); setBackendUserId(id); return id;
  };

  const loadInvoices = async () => {
    setLoading(true);
    try {
      if (!backendUserId) await resolveBackendUser();
      const endpoint = isManager ? '/api/invoice-workflow/manager-pending' : isAccounts ? '/api/invoice-workflow/pending-payments' : '/api/invoice-workflow/warehouse-ready';
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setInvoices(await response.json()); setMessage('');
    } catch (error) { console.error(error); setMessage(error instanceof Error ? error.message : 'Unable to load workflow invoices.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { setBackendUserId(''); void loadInvoices(); }, [activeUser.role]);
  const selected = invoices.find(x => x.id === selectedId);

  const confirmPayment = async () => {
    if (!selected || !backendUserId) return setMessage('Accounts user identity is not available.');
    if (!amount || Number(amount) <= 0) return setMessage('Payment amount must be greater than zero.');
    if (!reference.trim()) return setMessage('Payment receipt/reference is required.');
    if (method === 'CARD' && !/^\d{4}$/.test(cardLast4)) return setMessage('Enter the last 4 digits for card payment.');
    if ((method === 'UPI_QR' || method === 'BANK_TRANSFER') && !utr.trim()) return setMessage('UTR / transaction ID is required.');
    const response = await fetch(`/api/invoice-workflow/${selected.id}/confirm-payment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: backendUserId, amount: Number(amount), method, specificReference: reference.trim(), bankName: bankName.trim() || null, cardLast4: cardLast4.trim() || null, utr: utr.trim() || null, remarks: remarks.trim() || null }) });
    if (!response.ok) return setMessage(await response.text());
    const confirmed = await response.json() as WorkflowInvoice;
    setMessage('Payment confirmed. Invoice released to Warehouse and is PRINT READY.'); onPaymentConfirmed?.(confirmed); setSelectedId(null); await loadInvoices();
  };

  const approveManagerDiscount = async () => {
    if (!selected || !backendUserId) return setMessage('Manager identity is not available.');
    if (!managerDiscount || Number(managerDiscount) <= 0 || Number(managerDiscount) > 100) return setMessage('Enter an approved additional discount between 0% and 100%.');
    if (!managerRemarks.trim()) return setMessage('Manager remarks are required.');
    const response = await fetch(`/api/invoice-workflow/${selected.id}/approve-manager-discount`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: backendUserId, discountPercent: Number(managerDiscount), remarks: managerRemarks.trim() }) });
    if (!response.ok) return setMessage(await response.text());
    setMessage('Manager approved. Total discount has been recalculated and the invoice is now with Accounts.'); setSelectedId(null); setManagerDiscount(''); setManagerRemarks(''); await loadInvoices();
  };

  const rejectManagerDiscount = async () => {
    if (!selected || !backendUserId) return setMessage('Manager identity is not available.');
    if (!managerRemarks.trim()) return setMessage('Rejection remarks are required.');
    const response = await fetch(`/api/invoice-workflow/${selected.id}/reject-manager-discount`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: backendUserId, remarks: managerRemarks.trim() }) });
    if (!response.ok) return setMessage(await response.text());
    setMessage('Additional discount rejected. Invoice returned for billing action.'); setSelectedId(null); setManagerDiscount(''); setManagerRemarks(''); await loadInvoices();
  };

  const markLoaded = async () => {
    if (!selected || !backendUserId) return setMessage('Warehouse user identity is not available.');
    if (!loadedBy.trim() || !verifiedBy.trim()) return setMessage('Loaded By and Verified By are required.');
    const response = await fetch(`/api/invoice-workflow/${selected.id}/load`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: backendUserId, loadedBy: loadedBy.trim(), verifiedBy: verifiedBy.trim(), vehicleNumber: vehicleNumber.trim() || null, remarks: warehouseRemarks.trim() || null }) });
    if (!response.ok) return setMessage(await response.text());
    setMessage('Warehouse loading and verification completed. Order is now COMPLETED.'); setSelectedId(null); setLoadedBy(''); setVerifiedBy(''); setVehicleNumber(''); setWarehouseRemarks(''); await loadInvoices();
  };

  return <div className="space-y-5">
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5"><div className="flex items-center gap-3">{isManager ? <Percent className="w-6 h-6 text-violet-400" /> : isAccounts ? <CreditCard className="w-6 h-6 text-emerald-400" /> : <PackageCheck className="w-6 h-6 text-amber-400" />}<div><h2 className="text-xl font-black text-white">{isManager ? 'Additional Discount Approval' : isAccounts ? 'Accounts Payment Confirmation' : 'Warehouse Loading & Completion'}</h2><p className="text-xs text-slate-400">Logged in as {activeUser.name} · {activeUser.role}</p></div></div></div>
    {message && <div className="p-3 rounded-xl bg-indigo-950/50 border border-indigo-500/30 text-xs text-indigo-200">{message}</div>}
    {loading ? <div className="p-8 text-center text-slate-400">Loading invoices...</div> : invoices.length === 0 ? <div className="p-10 text-center bg-slate-900 border border-slate-800 rounded-3xl text-slate-500">No invoices waiting at this stage.</div> : <div className="grid gap-4">{invoices.map(invoice => {
      const isSelected = selectedId === invoice.id;
      const totalDiscount = Number(invoice.discountAmount || 0) + Number(invoice.promoDiscountAmount || 0) + Number(invoice.branchManagerDiscountAmount || 0);
      const managerApproved = Number(invoice.branchManagerDiscountAmount || 0) > 0 || !!invoice.branchManagerUserId;
      return <div key={invoice.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap"><span className="font-mono font-black text-white">{invoice.invoiceNumber}</span><span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">{invoice.workflowStatus}</span>{managerApproved && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30 font-bold">MANAGER APPROVED</span>}</div>
          <div className="text-xs text-slate-300">{invoice.customer?.name || 'Customer'} · {invoice.customer?.phone || 'No phone'}</div>
          <div className="text-[11px] text-slate-400">Salesperson: {invoice.salespersonName || '—'} {invoice.salespersonMobile ? `· ${invoice.salespersonMobile}` : ''}</div>
          <div className="text-[11px] text-slate-400">Actual Amount: <strong className="text-slate-200">{formatCurrency(invoice.subTotal || 0, currencySymbol)}</strong> · Total Discount: <strong className="text-amber-300">-{formatCurrency(totalDiscount, currencySymbol)}</strong></div>
          {isManager && <div className="text-[11px] text-violet-300">Reason: {invoice.branchManagerRemarks || '—'}</div>}{isAccounts && <div className="text-[11px] text-slate-400">Payment requested: <strong className="text-slate-200">{invoice.paymentMethodRequested || 'CASH'}</strong></div>}
          <div className="text-[11px] text-slate-500">{formatDateTime(invoice.invoiceDate)} · {invoice.lines?.length || 0} line items</div>
        </div><div className="flex items-center gap-3"><span className="font-black text-white">{formatCurrency(invoice.grandTotal, currencySymbol)}</span>{isManager && <button onClick={() => setSelectedId(isSelected ? null : invoice.id)} className="px-3 py-2 bg-violet-600 hover:bg-violet-500 rounded-xl text-xs font-bold text-white">Review Discount</button>}{isAccounts && <button onClick={() => { setSelectedId(invoice.id); setMethod((invoice.paymentMethodRequested || 'CASH').toUpperCase()); setAmount(String(invoice.grandTotal)); setReference(''); setBankName(''); setCardLast4(''); setUtr(''); setRemarks(''); }} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white">Confirm Payment</button>}{isWarehouse && invoice.workflowStatus === 'PAYMENT_CONFIRMED' && <button onClick={() => setSelectedId(isSelected ? null : invoice.id)} className="px-3 py-2 bg-amber-600 hover:bg-amber-500 rounded-xl text-xs font-bold text-white">Load & Complete</button>}</div></div>
        {isSelected && isManager && <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3"><div className="md:col-span-2 p-3 rounded-xl bg-slate-800 text-xs text-slate-300">Existing line/promo discounts: <strong className="text-white">{formatCurrency(Number(invoice.discountAmount || 0) + Number(invoice.promoDiscountAmount || 0), currencySymbol)}</strong><div className="text-violet-300 mt-1">Manager approval is recorded as a workflow/audit marker, not as a separate invoice line.</div></div><input value={managerDiscount} onChange={e => setManagerDiscount(e.target.value)} type="number" min="0.01" max="100" step="0.01" placeholder="Approved additional discount % *" className={`${inputClass} border-violet-500/40`}/><input value={managerRemarks} onChange={e => setManagerRemarks(e.target.value)} placeholder="Manager approval reason *" className={`${inputClass} border-violet-500/40`}/><button onClick={() => void approveManagerDiscount()} className="px-4 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4"/>Approve &amp; Send to Accounts</button><button onClick={() => void rejectManagerDiscount()} className="px-4 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2"><XCircle className="w-4 h-4"/>Reject Request</button></div>}
        {isSelected && isAccounts && <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3"><select value={method} onChange={e => setMethod(e.target.value)} className={inputClass}><option value="CASH">Cash Collection</option><option value="CARD">Credit / Debit Card</option><option value="UPI_QR">UPI</option><option value="BANK_TRANSFER">Bank Transfer</option></select><input value={amount} onChange={e => setAmount(e.target.value)} type="number" step="0.01" placeholder="Amount" className={inputClass}/><input value={reference} onChange={e => setReference(e.target.value)} placeholder="Receipt / payment reference *" className={inputClass}/>{method === 'CARD' && <input value={cardLast4} onChange={e => setCardLast4(e.target.value.replace(/\D/g, '').slice(0,4))} placeholder="Card last 4 digits *" className={inputClass}/>} {(method === 'UPI_QR' || method === 'BANK_TRANSFER') && <input value={utr} onChange={e => setUtr(e.target.value)} placeholder="UTR / transaction ID *" className={inputClass}/>} {method === 'BANK_TRANSFER' && <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Bank name" className={inputClass}/>}<textarea value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Accounts remarks" className={`${inputClass} md:col-span-2`}/><button onClick={() => void confirmPayment()} className="md:col-span-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black">Confirm Payment &amp; Release to Warehouse</button></div>}
        {isSelected && isWarehouse && invoice.workflowStatus === 'PAYMENT_CONFIRMED' && <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3"><div className="md:col-span-2 text-xs text-amber-300">Completing warehouse loading marks this order <strong>COMPLETED</strong>. Gate entry/outward movement can be added later without changing this billing workflow.</div><input value={loadedBy} onChange={e => setLoadedBy(e.target.value)} placeholder="Loaded By *" className={inputClass}/><input value={verifiedBy} onChange={e => setVerifiedBy(e.target.value)} placeholder="Verified By *" className={inputClass}/><input value={vehicleNumber} onChange={e => setVehicleNumber(e.target.value)} placeholder="Vehicle Number" className={inputClass}/><textarea value={warehouseRemarks} onChange={e => setWarehouseRemarks(e.target.value)} placeholder="Warehouse remarks" className={`${inputClass} md:col-span-2`}/><button onClick={() => void markLoaded()} className="md:col-span-2 px-4 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4"/>Complete Warehouse Loading</button></div>}
      </div>;
    })}</div>}
  </div>;
};