import { UserRole } from '../types';

export function formatCurrency(amount: number, symbol = '$'): string {
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateString: string): string {
  try { return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return dateString; }
}

export function formatDateTime(dateString: string): string {
  try { return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return dateString; }
}

export function generateInvoiceNumber(existingCount: number): string {
  return `INV-${new Date().getFullYear()}-${1000 + existingCount + 1}`;
}

export function generateId(prefix = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function canPerformAction(
  role: UserRole,
  action: 'MANAGE_USERS' | 'MANAGE_PRODUCTS' | 'STOCK_ADJUSTMENT' | 'MANAGE_PROMOS' | 'CREATE_POS_BILL' | 'MANAGE_EXPENSES' | 'VIEW_FINANCIAL_REPORTS' | 'PROCESS_REFUND' | 'MANAGE_WAREHOUSE' | 'EXPORT_TALLY' | 'MANAGE_EWAY_INVOICE' | 'VIEW_AUDIT_LOGS' | 'APPROVE_BRANCH_MANAGER_DISCOUNT' | 'CONFIRM_PAYMENTS' | 'REQUEST_MANAGER_DISCOUNT' | 'VIEW_ALL_INVOICES' | 'VIEW_PENDING_MANAGER_APPROVALS'
): boolean {
  switch (role) {
    case 'ADMIN': return ['MANAGE_USERS','MANAGE_PRODUCTS','STOCK_ADJUSTMENT','MANAGE_PROMOS','VIEW_FINANCIAL_REPORTS','PROCESS_REFUND','MANAGE_WAREHOUSE','EXPORT_TALLY','MANAGE_EWAY_INVOICE','VIEW_AUDIT_LOGS','VIEW_ALL_INVOICES','VIEW_PENDING_MANAGER_APPROVALS','APPROVE_BRANCH_MANAGER_DISCOUNT','CONFIRM_PAYMENTS'].includes(action);
    case 'MANAGER':
    case 'BRANCH_MANAGER': return ['MANAGE_PRODUCTS','MANAGE_PROMOS','VIEW_FINANCIAL_REPORTS','PROCESS_REFUND','VIEW_ALL_INVOICES','VIEW_PENDING_MANAGER_APPROVALS','APPROVE_BRANCH_MANAGER_DISCOUNT'].includes(action);
    case 'ACCOUNTANT': return ['VIEW_FINANCIAL_REPORTS','MANAGE_EXPENSES','EXPORT_TALLY','MANAGE_EWAY_INVOICE','VIEW_AUDIT_LOGS','CONFIRM_PAYMENTS','VIEW_ALL_INVOICES'].includes(action);
    case 'CASHIER': return ['CREATE_POS_BILL','MANAGE_PRODUCTS','VIEW_ALL_INVOICES'].includes(action);
    case 'BILLING_USER': return ['CREATE_POS_BILL','MANAGE_PRODUCTS','VIEW_ALL_INVOICES'].includes(action);
    case 'WAREHOUSE': return ['MANAGE_WAREHOUSE','MANAGE_PRODUCTS','STOCK_ADJUSTMENT','MANAGE_EWAY_INVOICE'].includes(action);
    default: return false;
  }
}

export function authHeaders(json = false): HeadersInit {
  const token = sessionStorage.getItem('avasurface_auth_token');
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}
