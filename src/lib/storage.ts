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

type ServerProduct = {
  id: string;
  sku: string;
  name: string;
  hsnCode?: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  reorderLevel: number;
  taxRate: number;
  isActive: boolean;
};

type ProductApiResponse = ServerProduct[] | { value?: ServerProduct[]; count?: number; Count?: number };

function normalizeProductResponse(payload: ProductApiResponse): ServerProduct[] {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.value)) return payload.value;
  return [];
}

function productPayload(products: Product[]) {
  return products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    hsnCode: p.hsnCode,
    unit: p.unit,
    costPrice: p.costPrice,
    sellingPrice: p.sellingPrice,
    stock: p.stock,
    reorderLevel: p.reorderLevel,
    taxRate: p.taxRate
  }));
}

function mergeServerProducts(serverProducts: ServerProduct[]): Product[] {
  const existingById = new Map(INITIAL_PRODUCTS.map((p) => [p.id, p]));
  const existingBySku = new Map(INITIAL_PRODUCTS.map((p) => [p.sku, p]));

  return serverProducts.map((p) => {
    const existing = existingById.get(p.id) || existingBySku.get(p.sku);
    return {
      ...(existing || {} as Product),
      id: p.id,
      sku: p.sku,
      name: p.name,
      barcode: existing?.barcode || p.sku,
      category: existing?.category || 'General',
      costPrice: Number(p.costPrice),
      sellingPrice: Number(p.sellingPrice),
      stock: Number(p.stock),
      reorderLevel: Number(p.reorderLevel),
      taxRate: Number(p.taxRate),
      unit: p.unit,
      hsnCode: p.hsnCode,
      updatedAt: new Date().toISOString(),
      isActive: p.isActive
    } as Product;
  });
}

async function createMissingSeedProducts(serverProducts: ServerProduct[]): Promise<ServerProduct[]> {
  const existingSkus = new Set(serverProducts.map((p) => p.sku.trim().toUpperCase()));
  const missing = INITIAL_PRODUCTS.filter((p) => !existingSkus.has(p.sku.trim().toUpperCase()));

  if (missing.length === 0) return serverProducts;

  for (const product of missing) {
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: null,
        sku: product.sku,
        name: product.name,
        hsnCode: product.hsnCode,
        unit: product.unit,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        stock: product.stock,
        reorderLevel: product.reorderLevel,
        gstRate: product.taxRate,
        isActive: true
      })
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      throw new Error(`Product seed reconciliation HTTP ${response.status}${details ? `: ${details}` : ''}`);
    }
  }

  const refreshed = await fetch('/api/products');
  if (!refreshed.ok) throw new Error(`Product refresh HTTP ${refreshed.status}`);
  return normalizeProductResponse(await refreshed.json() as ProductApiResponse);
}

let productServerAvailable = false;

async function hydrateProductsFromServer(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error(`Product API HTTP ${response.status}`);

    const payload = await response.json() as ProductApiResponse;
    let serverProducts = normalizeProductResponse(payload);

    if (serverProducts.length === 0) {
      const syncResponse = await fetch('/api/products/sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productPayload(INITIAL_PRODUCTS))
      });

      if (!syncResponse.ok) {
        const details = await syncResponse.text().catch(() => '');
        throw new Error(`Product migration HTTP ${syncResponse.status}${details ? `: ${details}` : ''}`);
      }

      serverProducts = normalizeProductResponse(await syncResponse.json() as ProductApiResponse);
    } else {
      // Reconcile only missing SKUs. Existing SQL products are never overwritten by startup hydration.
      serverProducts = await createMissingSeedProducts(serverProducts);
    }

    if (serverProducts.length === 0) {
      throw new Error('Product migration returned an empty catalog.');
    }

    setStorageItem(KEYS.PRODUCTS, mergeServerProducts(serverProducts));
    productServerAvailable = true;
    console.info(`SQL Server product catalog ready: ${serverProducts.length} products.`);
  } catch (error) {
    productServerAvailable = false;
    console.warn('Product API unavailable; retaining existing local product cache.', error);
  }
}

function syncProducts(products: Product[]): void {
  if (!productServerAvailable) return;

  void fetch('/api/products/sync', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productPayload(products))
  }).catch((error) => {
    productServerAvailable = false;
    console.error('Product server sync failed:', error);
  });
}

export const Storage = {
  getProducts(): Product[] { return getStorageItem<Product[]>(KEYS.PRODUCTS, INITIAL_PRODUCTS); },
  saveProducts(products: Product[]): void { setStorageItem(KEYS.PRODUCTS, products); syncProducts(products); },

  getCustomers(): Customer[] { return getStorageItem<Customer[]>(KEYS.CUSTOMERS, INITIAL_CUSTOMERS); },
  saveCustomers(customers: Customer[]): void { setStorageItem(KEYS.CUSTOMERS, customers); },

  getPromos(): PromoRule[] { return getStorageItem<PromoRule[]>(KEYS.PROMOS, INITIAL_PROMOS); },
  savePromos(promos: PromoRule[]): void { setStorageItem(KEYS.PROMOS, promos); },

  getInvoices(): Invoice[] { return getStorageItem<Invoice[]>(KEYS.INVOICES, INITIAL_INVOICES); },
  saveInvoices(invoices: Invoice[]): void { setStorageItem(KEYS.INVOICES, invoices); },

  getExpenses(): Expense[] { return getStorageItem<Expense[]>(KEYS.EXPENSES, INITIAL_EXPENSES); },
  saveExpenses(expenses: Expense[]): void { setStorageItem(KEYS.EXPENSES, expenses); },

  getUsers(): UserProfile[] { return getStorageItem<UserProfile[]>(KEYS.USERS, INITIAL_USERS); },
  saveUsers(users: UserProfile[]): void { setStorageItem(KEYS.USERS, users); },

  getActiveUserId(): string { return getStorageItem<string>(KEYS.ACTIVE_USER_ID, INITIAL_USERS[0].id); },
  saveActiveUserId(id: string): void { setStorageItem(KEYS.ACTIVE_USER_ID, id); },

  getStoreDetails(): BusinessStoreDetails { return getStorageItem<BusinessStoreDetails>(KEYS.STORE_DETAILS, INITIAL_STORE_DETAILS); },
  saveStoreDetails(details: BusinessStoreDetails): void { setStorageItem(KEYS.STORE_DETAILS, details); },

  getStockLogs(): StockAdjustment[] { return getStorageItem<StockAdjustment[]>(KEYS.STOCK_LOGS, []); },
  saveStockLogs(logs: StockAdjustment[]): void { setStorageItem(KEYS.STOCK_LOGS, logs); },

  getDrafts(): DraftBill[] { return getStorageItem<DraftBill[]>(KEYS.DRAFTS, []); },
  saveDrafts(drafts: DraftBill[]): void { setStorageItem(KEYS.DRAFTS, drafts); },

  getAuditLogs(): AuditLog[] { return getStorageItem<AuditLog[]>(KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS); },
  saveAuditLogs(logs: AuditLog[]): void { setStorageItem(KEYS.AUDIT_LOGS, logs); },

  resetToDefaultSeed(): void {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
    void hydrateProductsFromServer();
  }
};

void hydrateProductsFromServer();
