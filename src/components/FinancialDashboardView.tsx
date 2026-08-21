import React from 'react';
import { Expense, Invoice, Product } from '../types';
import { DbFinancialDashboardView } from './DbFinancialDashboardView';

interface FinancialDashboardViewProps {
  invoices: Invoice[];
  expenses: Expense[];
  products: Product[];
  onAddExpense: (expense: Expense) => void;
  currencySymbol: string;
}

/**
 * Compatibility wrapper retained for App.tsx.
 * Business expense data is loaded from SQL Server by DbFinancialDashboardView;
 * the legacy expenses/onAddExpense props are intentionally ignored.
 */
export const FinancialDashboardView: React.FC<FinancialDashboardViewProps> = ({
  invoices,
  products,
  currencySymbol
}) => (
  <DbFinancialDashboardView
    invoices={invoices}
    products={products}
    currencySymbol={currencySymbol}
  />
);
