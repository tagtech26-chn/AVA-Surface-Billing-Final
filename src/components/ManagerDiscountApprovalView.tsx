import React, { useMemo, useState } from 'react';
import { Check, X, Clock, UserRound, ReceiptText } from 'lucide-react';
import { ManagerDiscountApproval } from '../types';
import { Storage } from '../lib/storage';
import { formatCurrency } from '../lib/utils';

interface ManagerDiscountApprovalViewProps {
  activeUserId: string;
  activeUserName: string;
  currencySymbol: string;
  onApprovalCompleted?: () => void;
}

export const ManagerDiscountApprovalView: React.FC<ManagerDiscountApprovalViewProps> = ({
  activeUserId,
  activeUserName,
  currencySymbol,
  onApprovalCompleted
}) => {
  const [requests, setRequests] = useState<ManagerDiscountApproval[]>(() => Storage.getPendingManagerDiscountApprovals());
  const [selectedId, setSelectedId] = useState<string | null>(requests[0]?.id ?? null);
  const [discount, setDiscount] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const selected = useMemo(() => requests.find((request) => request.id === selectedId) ?? null, [requests, selectedId]);

  const refresh = () => {
    const pending = Storage.getPendingManagerDiscountApprovals();
    setRequests(pending);
    setSelectedId(pending[0]?.id ?? null);
    setDiscount('');
    setRejectionReason('');
  };

  const approve = () => {
    if (!selected) return;
    const amount = Number(discount);
    if (!Number.isFinite(amount) || amount < 0) return;
    const all = Storage.getManagerDiscountApprovals().map((request) => request.id === selected.id ? {
      ...request,
      status: 'APPROVED' as const,
      approvedDiscountAmount: amount,
      approvedByUserId: activeUserId,
      approvedByName: activeUserName,
      approvedAt: new Date().toISOString()
    } : request);
    Storage.saveManagerDiscountApprovals(all);
    refresh();
    onApprovalCompleted?.();
  };

  const reject = () => {
    if (!selected) return;
    const all = Storage.getManagerDiscountApprovals().map((request) => request.id === selected.id ? {
      ...request,
      status: 'REJECTED' as const,
      approvedByUserId: activeUserId,
      approvedByName: activeUserName,
      approvedAt: new Date().toISOString(),
      rejectionReason: rejectionReason.trim() || undefined
    } : request);
    Storage.saveManagerDiscountApprovals(all);
    refresh();
    onApprovalCompleted?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Manager Approvals</h2>
          <p className="text-sm text-slate-500">Bills sent by billing users for additional discount approval.</p>
        </div>
        <div className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">{requests.length} pending</div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-2 rounded-xl border bg-white p-3">
          {requests.length === 0 ? (
            <div className="flex min-h-40 flex-col items-center justify-center text-center text-slate-500">
              <Check className="mb-2 h-8 w-8" /><p className="font-medium">No pending approvals</p>
            </div>
          ) : requests.map((request) => (
            <button key={request.id} type="button" onClick={() => { setSelectedId(request.id); setDiscount(''); setRejectionReason(''); }} className={`w-full rounded-lg border p-3 text-left transition ${selectedId === request.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <div className="flex items-center justify-between"><span className="font-semibold">{request.invoiceNumber}</span><Clock className="h-4 w-4 text-slate-400" /></div>
              <div className="mt-1 text-sm text-slate-600">{request.customerName}</div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500"><span>{request.requestedByName}</span><span>{formatCurrency(request.currentGrandTotal, currencySymbol)}</span></div>
            </button>
          ))}
        </div>
        <div className="rounded-xl border bg-white p-5">
          {!selected ? (
            <div className="flex min-h-60 items-center justify-center text-slate-500">Select a bill to review.</div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-lg font-semibold"><ReceiptText className="h-5 w-5" /> {selected.invoiceNumber}</div>
                  <div className="mt-1 flex items-center gap-2 text-sm text-slate-500"><UserRound className="h-4 w-4" /> {selected.customerName} · sent by {selected.requestedByName}</div>
                </div>
                <div className="text-right"><div className="text-xs uppercase text-slate-400">Current total</div><div className="text-xl font-bold">{formatCurrency(selected.currentGrandTotal, currencySymbol)}</div></div>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Item</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Rate</th><th className="p-3 text-right">Amount</th></tr></thead><tbody>
                  {selected.items.map((item) => <tr key={`${selected.id}-${item.product.id}`} className="border-t"><td className="p-3">{item.product.name}</td><td className="p-3 text-right">{item.inputQuantity ?? item.quantity} {item.selectedUnit ?? item.product.unit}</td><td className="p-3 text-right">{formatCurrency(item.finalUnitPrice, currencySymbol)}</td><td className="p-3 text-right font-medium">{formatCurrency(item.totalPrice, currencySymbol)}</td></tr>)}
                </tbody></table>
              </div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-slate-50 p-4"><div className="text-sm text-slate-500">Existing discounts</div><div className="text-lg font-semibold">{formatCurrency(selected.existingDiscountAmount, currencySymbol)}</div></div><div className="rounded-lg bg-slate-50 p-4"><div className="text-sm text-slate-500">GST / tax</div><div className="text-lg font-semibold">{formatCurrency(selected.taxTotal, currencySymbol)}</div></div></div>
              <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-4"><label className="block text-sm font-semibold text-amber-900">Additional discount to approve</label><div className="mt-2 flex items-center gap-2"><span className="text-lg font-semibold">{currencySymbol}</span><input value={discount} onChange={(event) => setDiscount(event.target.value)} type="number" min="0" step="0.01" className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-lg font-semibold outline-none focus:ring-2 focus:ring-amber-400" placeholder="Manager decides amount" /></div></div>
              <input value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Optional rejection reason" />
              <div className="flex justify-end gap-3"><button type="button" onClick={reject} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 font-semibold text-red-700 hover:bg-red-50"><X className="h-4 w-4" /> Reject</button><button type="button" onClick={approve} disabled={discount.trim() === ''} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"><Check className="h-4 w-4" /> Approve Discount</button></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
