import {
  Product, Customer, PromoRule, Invoice, Expense, UserProfile, BusinessStoreDetails,
  StockAdjustment, DraftBill, AuditLog, ManagerDiscountApproval
} from '../types';
import { INITIAL_STORE_DETAILS } from '../data/seedData';

// Legacy compatibility state only. Business persistence belongs to the SQL Server APIs.
// sessionStorage is reserved for authentication/session data.
let products: Product[] = [];
let customers: Customer[] = [];
let invoices: Invoice[] = [];
let promos: PromoRule[] = [];
let expenses: Expense[] = [];
let users: UserProfile[] = [];
let activeUserId = '';
let storeDetails: BusinessStoreDetails = { ...INITIAL_STORE_DETAILS };
let stockLogs: StockAdjustment[] = [];
let drafts: DraftBill[] = [];
let auditLogs: AuditLog[] = [];
let managerDiscountApprovals: ManagerDiscountApproval[] = [];

export function setProductsFromServer(value: Product[]): void { products = [...value]; }
export function setCustomersFromServer(value: Customer[]): void { customers = [...value]; }
export function setInvoicesFromServer(value: Invoice[]): void { invoices = [...value]; }
export function setPromosFromServer(value: PromoRule[]): void { promos = [...value]; }

function mapServerProduct(p: any): Product {
  return {
    id: p.id, sku: p.sku, barcode: p.barcode || p.sku, name: p.name, category: p.category || 'General',
    costPrice: Number(p.costPrice || 0), sellingPrice: Number(p.sellingPrice || 0), stock: Number(p.stock || 0),
    reorderLevel: Number(p.reorderLevel || 0), taxRate: Number(p.taxRate ?? p.gstRate ?? 0), unit: p.unit || 'PCS',
    hsnCode: p.hsnCode, description: p.description, imageUrl: p.imageUrl, updatedAt: p.updatedAtUtc || new Date().toISOString(), isActive: p.isActive !== false,
    tileDimensions: p.tileDimensions, pcsPerBox: p.pcsPerBox, sqftPerBox: p.sqftPerBox, tileFinish: p.tileFinish, tileType: p.tileType,
    batchNo: p.batchNo, pricePerSqFt: p.pricePerSqFt, weightPerBoxKg: p.weightPerBoxKg
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
  setProductsFromServer(rows.map(mapServerProduct));
  console.info(`SQL Server product working set ready: ${products.length} products.`);
}

export const Storage = {
  getProducts(): Product[] { return [...products]; },
  // Intentionally memory-only. Product persistence must go through the authenticated API.
  saveProducts(value: Product[]): void { products = [...value]; },
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
    products = []; customers = []; invoices = []; promos = []; expenses = []; users = [];
    activeUserId = ''; storeDetails = { ...INITIAL_STORE_DETAILS };
    stockLogs = []; drafts = []; auditLogs = []; managerDiscountApprovals = [];
  }
};
