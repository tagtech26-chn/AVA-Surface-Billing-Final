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
const persistedDraftIds = new Set<string>();

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

function mapDraft(row: any): DraftBill {
  try {
    const payload = typeof row.payloadJson === 'string' ? JSON.parse(row.payloadJson) : row.payloadJson;
    if (payload && typeof payload === 'object') {
      return {
        ...payload,
        id: row.id,
        createdAt: row.createdAtUtc,
        customerType: row.customerType || payload.customerType || 'NORMAL',
        savedBy: row.savedBy || payload.savedBy || '',
        totalAmount: Number(row.totalAmount ?? payload.totalAmount ?? 0),
        totalWeightKg: Number(row.totalWeightKg ?? payload.totalWeightKg ?? 0)
      } as DraftBill;
    }
  } catch {
    // Preserve an empty-but-valid draft rather than falling back to local data.
  }
  return {
    id: row.id,
    createdAt: row.createdAtUtc,
    customer: undefined,
    customerType: row.customerType || 'NORMAL',
    cartItems: [],
    notes: undefined,
    savedBy: row.savedBy || '',
    totalAmount: Number(row.totalAmount || 0),
    totalWeightKg: Number(row.totalWeightKg || 0)
  };
}

export async function hydrateProductsFromServer(): Promise<void> {
  const response = await fetch('/api/products?page=1&pageSize=100');
  if (!response.ok) throw new Error(`Product API HTTP ${response.status}`);
  const rows = normalizeProductResponse(await response.json());
  setProductsFromServer(rows.map(mapServerProduct));
  console.info(`SQL Server product working set ready: ${products.length} products.`);
}

export async function hydrateDraftsFromServer(): Promise<void> {
  const response = await fetch('/api/drafts');
  if (!response.ok) throw new Error(`Draft API HTTP ${response.status}`);
  const rows = await response.json();
  drafts = Array.isArray(rows) ? rows.map(mapDraft) : [];
  persistedDraftIds.clear();
  drafts.forEach((draft) => persistedDraftIds.add(draft.id));
  console.info(`SQL Server held-bill working set ready: ${drafts.length} drafts.`);
}

function persistDraftsToServer(next: DraftBill[], previous: DraftBill[]): void {
  const previousIds = new Set(previous.map((draft) => draft.id));
  const nextIds = new Set(next.map((draft) => draft.id));

  for (const draft of next) {
    if (!persistedDraftIds.has(draft.id)) {
      const payload = JSON.stringify(draft);
      void fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: draft.id,
          customerId: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(draft.customer?.id || '') ? draft.customer?.id : null,
          customerName: draft.customer?.name || null,
          customerPhone: draft.customer?.phone || null,
          customerType: draft.customerType,
          payloadJson: payload,
          savedBy: draft.savedBy,
          totalAmount: draft.totalAmount,
          totalWeightKg: draft.totalWeightKg,
          createdAtUtc: draft.createdAt
        })
      }).then((response) => {
        if (!response.ok) throw new Error(`Draft API HTTP ${response.status}`);
        persistedDraftIds.add(draft.id);
      }).catch((error) => {
        console.error('Draft save failed:', error);
      });
    }
  }

  for (const draft of previous) {
    if (previousIds.has(draft.id) && !nextIds.has(draft.id) && persistedDraftIds.has(draft.id)) {
      void fetch(`/api/drafts/${encodeURIComponent(draft.id)}`, { method: 'DELETE' })
        .then((response) => {
          if (!response.ok && response.status !== 404) throw new Error(`Draft delete HTTP ${response.status}`);
          persistedDraftIds.delete(draft.id);
        })
        .catch((error) => console.error('Draft delete failed:', error));
    }
  }
}

export const Storage = {
  getProducts(): Product[] { return [...products]; },
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
  saveDrafts(value: DraftBill[]): void {
    const previous = [...drafts];
    drafts = [...value];
    persistDraftsToServer(drafts, previous);
  },
  getManagerDiscountApprovals(): ManagerDiscountApproval[] { return [...managerDiscountApprovals]; },
  saveManagerDiscountApprovals(value: ManagerDiscountApproval[]): void { managerDiscountApprovals = [...value]; },
  getPendingManagerDiscountApprovals(): ManagerDiscountApproval[] { return managerDiscountApprovals.filter(x => x.status === 'PENDING'); },
  getAuditLogs(): AuditLog[] { return [...auditLogs]; },
  saveAuditLogs(value: AuditLog[]): void { auditLogs = [...value]; },
  resetToDefaultSeed(): void {
    products = []; customers = []; invoices = []; promos = []; expenses = []; users = [];
    activeUserId = ''; storeDetails = { ...INITIAL_STORE_DETAILS };
    stockLogs = []; drafts = []; auditLogs = []; managerDiscountApprovals = [];
    persistedDraftIds.clear();
  }
};
