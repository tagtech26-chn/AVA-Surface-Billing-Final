import React, { useCallback, useEffect, useState } from 'react';
import { Expense, Invoice, Product } from '../types';
import { FinancialDashboardView } from './FinancialDashboardView';

interface Props {
  invoices: Invoice[];
  products: Product[];
  currencySymbol: string;
}

export const DbFinancialDashboardView: React.FC<Props> = ({ invoices, products, currencySymbol }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    const response = await fetch('/api/expenses');
    if (!response.ok) throw new Error(`Expense API HTTP ${response.status}`);
    const rows = await response.json() as Array<{
      id: string; title: string; category: Expense['category']; amount: number; expenseDate: string;
      paidTo: string; paymentMethod: Expense['paymentMethod']; recordedBy: string; receiptNumber?: string | null; notes?: string | null;
    }>;
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
    setLoading(false);
  }, []);

  useEffect(() => { void loadExpenses().catch((error) => { console.error('Expense load failed:', error); setLoading(false); }); }, [loadExpenses]);

  const addExpense = async (expense: Expense) => {
    const response = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: expense.title,
        category: expense.category,
        amount: expense.amount,
        date: expense.date,
        paidTo: expense.paidTo,
        paymentMethod: expense.paymentMethod,
        recordedBy: expense.recordedBy,
        receiptNumber: expense.receiptNumber || null,
        notes: expense.notes || null
      })
    });
    if (!response.ok) throw new Error(await response.text() || `Expense save failed (${response.status})`);
    const saved = await response.json();
    setExpenses((prev) => [{
      id: saved.id,
      title: saved.title,
      category: saved.category,
      amount: Number(saved.amount),
      date: saved.expenseDate,
      paidTo: saved.paidTo,
      paymentMethod: saved.paymentMethod,
      recordedBy: saved.recordedBy,
      receiptNumber: saved.receiptNumber || undefined,
      notes: saved.notes || undefined
    }, ...prev]);
  };

  if (loading) return <div className="min-h-32 flex items-center justify-center text-slate-400 text-sm">Loading SQL Server financial data...</div>;

  return <FinancialDashboardView invoices={invoices} expenses={expenses} products={products} onAddExpense={addExpense} currencySymbol={currencySymbol} />;
};
