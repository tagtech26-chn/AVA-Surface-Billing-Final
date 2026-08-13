import { UserRole } from '../types';

export function formatCurrency(amount: number, symbol = '$'): string {
  return `${symbol}${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function formatDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
}

export function generateInvoiceNumber(existingCount: number): string {
  const nextNum = 1000 + existingCount + 1;
  return `INV-${new Date().getFullYear()}-${nextNum}`;
}

export function generateId(prefix = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

// Permission checking Matrix based on UserRole
export function canPerformAction(
  role: UserRole,
  action: 'MANAGE_USERS' | 'MANAGE_PRODUCTS' | 'STOCK_ADJUSTMENT' | 'MANAGE_PROMOS' | 'CREATE_POS_BILL' | 'MANAGE_EXPENSES' | 'VIEW_FINANCIAL_REPORTS' | 'PROCESS_REFUND' | 'MANAGE_WAREHOUSE' | 'EXPORT_TALLY' | 'MANAGE_EWAY_INVOICE' | 'VIEW_AUDIT_LOGS'
): boolean {
  switch (role) {
    case 'ADMIN':
      return true; // Admin can do everything
    case 'MANAGER':
      return action !== 'MANAGE_USERS'; // Manager can do everything except user management
    case 'ACCOUNTANT':
      return ['VIEW_FINANCIAL_REPORTS', 'MANAGE_EXPENSES', 'EXPORT_TALLY', 'MANAGE_EWAY_INVOICE', 'VIEW_AUDIT_LOGS'].includes(action);
    case 'CASHIER':
      return ['CREATE_POS_BILL', 'MANAGE_PRODUCTS'].includes(action);
    case 'WAREHOUSE':
      return ['MANAGE_WAREHOUSE', 'MANAGE_PRODUCTS', 'STOCK_ADJUSTMENT', 'MANAGE_EWAY_INVOICE'].includes(action);
    default:
      return false;
  }
}
