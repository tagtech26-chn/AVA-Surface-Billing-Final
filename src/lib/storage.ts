import {
  Product,
  Customer,
  PromoRule,
  Invoice,
  Expense,
  UserProfile,
  BusinessStoreDetails,
  StockAdjustment,
  DraftBill,
  AuditLog
} from '../types';
import {
  INITIAL_PRODUCTS,
  INITIAL_CUSTOMERS,
  INITIAL_PROMOS,
  INITIAL_INVOICES,
  INITIAL_EXPENSES,
  INITIAL_USERS,
  INITIAL_STORE_DETAILS,
  INITIAL_AUDIT_LOGS
} from '../data/seedData';

const KEYS = {
  PRODUCTS: 'bizflow_products_v1',
  CUSTOMERS: 'bizflow_customers_v1',
  PROMOS: 'bizflow_promos_v1',
  INVOICES: 'bizflow_invoices_v1',
  EXPENSES: 'bizflow_expenses_v1',
  USERS: 'bizflow_users_v1',
  ACTIVE_USER_ID: 'bizflow_active_user_id_v1',
  STORE_DETAILS: 'bizflow_store_details_v1',
  STOCK_LOGS: 'bizflow_stock_logs_v1',
  DRAFTS: 'bizflow_drafts_v1',
  AUDIT_LOGS: 'bizflow_audit_logs_v1'
};

function getStorageItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (err) {
    console.error(`Error reading ${key} from storage:`, err);
    return defaultValue;
  }
}

function setStorageItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error writing ${key} to storage:`, err);
  }
}

export const Storage = {
  getProducts(): Product[] {
    return getStorageItem<Product[]>(KEYS.PRODUCTS, INITIAL_PRODUCTS);
  },
  saveProducts(products: Product[]): void {
    setStorageItem(KEYS.PRODUCTS, products);
  },

  getCustomers(): Customer[] {
    return getStorageItem<Customer[]>(KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
  },
  saveCustomers(customers: Customer[]): void {
    setStorageItem(KEYS.CUSTOMERS, customers);
  },

  getPromos(): PromoRule[] {
    return getStorageItem<PromoRule[]>(KEYS.PROMOS, INITIAL_PROMOS);
  },
  savePromos(promos: PromoRule[]): void {
    setStorageItem(KEYS.PROMOS, promos);
  },

  getInvoices(): Invoice[] {
    return getStorageItem<Invoice[]>(KEYS.INVOICES, INITIAL_INVOICES);
  },
  saveInvoices(invoices: Invoice[]): void {
    setStorageItem(KEYS.INVOICES, invoices);
  },

  getExpenses(): Expense[] {
    return getStorageItem<Expense[]>(KEYS.EXPENSES, INITIAL_EXPENSES);
  },
  saveExpenses(expenses: Expense[]): void {
    setStorageItem(KEYS.EXPENSES, expenses);
  },

  getUsers(): UserProfile[] {
    return getStorageItem<UserProfile[]>(KEYS.USERS, INITIAL_USERS);
  },
  saveUsers(users: UserProfile[]): void {
    setStorageItem(KEYS.USERS, users);
  },

  getActiveUserId(): string {
    return getStorageItem<string>(KEYS.ACTIVE_USER_ID, INITIAL_USERS[0].id);
  },
  saveActiveUserId(id: string): void {
    setStorageItem(KEYS.ACTIVE_USER_ID, id);
  },

  getStoreDetails(): BusinessStoreDetails {
    return getStorageItem<BusinessStoreDetails>(KEYS.STORE_DETAILS, INITIAL_STORE_DETAILS);
  },
  saveStoreDetails(details: BusinessStoreDetails): void {
    setStorageItem(KEYS.STORE_DETAILS, details);
  },

  getStockLogs(): StockAdjustment[] {
    return getStorageItem<StockAdjustment[]>(KEYS.STOCK_LOGS, []);
  },
  saveStockLogs(logs: StockAdjustment[]): void {
    setStorageItem(KEYS.STOCK_LOGS, logs);
  },

  getDrafts(): DraftBill[] {
    return getStorageItem<DraftBill[]>(KEYS.DRAFTS, []);
  },
  saveDrafts(drafts: DraftBill[]): void {
    setStorageItem(KEYS.DRAFTS, drafts);
  },

  getAuditLogs(): AuditLog[] {
    return getStorageItem<AuditLog[]>(KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
  },
  saveAuditLogs(logs: AuditLog[]): void {
    setStorageItem(KEYS.AUDIT_LOGS, logs);
  },

  resetToDefaultSeed(): void {
    localStorage.removeItem(KEYS.PRODUCTS);
    localStorage.removeItem(KEYS.CUSTOMERS);
    localStorage.removeItem(KEYS.PROMOS);
    localStorage.removeItem(KEYS.INVOICES);
    localStorage.removeItem(KEYS.EXPENSES);
    localStorage.removeItem(KEYS.USERS);
    localStorage.removeItem(KEYS.ACTIVE_USER_ID);
    localStorage.removeItem(KEYS.STORE_DETAILS);
    localStorage.removeItem(KEYS.STOCK_LOGS);
    localStorage.removeItem(KEYS.DRAFTS);
    localStorage.removeItem(KEYS.AUDIT_LOGS);
  }
};
