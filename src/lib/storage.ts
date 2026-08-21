import {
  Product, Customer, PromoRule, Invoice, Expense, UserProfile, BusinessStoreDetails,
  StockAdjustment, DraftBill, AuditLog, ManagerDiscountApproval
} from '../types';
import {
  INITIAL_PROMOS, INITIAL_EXPENSES, INITIAL_USERS, INITIAL_STORE_DETAILS, INITIAL_AUDIT_LOGS
} from '../data/seedData';

// Business data is intentionally kept in React/module memory only.
// SQL Server/API is the authoritative source. sessionStorage is reserved for auth.
let products: Product[] = [];
let customers: Customer[] = [];
let invoices: Invoice[] = [];
let promos: PromoRule[] = [...INITIAL_PROMOS];
let expenses: Expense[] = [...INITIAL_EXPENSES];
let users: UserProfile[] = [...INITIAL_USERS];
let activeUserId = INITIAL_USERS[0]?.id || '';
let storeDetails: BusinessStoreDetails = { ...INITIAL_STORE_DETAILS };
let stockLogs: StockAdjustment[] = [];
let drafts: DraftBill[] = [];
let auditLogs: AuditLog[] = [...INITIAL_AUDIT_LOGS];
let managerDiscountApprovals: ManagerDiscountApproval[] = [];
let productServerAvailable = false;

export function setProductsFromServer(value: Product[]): void { products = [...value]; productServerAvailable = true; }
export function setCustomersFromServer(value: Customer[]): void { customers = [...value]; }
export function setInvoicesFromServer(value: Invoice[]): void { invoices = [...value]; }

function mapServerProduct(p: any): Product {
  return {
    id: p.id, sku: p.sku, barcode: p.sku, name: p.name, category: 'General',
    costPrice: Number(p.costPrice || 0), sellingPrice: Number(p.sellingPrice || 0), stock: Number(p.stock || 0),
    reorderLevel: Number(p.reorderLevel || 0), taxRate: Number(p.taxRate ?? p.gstRate ?? 0), unit: p.unit || 'PCS',
    hsnCode: p.hsnCode, updatedAt: new Date().toISOString(), isActive: p.isActive !== false
  } as Product;
}

function normalizeProductResponse(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.value)) return payload.value;
  return [];
}

export async function hydrateProductsFromServer(): Promise<void> {
  const response = await fetch('/api/products?page=1&pageSize=100');
  if (!response.ok) throw new Error(`Product API HTTP ${response.status}`);
  const rows = normalizeProductResponse(await response.json());
  if (!rows.length) { setProductsFromServer([]); return; }
  setProductsFromServer(rows.map(mapServerProduct));
  console.info(`SQL Server product working set ready: ${products.length} products.`);
}

export const Storage = {
  getProducts(): Product[] { return [...products]; },
  saveProducts(value: Product[]): void { products = [...value]; if (productServerAvailable) void syncProducts(value); },
  getCustomers(): Customer[] { return [...customers]; },
  saveCustomers(value: Customer[]): void { customers = [...value]; },
  getPromos(): PromoRule[] { return [...promos]; },
  savePromos(value: PromoRule[]): void { promos = [...value]; },
  getInvoices(): Invoice[] { return [...invoices]; },
  saveInvoices(value: Invoice[]): void { invoices = [...value]; },
  getExpenses(): Expense[] { return [...expenses]; },
  saveExpenses(value: Expense[]): void { expenses = [...value]; },
  getUsers(): UserProfile[] { return [...users]; },
  saveUsers(value: UserProfile[]): void { users = [...value]; },
  getActiveUserId(): string { return activeUserId; },
  saveActiveUserId(id: string): void { activeUserId = id; },
  getStoreDetails(): BusinessStoreDetails { return { ...storeDetails }; },
  saveStoreDetails(value: BusinessStoreDetails): void { storeDetails = { ...value }; },
  getStockLogs(): StockAdjustment[] { return [...stockLogs]; },
  saveStockLogs(value: StockAdjustment[]): void { stockLogs = [...value]; },
  getDrafts(): DraftBill[] { return [...drafts]; },
  saveDrafts(value: DraftBill[]): void { drafts = [...value]; },
  getManagerDiscountApprovals(): ManagerDiscountApproval[] { return [...managerDiscountApprovals]; },
  saveManagerDiscountApprovals(value: ManagerDiscountApproval[]): void { managerDiscountApprovals = [...value]; },
  getPendingManagerDiscountApprovals(): ManagerDiscountApproval[] { return managerDiscountApprovals.filter(x => x.status === 'PENDING'); },
  getAuditLogs(): AuditLog[] { return [...auditLogs]; },
  saveAuditLogs(value: AuditLog[]): void { auditLogs = [...value]; },
  resetToDefaultSeed(): void {
    products = []; customers = []; invoices = [];
    promos = [...INITIAL_PROMOS]; expenses = [...INITIAL_EXPENSES]; users = [...INITIAL_USERS];
    activeUserId = INITIAL_USERS[0]?.id || ''; storeDetails = { ...INITIAL_STORE_DETAILS };
    stockLogs = []; drafts = []; auditLogs = [...INITIAL_AUDIT_LOGS]; managerDiscountApprovals = [];
    productServerAvailable = false;
  }
};

async function syncProducts(value: Product[]): Promise<void> {
  try {
    const response = await fetch('/api/products/sync', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value.map(p => ({ id: p.id, sku: p.sku, name: p.name, hsnCode: p.hsnCode,
        unit: p.unit, costPrice: p.costPrice, sellingPrice: p.sellingPrice, stock: p.stock,
        reorderLevel: p.reorderLevel, taxRate: p.taxRate })))
    });
    if (!response.ok) console.error(`Product sync HTTP ${response.status}`);
  } catch (error) { console.error('Product server sync failed.', error); }
}
