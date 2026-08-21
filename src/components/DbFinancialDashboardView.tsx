import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Expense, Invoice, Product } from '../types';

interface Props {
  invoices: Invoice[];
  products: Product[];
  currencySymbol: string;
}

type ExpenseRow = {
  id: string;
  title: string;
  category: Expense['category'];
  amount: number;
  expenseDate: string;
  paidTo: string;
  paymentMethod: Expense['paymentMethod'];
  recordedBy: string;
  receiptNumber?: string | null;
  notes?: string | null;
};

export const DbFinancialDashboardView: React.FC<Props> = ({ invoices, products, currencySymbol }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [paidTo, setPaidTo] = useState('');
  const [category, setCategory] = useState<Expense['category']>('UTILITIES');
  const [paymentMethod, setPaymentMethod] = useState<Expense['paymentMethod']>('CARD');

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/expenses');
      if (!response.ok) throw new Error(`Expense API HTTP ${response.status}`);
      const rows = await response.json() as ExpenseRow[];
      setExpenses(rows.map((row) => ({
        id: row.id,
        title: row.title,
        category: row.category,
        amount: Number(row.amount),
        date: row.expenseDate,
        paidTo: row.paidTo,
        paymentMethod: row.paymentMethod,
        recordedBy: row.recordedBy,
        receiptNumber: row.receiptNumber || undefined,
        notes: row.notes || undefined
      })));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to load expenses.';
      setError(message);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadExpenses(); }, [loadExpenses]);

  const metrics = useMemo(() => {
    const revenue = invoices.reduce((sum, invoice) => sum + Number(invoice.grandTotal || 0), 0);
    const expenseTotal = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const cogs = invoices.reduce((sum, invoice) => sum + invoice.items.reduce((itemSum, item) => itemSum + Number(item.product.costPrice || 0) * Number(item.quantity || 0), 0), 0);
    const outstanding = invoices.filter((invoice) => invoice.status === 'UNPAID' || invoice.status === 'PARTIAL').reduce((sum, invoice) => sum + Math.max(0, Number(invoice.grandTotal || 0) - Number(invoice.amountPaid || 0)), 0);
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - expenseTotal;
    return { revenue, expenseTotal, grossProfit, netProfit, outstanding };
  }, [expenses, invoices]);

  const submitExpense = async (event: React.FormEvent) => {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!title.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) return;
    const response = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        category,
        amount: numericAmount,
        date: new Date().toISOString().slice(0, 10),
        paidTo: paidTo.trim() || 'Vendor',
        paymentMethod,
        recordedBy: 'Authenticated User'
      })
    });
    if (!response.ok) throw new Error(await response.text() || `Expense save failed (${response.status})`);
    await loadExpenses();
    setTitle('');
    setAmount('');
    setPaidTo('');
  };

  if (loading) return <div className="min-h-32 flex items-center justify-center text-slate-400 text-sm">Loading SQL Server financial data...</div>;

  return (
    <div className="space-y-6">
      {error && <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">Financial data error: {error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-xs font-bold uppercase text-slate-400">Total Revenue</p><p className="mt-2 text-2xl font-black text-white">{currencySymbol}{metrics.revenue.toFixed(2)}</p></div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-xs font-bold uppercase text-slate-400">Total Expenses</p><p className="mt-2 text-2xl font-black text-rose-400">{currencySymbol}{metrics.expenseTotal.toFixed(2)}</p></div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-xs font-bold uppercase text-slate-400">Net Profit</p><p className="mt-2 text-2xl font-black text-emerald-400">{currencySymbol}{metrics.netProfit.toFixed(2)}</p></div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-xs font-bold uppercase text-slate-400">Pending AR</p><p className="mt-2 text-2xl font-black text-amber-400">{currencySymbol}{metrics.outstanding.toFixed(2)}</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="text-base font-bold text-white">Log Expense</h3>
          <form className="mt-4 space-y-3" onSubmit={(event) => { void submitExpense(event).catch((cause) => setError(cause instanceof Error ? cause.message : 'Expense save failed.')); }}>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Expense title" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            <div className="grid grid-cols-2 gap-3">
              <input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="0.01" step="0.01" placeholder="Amount" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
              <input value={paidTo} onChange={(event) => setPaidTo(event.target.value)} placeholder="Paid to" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select value={category} onChange={(event) => setCategory(event.target.value as Expense['category'])} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="UTILITIES">Utilities</option><option value="RENT">Rent</option><option value="SALARIES">Salaries</option><option value="TRANSPORT">Transport</option><option value="MARKETING">Marketing</option><option value="OTHER">Other</option></select>
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as Expense['paymentMethod'])} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="CASH">Cash</option><option value="CARD">Card</option><option value="BANK_TRANSFER">Bank Transfer</option><option value="UPI">UPI</option></select>
            </div>
            <button type="submit" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500">Save Expense</button>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between"><h3 className="text-base font-bold text-white">Recent Expenses</h3><button type="button" onClick={() => void loadExpenses()} className="text-xs font-semibold text-indigo-400">Refresh</button></div>
          <div className="mt-4 max-h-80 overflow-auto space-y-2">
            {expenses.length === 0 ? <p className="text-sm text-slate-500">No expenses in SQL Server.</p> : expenses.slice(0, 20).map((expense) => <div key={expense.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-3 py-2"><div><p className="text-sm font-semibold text-white">{expense.title}</p><p className="text-xs text-slate-500">{expense.paidTo} · {expense.date}</p></div><p className="text-sm font-bold text-rose-300">{currencySymbol}{Number(expense.amount).toFixed(2)}</p></div>)}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p className="text-xs text-slate-400">Inventory products available: {products.length}</p><p className="mt-1 text-xs text-slate-500">Financial dashboard is now rendered directly; it no longer recursively renders itself.</p></div>
    </div>
  );
};
