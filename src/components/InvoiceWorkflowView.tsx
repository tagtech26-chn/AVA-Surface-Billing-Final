import React, { useEffect, useState } from 'react';
import { CheckCircle2, PackageCheck, Truck, CreditCard, Printer, Percent, XCircle } from 'lucide-react';
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

interface Props {
  activeUser: UserProfile;
  currencySymbol: string;
  onPaymentConfirmed?: (invoice: WorkflowInvoice) => void;
}

export const InvoiceWorkflowView: React.FC<Props> = ({ activeUser, currencySymbol, onPaymentConfirmed }) => {
  const isAccounts = activeUser.role === 'ACCOUNTANT';
  const isWarehouse = activeUser.role === 'WAREHOUSE';
  const isManager = activeUser.role === 'BRANCH_MANAGER';
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
    const response = await fetch(`/api/invoice-workflow/workflow-user?role=${encodeURIComponent(activeUser.role)}`);
    if (!response.ok) throw new Error('No backend workflow user is configured for this role.');
    const user = await response.json();
    setBackendUserId(String(user.id));
    return String(user.id);
  };

  const loadInvoices = async () => {
    setLoading(true);
    try {
      if (!backendUserId) await resolveBackendUser();
      const endpoint = isManager
        ? '/api/invoice-workflow/manager-pending'
        : isAccounts
          ? '/api/invoice-workflow/pending-payments'
          : '/api/invoice-workflow/warehouse-ready';
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setInvoices(await response.json());
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : 'Unable to load workflow invoices.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setBackendUserId(''); void loadInvoices(); }, [activeUser.role]);

  const selected = invoices.find((invoice) => invoice.id === selectedId);

  const openPayment = (invoice: WorkflowInvoice) => {
    setSelectedId(invoice.id);
    setMethod((invoice.paymentMethodRequested || 'CASH').toUpperCase());
    setAmount(String(invoice.grandTotal));
    setReference('');
    setBankName('');
    setCardLast4('');
    setUtr('');
    setRemarks('');
  };

  const confirmPayment = async () => {
    if (!selected) return;
    if (!backendUserId) { setMessage('Accounts user identity is not available.'); return; }
    if (!amount || Number(amount) <= 0) { setMessage('Payment amount must be greater than zero.'); return; }
    if (!reference.trim()) { setMessage('Payment receipt/reference is required at Accounts confirmation.'); return; }
    if (method === 'CARD' && !/^\d{4}$/.test(cardLast4)) { setMessage('Enter the last 4 digits for the card payment.'); return; }
    if ((method === 'UPI_QR' || method === 'BANK_TRANSFER') && !utr.trim()) { setMessage('UTR / transaction ID is required for this payment method.'); return; }

    const response = await fetch(`/api/invoice-workflow/${selected.id}/confirm-payment`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: backendUserId, amount: Number(amount), method, specificReference: reference.trim(), bankName: bankName.trim() || null, cardLast4: cardLast4.trim() || null, utr: utr.trim() || null, remarks: remarks.trim() || null })
    });
    if (!response.ok) { setMessage(await response.text()); return; }

    const confirmed = await response.json() as WorkflowInvoice;
    setMessage('Payment confirmed by Accounts. Invoice is now PRINT READY and released to Warehouse.');
    onPaymentConfirmed?.(confirmed);
    setSelectedId(null); setAmount(''); setReference(''); setBankName(''); setCardLast4(''); setUtr(''); setRemarks('');
    await loadInvoices();
  };

  const approveManagerDiscount = async () => {
    if (!selected || !backendUserId) { setMessage('Manager identity is not available.'); return; }
    if (!managerDiscount || Number(managerDiscount) <= 0 || Number(managerDiscount) > 100) { setMessage('Enter an approved additional discount between 0% and 100%.'); return; }
    if (!managerRemarks.trim()) { setMessage('Manager remarks are required.'); return; }

    const response = await fetch(`/api/invoice-workflow/${selected.id}/approve-manager-discount`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: backendUserId, discountPercent: Number(managerDiscount), remarks: managerRemarks.trim() })
    });
    if (!response.ok) { setMessage(await response.text()); return; }

    setMessage('Additional discount approved. Invoice moved to Accounts payment confirmation.');
    setSelectedId(null); setManagerDiscount(''); setManagerRemarks('');
    await loadInvoices();
  };

  const rejectManagerDiscount = async () => {
    if (!selected || !backendUserId) { setMessage('Manager identity is not available.'); return; }
    if (!managerRemarks.trim()) { setMessage('Rejection remarks are required.'); return; }
    const response = await fetch(`/api/invoice-workflow/${selected.id}/reject-manager-discount`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: backendUserId, remarks: managerRemarks.trim() })
    });
    if (!response.ok) { setMessage(await response.text()); return; }
    setMessage('Additional discount request rejected and invoice returned for cashier action.');
    setSelectedId(null); setManagerDiscount(''); setManagerRemarks('');
    await loadInvoices();
  };

  const markLoaded = async () => {
    if (!selected || !backendUserId) { setMessage('Warehouse user identity is not available.'); return; }
    if (!loadedBy.trim() || !verifiedBy.trim()) { setMessage('Loaded By and Verified By are required.'); return; }
    const response = await fetch(`/api/invoice-workflow/${selected.id}/load`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: backendUserId, loadedBy: loadedBy.trim(), verifiedBy: verifiedBy.trim(), vehicleNumber: vehicleNumber.trim() || null, remarks: warehouseRemarks.trim() || null })
    });
    if (!response.ok) { setMessage(await response.text()); return; }
    setMessage('Invoice loaded and verified.');
    setSelectedId(null); setLoadedBy(''); setVerifiedBy(''); setVehicleNumber(''); setWarehouseRemarks('');
    await loadInvoices();
  };

  const markDelivered = async (invoiceId: string) => {
    if (!backendUserId) { setMessage('Warehouse user identity is not available.'); return; }
    const response = await fetch(`/api/invoice-workflow/${invoiceId}/deliver`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: backendUserId })
    });
    if (!response.ok) { setMessage(await response.text()); return; }
    setMessage('Invoice marked as delivered.');
    await loadInvoices();
  };

  return (
    <div className="space-y-5">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
        <div className="flex items-center gap-3">
          {isManager ? <Percent className="w-6 h-6 text-violet-400" /> : isAccounts ? <CreditCard className="w-6 h-6 text-emerald-400" /> : <PackageCheck className="w-6 h-6 text-amber-400" />}
          <div><h2 className="text-xl font-black text-white">{isManager ? 'Additional Discount Approval' : isAccounts ? 'Accounts Payment Confirmation' : 'Warehouse Invoice Workflow'}</h2><p className="text-xs text-slate-400">Logged in as {activeUser.name} · {activeUser.role}</p></div>
        </div>
      </div>
      {message && <div className="p-3 rounded-xl bg-indigo-950/50 border border-indigo-500/30 text-xs text-indigo-200">{message}</div>}
      {loading ? <div className="p-8 text-center text-slate-400">Loading invoices...</div> : invoices.length === 0 ? <div className="p-10 text-center bg-slate-900 border border-slate-800 rounded-3xl text-slate-500">No invoices waiting at this stage.</div> : (
        <div className="grid gap-4">
          {invoices.map((invoice) => {
            const isSelected = selectedId === invoice.id;
            return (
              <div key={invoice.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2"><span className="font-mono font-black text-white">{invoice.invoiceNumber}</span><span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">{invoice.workflowStatus}</span></div>
                    <div className="text-xs text-slate-300">{invoice.customer?.name || 'Customer'} · {invoice.customer?.phone || 'No phone'}</div>
                    <div className="text-[11px] text-slate-400">Salesperson: {invoice.salespersonName || '—'} {invoice.salespersonMobile ? `· ${invoice.salespersonMobile}` : ''}</div>
                    {isManager && <div className="text-[11px] text-violet-300">Additional discount requested. Cashier reason: {invoice.branchManagerRemarks || '—'}</div>}
                    {isAccounts && <div className="text-[11px] text-slate-400">Payment requested: <strong className="text-slate-200">{invoice.paymentMethodRequested || 'CASH'}</strong></div>}
                    <div className="text-[11px] text-slate-400">{formatDateTime(invoice.invoiceDate)} · {invoice.lines?.length || 0} line items</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-black text-white">{formatCurrency(invoice.grandTotal, currencySymbol)}</span>
                    {isManager && <button onClick={() => setSelectedId(isSelected ? null : invoice.id)} className="px-3 py-2 bg-violet-600 hover:bg-violet-500 rounded-xl text-xs font-bold text-white">Review Discount</button>}
                    {isAccounts && <button onClick={() => openPayment(invoice)} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white">Confirm Payment</button>}
                    {isWarehouse && invoice.workflowStatus === 'PAYMENT_CONFIRMED' && <button onClick={() => setSelectedId(isSelected ? null : invoice.id)} className="px-3 py-2 bg-amber-600 hover:bg-amber-500 rounded-xl text-xs font-bold text-white">Load Invoice</button>}
                    {isWarehouse && invoice.workflowStatus === 'LOADED' && <button onClick={() => void markDelivered(invoice.id)} className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white">Mark Delivered</button>}
                  </div>
                </div>

                {isSelected && isManager && (
                  <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2 p-3 rounded-xl bg-slate-800 text-xs text-slate-300">
                      <div>Invoice Value: <strong className="text-white">{formatCurrency(invoice.grandTotal, currencySymbol)}</strong></div>
                      <div>Existing line/promo discounts: <strong className="text-white">{formatCurrency((invoice.discountAmount || 0) + (invoice.promoDiscountAmount || 0), currencySymbol)}</strong></div>
                      <div className="text-violet-300 mt-1">Manager must enter the additional discount. Cashier cannot enter this discount.</div>
                    </div>
                    <input value={managerDiscount} onChange={(e) => setManagerDiscount(e.target.value)} type="number" min="0.01" max="100" step="0.01" placeholder="Approved additional discount % *" className="px-3 py-2 bg-slate-800 border border-violet-500/40 rounded-xl text-xs text-white"/>
                    <input value={managerRemarks} onChange={(e) => setManagerRemarks(e.target.value)} placeholder="Manager remarks / approval reason *" className="px-3 py-2 bg-slate-800 border border-violet-500/40 rounded-xl text-xs text-white"/>
                    <button onClick={() => void approveManagerDiscount()} className="px-4 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4"/>Approve &amp; Send to Accounts</button>
                    <button onClick={() => void rejectManagerDiscount()} className="px-4 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2"><XCircle className="w-4 h-4"/>Reject Request</button>
                  </div>
                )}

                {isSelected && isAccounts && (
                  <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <select value={method} onChange={(e) => setMethod(e.target.value)} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"><option value="CASH">Cash Collection</option><option value="CARD">Credit / Debit Card</option><option value="UPI_QR">UPI</option><option value="BANK_TRANSFER">Bank Transfer</option></select>
                    <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" placeholder="Amount" className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"/>
                    <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={method === 'CASH' ? 'Cash receipt/reference *' : 'Receipt / payment reference *'} className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"/>
                    {method === 'CARD' && <input value={cardLast4} onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, '').slice(0,4))} placeholder="Card last 4 digits *" className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"/>}
                    {(method === 'UPI_QR' || method === 'BANK_TRANSFER') && <input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="UTR / transaction ID *" className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"/>}
                    {method === 'BANK_TRANSFER' && <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Bank name" className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"/>}
                    <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Accounts remarks" className="md:col-span-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"/>
                    <button onClick={() => void confirmPayment()} className="md:col-span-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4"/>Confirm Payment &amp; Make Print Ready <Printer className="w-4 h-4"/></button>
                  </div>
                )}

                {isSelected && isWarehouse && invoice.workflowStatus === 'PAYMENT_CONFIRMED' && (
                  <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input value={loadedBy} onChange={(e) => setLoadedBy(e.target.value)} placeholder="Loaded By *" className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"/>
                    <input value={verifiedBy} onChange={(e) => setVerifiedBy(e.target.value)} placeholder="Verified By *" className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"/>
                    <input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())} placeholder="Vehicle Number" className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"/>
                    <textarea value={warehouseRemarks} onChange={(e) => setWarehouseRemarks(e.target.value)} placeholder="Warehouse loading remarks" className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"/>
                    <button onClick={() => void markLoaded()} className="md:col-span-2 px-4 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2"><Truck className="w-4 h-4"/>Mark Loaded &amp; Verified</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
