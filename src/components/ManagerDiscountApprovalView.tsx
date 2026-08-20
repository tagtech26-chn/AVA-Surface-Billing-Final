import React, { useEffect, useMemo, useState } from 'react';
import { Check, X, Clock, RefreshCw, ReceiptText, Lock, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../lib/utils';

interface ManagerDiscountApprovalViewProps {
  activeUserId: string;
  activeUserName: string;
  currencySymbol: string;
  onApprovalCompleted?: () => void;
}

type ManagerInvoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  grandTotal: number;
  creditNoteAmount: number;
  creditNoteFlagged: boolean;
  creditNoteReason?: string;
  branchManagerDiscountPercent: number;
  branchManagerDiscountAmount: number;
  branchManagerRemarks?: string;
  workflowStatus: string;
  status: string;
  customer?: { name?: string; phone?: string };
  salesperson?: { name?: string; mobile?: string };
  lines?: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    discountAmount: number;
    taxableAmount: number;
    lineTotal: number;
    product?: { name?: string; sku?: string; unit?: string; gstRate?: number };
  }>;
};

export const ManagerDiscountApprovalView: React.FC<ManagerDiscountApprovalViewProps> = ({
  activeUserId,
  activeUserName,
  currencySymbol,
  onApprovalCompleted
}) => {
  const [tab, setTab] = useState<'PENDING' | 'ALL' | 'PAID'>('PENDING');
  const [invoices, setInvoices] = useState<ManagerInvoice[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [discountPercent, setDiscountPercent] = useState('');
  const [creditNoteAmount, setCreditNoteAmount] = useState('');
  const [creditNoteReason, setCreditNoteReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const endpoint = tab === 'PENDING' ? '/api/manager/invoices/unpaid' : tab === 'PAID' ? '/api/manager/invoices/paid' : '/api/manager/invoices';
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(`Manager invoice API HTTP ${response.status}: ${await response.text()}`);
      const data = await response.json() as ManagerInvoice[];
      setInvoices(data);
      setSelectedId(data[0]?.id ?? null);
      setDiscountPercent(data[0] ? String(data[0].branchManagerDiscountPercent ?? 0) : '');
      setCreditNoteAmount(data[0] ? String(data[0].creditNoteAmount ?? 0) : '');
      setCreditNoteReason(data[0]?.creditNoteReason ?? '');
      setRemarks(data[0]?.branchManagerRemarks ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load manager invoices.');
      setInvoices([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [tab]);

  const selected = useMemo(() => invoices.find((invoice) => invoice.id === selectedId) ?? null, [invoices, selectedId]);
  const locked = !!selected && (selected.workflowStatus === 'PAYMENT_CONFIRMED' || selected.workflowStatus === 'COMPLETED' || selected.status === 'PAID');
  const percent = Number(discountPercent || 0);
  const credit = Number(creditNoteAmount || 0);
  const estimatedDiscount = selected ? Math.max(0, Math.round((selected.grandTotal * percent / 100) * 100) / 100) : 0;
  const estimatedCommercial = selected ? Math.max(0, selected.grandTotal - estimatedDiscount) : 0;
  const estimatedCollection = Math.max(0, estimatedCommercial - credit);

  const selectInvoice = (invoice: ManagerInvoice) => {
    setSelectedId(invoice.id);
    setDiscountPercent(String(invoice.branchManagerDiscountPercent ?? 0));
    setCreditNoteAmount(String(invoice.creditNoteAmount ?? 0));
    setCreditNoteReason(invoice.creditNoteReason ?? '');
    setRemarks(invoice.branchManagerRemarks ?? '');
    setMessage('');
    setError('');
  };

  const submitDecision = async () => {
    if (!selected || locked) return;
    const pct = Number(discountPercent || 0);
    const cn = Number(creditNoteAmount || 0);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) { setError('Additional discount must be between 0% and 100%.'); return; }
    if (!Number.isFinite(cn) || cn < 0) { setError('Credit note amount cannot be negative.'); return; }
    if (cn > 0 && !creditNoteReason.trim()) { setError('Credit note reason is required.'); return; }

    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/manager/invoices/${selected.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: activeUserId,
          additionalDiscountPercent: pct,
          creditNoteAmount: cn,
          creditNoteReason: cn > 0 ? creditNoteReason.trim() : null,
          remarks: remarks.trim() || null
        })
      });
      if (!response.ok) throw new Error(`Manager decision HTTP ${response.status}: ${await response.text()}`);
      const updated = await response.json() as ManagerInvoice;
      setInvoices((current) => current.map((invoice) => invoice.id === updated.id ? updated : invoice));
      setSelectedId(updated.id);
      setDiscountPercent(String(updated.branchManagerDiscountPercent ?? pct));
      setCreditNoteAmount(String(updated.creditNoteAmount ?? cn));
      setCreditNoteReason(updated.creditNoteReason ?? '');
      setRemarks(updated.branchManagerRemarks ?? '');
      setMessage(`Manager decision saved for ${updated.invoiceNumber}. Accounts collection: ${formatCurrency(Math.max(0, updated.grandTotal - updated.creditNoteAmount), currencySymbol)}.`);
      onApprovalCompleted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save manager decision.');
    } finally {
      setSaving(false);
      void load();
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><ReceiptText className="w-6 h-6 text-violet-400" /><h2 className="text-xl font-black text-white">Manager Invoice Decisions</h2></div>
          <p className="text-xs text-slate-400 mt-1">Logged in as {activeUserName}. Manager reviews every invoice and makes the final commercial decision.</p>
        </div>
        <button onClick={() => void load()} className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700" title="Refresh"><RefreshCw className="w-4 h-4" /></button>
      </div>

      <div className="flex gap-2 bg-slate-900 border border-slate-800 rounded-2xl p-2">
        {(['PENDING', 'ALL', 'PAID'] as const).map((value) => (
          <button key={value} onClick={() => setTab(value)} className={`px-4 py-2 rounded-xl text-xs font-black ${tab === value ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            {value === 'PENDING' ? 'Pending / Unpaid' : value === 'PAID' ? 'Paid / Locked' : 'All Invoices'}
          </button>
        ))}
      </div>

      {message && <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-xs text-emerald-200 flex items-center gap-2"><Check className="w-4 h-4" />{message}</div>}
      {error && <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/30 text-xs text-rose-200 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}

      {loading ? <div className="p-10 text-center text-slate-400">Loading invoices...</div> : invoices.length === 0 ? <div className="p-10 text-center bg-slate-900 border border-slate-800 rounded-3xl text-slate-500">No invoices in this view.</div> : (
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2 max-h-[680px] overflow-y-auto">
            {invoices.map((invoice) => {
              const isSelected = invoice.id === selectedId;
              const isPaid = invoice.workflowStatus === 'PAYMENT_CONFIRMED' || invoice.workflowStatus === 'COMPLETED' || invoice.status === 'PAID';
              return <button key={invoice.id} onClick={() => selectInvoice(invoice)} className={`w-full text-left p-3 rounded-xl border ${isSelected ? 'border-violet-500 bg-violet-950/30' : 'border-slate-800 bg-slate-950 hover:border-slate-700'}`}>
                <div className="flex items-center justify-between gap-2"><span className="font-mono font-black text-white text-sm">{invoice.invoiceNumber}</span><span className={`text-[10px] px-2 py-1 rounded-full ${isPaid ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-300'}`}>{invoice.workflowStatus}</span></div>
                <div className="text-xs text-slate-300 mt-1">{invoice.customer?.name || 'Customer'}</div>
                <div className="text-[11px] text-slate-500 mt-1">{new Date(invoice.invoiceDate).toLocaleDateString()} · {formatCurrency(invoice.grandTotal, currencySymbol)}</div>
              </button>;
            })}
          </div>

          {selected && <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div><div className="text-lg font-black text-white">{selected.invoiceNumber}</div><div className="text-xs text-slate-400 mt-1">{selected.customer?.name || 'Customer'} · {selected.salesperson?.name || 'No salesperson'}</div></div>
              <div className="text-right"><div className="text-[10px] uppercase text-slate-500">Invoice value</div><div className="text-2xl font-black text-white">{formatCurrency(selected.grandTotal, currencySymbol)}</div></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800"><div className="text-[10px] text-slate-500 uppercase">Manager discount</div><div className="text-lg font-black text-violet-300">{formatCurrency(selected.branchManagerDiscountAmount || 0, currencySymbol)}</div></div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800"><div className="text-[10px] text-slate-500 uppercase">Commercial value</div><div className="text-lg font-black text-white">{formatCurrency(selected.grandTotal, currencySymbol)}</div></div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800"><div className="text-[10px] text-slate-500 uppercase">Credit note</div><div className="text-lg font-black text-amber-300">{formatCurrency(selected.creditNoteAmount || 0, currencySymbol)}</div></div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800"><div className="text-[10px] text-slate-500 uppercase">Accounts collects</div><div className="text-lg font-black text-emerald-300">{formatCurrency(Math.max(0, selected.grandTotal - (selected.creditNoteAmount || 0)), currencySymbol)}</div></div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="w-full text-xs"><thead className="bg-slate-950 text-slate-400"><tr><th className="p-3 text-left">Item</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Rate</th><th className="p-3 text-right">Line Total</th></tr></thead><tbody>{(selected.lines || []).map((line) => <tr key={line.id} className="border-t border-slate-800"><td className="p-3 text-white">{line.product?.name || line.product?.sku || 'Item'}</td><td className="p-3 text-right text-slate-300">{line.quantity} {line.product?.unit || ''}</td><td className="p-3 text-right text-slate-300">{formatCurrency(line.unitPrice, currencySymbol)}</td><td className="p-3 text-right text-white">{formatCurrency(line.lineTotal, currencySymbol)}</td></tr>)}</tbody></table></div>

            {locked ? <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-sm text-emerald-200 flex items-center gap-2"><Lock className="w-4 h-4" /> Payment is confirmed. Manager discount and credit note are locked.</div> : <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="p-4 rounded-xl bg-violet-950/30 border border-violet-500/30"><span className="text-xs font-black text-violet-200">Additional Discount (%)</span><input value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} type="number" min="0" max="100" step="0.01" className="mt-2 w-full px-3 py-3 rounded-xl bg-slate-950 border border-violet-500/40 text-white font-black" placeholder="0" /></label>
                <label className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30"><span className="text-xs font-black text-amber-200">Credit Note Amount</span><input value={creditNoteAmount} onChange={(e) => setCreditNoteAmount(e.target.value)} type="number" min="0" step="0.01" className="mt-2 w-full px-3 py-3 rounded-xl bg-slate-950 border border-amber-500/40 text-white font-black" placeholder="0" /></label>
              </div>
              <textarea value={creditNoteReason} onChange={(e) => setCreditNoteReason(e.target.value)} className="w-full px-3 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs" placeholder="Credit note reason (required when amount > 0)" />
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} className="w-full px-3 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs" placeholder="Manager remarks (optional)" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs"><div><span className="text-slate-500">Estimated discount</span><div className="font-black text-violet-300">{formatCurrency(estimatedDiscount, currencySymbol)}</div></div><div><span className="text-slate-500">Estimated commercial value</span><div className="font-black text-white">{formatCurrency(estimatedCommercial, currencySymbol)}</div></div><div><span className="text-slate-500">Estimated Accounts collection</span><div className="font-black text-emerald-300">{formatCurrency(estimatedCollection, currencySymbol)}</div></div></div>
              <div className="flex justify-end"><button disabled={saving} onClick={() => void submitDecision()} className="px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-black flex items-center gap-2"><Check className="w-4 h-4" />{saving ? 'Saving...' : 'Save Final Manager Decision'}</button></div>
            </>}
          </div>}
        </div>
      )}
    </div>
  );
};