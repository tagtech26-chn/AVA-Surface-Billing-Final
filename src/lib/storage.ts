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

type ServerEntity = keyof typeof KEYS;
const ENTITY_NAMES: Partial<Record<ServerEntity, string>> = {
  PRODUCTS: 'products', CUSTOMERS: 'customers', PROMOS: 'promos', INVOICES: 'invoices',
  EXPENSES: 'expenses', USERS: 'users', STORE_DETAILS: 'storeDetails', STOCK_LOGS: 'stockLogs',
  DRAFTS: 'drafts', AUDIT_LOGS: 'auditLogs'
};

let serverHydrated = false;
let serverAvailable = true;

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

function syncEntity<T>(entity: ServerEntity, value: T): void {
  const name = ENTITY_NAMES[entity];
  if (!serverHydrated || !serverAvailable || !name) return;

  void fetch(`/api/data/${name}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: value })
  }).catch((error) => {
    serverAvailable = false;
    console.error(`Server sync failed for ${name}:`, error);
  });
}

async function fetchEntity<T>(name: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`/api/data/${name}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as { data: T };
    return payload.data;
  } catch (error) {
    serverAvailable = false;
    console.warn(`Server data unavailable for ${name}; using local cache.`, error);
    return fallback;
  }
}

async function hydrateServerCache(): Promise<void> {
  if (typeof window === 'undefined' || sessionStorage.getItem('avasurface_server_hydrated') === '1') return;

  try {
    const [products, customers, promos, invoices, expenses, users, storeDetails, stockLogs, drafts, auditLogs] = await Promise.all([
      fetchEntity('products', INITIAL_PRODUCTS),
      fetchEntity('customers', INITIAL_CUSTOMERS),
      fetchEntity('promos', INITIAL_PROMOS),
      fetchEntity('invoices', INITIAL_INVOICES),
      fetchEntity('expenses', INITIAL_EXPENSES),
      fetchEntity('users', INITIAL_USERS),
      fetchEntity('storeDetails', INITIAL_STORE_DETAILS),
      fetchEntity<StockAdjustment[]>('stockLogs', []),
      fetchEntity<DraftBill[]>('drafts', []),
      fetchEntity('auditLogs', INITIAL_AUDIT_LOGS)
    ]);

    if (!serverAvailable) return;

    setStorageItem(KEYS.PRODUCTS, products);
    setStorageItem(KEYS.CUSTOMERS, customers);
    setStorageItem(KEYS.PROMOS, promos);
    setStorageItem(KEYS.INVOICES, invoices);
    setStorageItem(KEYS.EXPENSES, expenses);
    setStorageItem(KEYS.USERS, users);
    setStorageItem(KEYS.STORE_DETAILS, storeDetails);
    setStorageItem(KEYS.STOCK_LOGS, stockLogs);
    setStorageItem(KEYS.DRAFTS, drafts);
    setStorageItem(KEYS.AUDIT_LOGS, auditLogs);

    serverHydrated = true;
    sessionStorage.setItem('avasurface_server_hydrated', '1');

    // The first load may have rendered cached/demo data. Reload once so React
    // initializes from the server snapshot without requiring a broad UI rewrite.
    if (window.location.pathname !== '/health') window.location.reload();
  } catch (error) {
    console.warn('Server hydration skipped:', error);
  }
}

export const Storage = {
  async hydrateFromServer(): Promise<void> {
    await hydrateServerCache();
  },

  getProducts(): Product[] { return getStorageItem<Product[]>(KEYS.PRODUCTS, INITIAL_PRODUCTS); },
  saveProducts(products: Product[]): void { setStorageItem(KEYS.PRODUCTS, products); syncEntity('PRODUCTS', products); },

  getCustomers(): Customer[] { return getStorageItem<Customer[]>(KEYS.CUSTOMERS, INITIAL_CUSTOMERS); },
  saveCustomers(customers: Customer[]): void { setStorageItem(KEYS.CUSTOMERS, customers); syncEntity('CUSTOMERS', customers); },

  getPromos(): PromoRule[] { return getStorageItem<PromoRule[]>(KEYS.PROMOS, INITIAL_PROMOS); },
  savePromos(promos: PromoRule[]): void { setStorageItem(KEYS.PROMOS, promos); syncEntity('PROMOS', promos); },

  getInvoices(): Invoice[] { return getStorageItem<Invoice[]>(KEYS.INVOICES, INITIAL_INVOICES); },
  saveInvoices(invoices: Invoice[]): void { setStorageItem(KEYS.INVOICES, invoices); syncEntity('INVOICES', invoices); },

  getExpenses(): Expense[] { return getStorageItem<Expense[]>(KEYS.EXPENSES, INITIAL_EXPENSES); },
  saveExpenses(expenses: Expense[]): void { setStorageItem(KEYS.EXPENSES, expenses); syncEntity('EXPENSES', expenses); },

  getUsers(): UserProfile[] { return getStorageItem<UserProfile[]>(KEYS.USERS, INITIAL_USERS); },
  saveUsers(users: UserProfile[]): void { setStorageItem(KEYS.USERS, users); syncEntity('USERS', users); },

  getActiveUserId(): string { return getStorageItem<string>(KEYS.ACTIVE_USER_ID, INITIAL_USERS[0].id); },
  saveActiveUserId(id: string): void { setStorageItem(KEYS.ACTIVE_USER_ID, id); },

  getStoreDetails(): BusinessStoreDetails { return getStorageItem<BusinessStoreDetails>(KEYS.STORE_DETAILS, INITIAL_STORE_DETAILS); },
  saveStoreDetails(details: BusinessStoreDetails): void { setStorageItem(KEYS.STORE_DETAILS, details); syncEntity('STORE_DETAILS', details); },

  getStockLogs(): StockAdjustment[] { return getStorageItem<StockAdjustment[]>(KEYS.STOCK_LOGS, []); },
  saveStockLogs(logs: StockAdjustment[]): void { setStorageItem(KEYS.STOCK_LOGS, logs); syncEntity('STOCK_LOGS', logs); },

  getDrafts(): DraftBill[] { return getStorageItem<DraftBill[]>(KEYS.DRAFTS, []); },
  saveDrafts(drafts: DraftBill[]): void { setStorageItem(KEYS.DRAFTS, drafts); syncEntity('DRAFTS', drafts); },

  getAuditLogs(): AuditLog[] { return getStorageItem<AuditLog[]>(KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS); },
  saveAuditLogs(logs: AuditLog[]): void { setStorageItem(KEYS.AUDIT_LOGS, logs); syncEntity('AUDIT_LOGS', logs); },

  resetToDefaultSeed(): void {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
    sessionStorage.removeItem('avasurface_server_hydrated');
    void fetch('/api/data/bootstrap', { method: 'POST' }).catch(() => undefined);
  }
};

// Start server hydration as soon as the browser loads the data layer.
void hydrateServerCache();
