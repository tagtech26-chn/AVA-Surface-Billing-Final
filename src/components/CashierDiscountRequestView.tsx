import React, { useEffect, useState } from 'react';
import { Percent, Send, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { UserProfile } from '../types';
import { formatCurrency, formatDateTime } from '../lib/utils';

interface CandidateInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  grandTotal: number;
  workflowStatus: string;
  branchManagerRemarks?: string;
  customer?: { name?: string; phone?: string };
  salespersonName?: string;
}

interface Props {
  activeUser: UserProfile;
  currencySymbol: string;
}

export const CashierDiscountRequestView: React.FC<Props> = ({ activeUser, currencySymbol }) => {
  const [invoices, setInvoices] = useState<CandidateInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/invoice-workflow/cashier-discount-candidates');
      if (!response.ok) throw new Error(await response.text());
      setInvoices(await response.json());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load invoices.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const selected = invoices.find((invoice) => invoice.id === selectedId);

  const requestDiscount = async () => {
    if (!selected) return;
    const response = await fetch(`/api/invoice-workflow/${selected.id}/request-manager-discount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestedByName: activeUser.name, remarks: remarks.trim() || null })
    });

    if (!response.ok) {
      setMessage(await response.text());
      return;
    }

    setMessage(`Additional discount approval requested for ${selected.invoiceNumber}. Manager will enter the discount.`);
    setSelectedId(null);
    setRemarks('');
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Percent className="w-6 h-6 text-violet-400" />
          <div>
            <h2 className="text-xl font-black text-white">Additional Discount Requests</h2>
            <p className="text-xs text-slate-400">Cashier flags the invoice. Branch Manager enters and approves the actual discount.</p>
          </div>
        </div>
        <button onClick={() => void load()} className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {message && <div className="p-3 rounded-xl bg-indigo-950/50 border border-indigo-500/30 text-xs text-indigo-200">{message}</div>}

      {loading ? (
        <div className="p-8 text-center text-slate-400">Loading invoices...</div>
      ) : invoices.length === 0 ? (
        <div className="p-10 text-center bg-slate-900 border border-slate-800 rounded-3xl text-slate-500">No invoices available for an additional discount request.</div>
      ) : (
        <div className="grid gap-4">
          {invoices.map((invoice) => {
            const rejected = invoice.workflowStatus === 'MANAGER_APPROVAL_REJECTED';
            const selectedInvoice = selectedId === invoice.id;
            return (
              <div key={invoice.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-white">{invoice.invoiceNumber}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${rejected ? 'bg-rose-950 text-rose-300' : 'bg-slate-800 text-slate-300'}`}>
                        {invoice.workflowStatus}
                      </span>
                    </div>
                    <div className="text-xs text-slate-300">{invoice.customer?.name || 'Customer'} · {invoice.customer?.phone || 'No phone'}</div>
                    <div className="text-[11px] text-slate-400">Salesperson: {invoice.salespersonName || '—'}</div>
                    <div className="text-[11px] text-slate-400">{formatDateTime(invoice.invoiceDate)}</div>
                    {rejected && <div className="text-[11px] text-rose-300 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{invoice.branchManagerRemarks || 'Previous request was rejected.'}</div>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-black text-white">{formatCurrency(invoice.grandTotal, currencySymbol)}</span>
                    <button onClick={() => setSelectedId(selectedInvoice ? null : invoice.id)} className="px-3 py-2 bg-violet-600 hover:bg-violet-500 rounded-xl text-xs font-bold text-white">
                      {selectedInvoice ? 'Close' : 'Request Additional Discount'}
                    </button>
                  </div>
                </div>

                {selectedInvoice && (
                  <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 gap-3">
                    <div className="p-3 rounded-xl bg-slate-800 text-xs text-slate-300">
                      <div className="text-violet-300 font-bold">Cashier does not enter a discount percentage.</div>
                      <div className="mt-1">This only sends the bill to the Branch Manager for approval.</div>
                    </div>
                    <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Reason / remarks for Manager (optional)" className="px-3 py-2 bg-slate-800 border border-violet-500/40 rounded-xl text-xs text-white" />
                    <button onClick={() => void requestDiscount()} className="px-4 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2">
                      <Send className="w-4 h-4" /> Send to Branch Manager
                    </button>
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
