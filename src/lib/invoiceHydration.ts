import { Invoice, PaymentMethod, Product, Customer, CartItem } from '../types';

const INVOICE_STORAGE_KEY = 'bizflow_invoices_v1';
const AUTH_TOKEN_KEY = 'avasurface_auth_token';

type ServerInvoice = {
  id: string; invoiceNumber: string; invoiceDate: string; salespersonName?: string; salespersonMobile?: string;
  subTotal?: number; subtotal?: number; discountAmount?: number; promoDiscountAmount?: number;
  branchManagerDiscountPercent?: number; branchManagerDiscountAmount?: number; branchManagerRemarks?: string;
  taxAmount?: number; taxableAmount?: number; cgstAmount?: number; sgstAmount?: number; igstAmount?: number; roundOffAmount?: number; grandTotal: number;
  status?: string; workflowStatus?: string; creditNoteAmount?: number; creditNoteReason?: string;
  paymentMethodRequested?: string; paymentMethodConfirmed?: string; paymentConfirmedAtUtc?: string; paymentSpecificReference?: string;
  customer?: { id: string; name?: string; phone?: string; email?: string; gstin?: string; billingAddress?: string; shippingAddress?: string; city?: string; state?: string; stateCode?: string };
  salesperson?: { id: string; name?: string; mobile?: string };
  lines?: Array<{ id: string; productId: string; quantity: number; unitPrice: number; discountPercent: number; discountAmount: number; taxableAmount: number; cgstAmount: number; sgstAmount: number; igstAmount: number; lineTotal: number; product?: { id: string; sku?: string; name?: string; unit?: string; hsnCode?: string; sellingPrice?: number; gstRate?: number; stock?: number; reorderLevel?: number } }>;
  payments?: Array<{ id: string; amount: number; method: string; reference?: string; paymentDateUtc?: string }>;
};

type InvoiceApiResponse = ServerInvoice[] | { items?: ServerInvoice[]; value?: ServerInvoice[]; count?: number; totalCount?: number };
const number = (value: unknown): number => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; };
const normalizeServerInvoices = (payload: InvoiceApiResponse): ServerInvoice[] => Array.isArray(payload) ? payload : Array.isArray(payload.items) ? payload.items : Array.isArray(payload.value) ? payload.value : [];

function mapCustomer(customer?: ServerInvoice['customer']): Customer | undefined {
  if (!customer) return undefined;
  return { id: customer.id, name: customer.name || 'Customer', phone: customer.phone || '', email: customer.email, gstNumber: customer.gstin, address: customer.billingAddress, billingAddress: customer.billingAddress, shippingAddress: customer.shippingAddress, city: customer.city, state: customer.state, stateCode: customer.stateCode, loyaltyPoints: 0, totalSpent: 0, outstandingBalance: 0 };
}
function mapLine(line: NonNullable<ServerInvoice['lines']>[number]): CartItem {
  const serverProduct = line.product;
  const product: Product = { id: line.productId, sku: serverProduct?.sku || line.productId, barcode: serverProduct?.sku || line.productId, name: serverProduct?.name || 'Item', category: 'General', costPrice: 0, sellingPrice: number(line.unitPrice), stock: number(serverProduct?.stock), reorderLevel: number(serverProduct?.reorderLevel), taxRate: number(serverProduct?.gstRate), unit: serverProduct?.unit || 'unit', hsnCode: serverProduct?.hsnCode, updatedAt: new Date().toISOString() };
  return { product, quantity: number(line.quantity), inputQuantity: number(line.quantity), selectedUnit: undefined, discountAmount: number(line.discountAmount), discountPercent: number(line.discountPercent), finalUnitPrice: number(line.unitPrice), totalPrice: number(line.lineTotal) };
}
function mapInvoice(source: ServerInvoice): Invoice {
  const payments = (source.payments || []).map((payment) => ({ id: payment.id, amount: number(payment.amount), method: (payment.method || source.paymentMethodConfirmed || source.paymentMethodRequested || 'CASH') as PaymentMethod, referenceNumber: payment.reference, date: payment.paymentDateUtc || new Date().toISOString() }));
  const amountPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const status = source.status === 'PAID' || source.workflowStatus === 'PAYMENT_CONFIRMED' || source.workflowStatus === 'COMPLETED' ? 'PAID' : amountPaid > 0 ? 'PARTIAL' : 'UNPAID';
  return {
    id: source.id, invoiceNumber: source.invoiceNumber, date: source.invoiceDate, customer: mapCustomer(source.customer), cashierName: 'Billing', cashierRole: 'BILLING_USER',
    salespersonName: source.salespersonName || source.salesperson?.name, salespersonMobile: source.salespersonMobile || source.salesperson?.mobile, items: (source.lines || []).map(mapLine),
    subtotal: number(source.subTotal ?? source.subtotal), itemDiscountsTotal: number(source.discountAmount), promoDiscountAmount: number(source.promoDiscountAmount),
    branchManagerDiscountPercent: number(source.branchManagerDiscountPercent), branchManagerDiscountAmount: number(source.branchManagerDiscountAmount), branchManagerRemarks: source.branchManagerRemarks, manualDiscountAmount: number(source.branchManagerDiscountAmount),
    taxTotal: number(source.taxableAmount ? number(source.cgstAmount) + number(source.sgstAmount) + number(source.igstAmount) : source.taxAmount), cgstAmount: number(source.cgstAmount), sgstAmount: number(source.sgstAmount), igstAmount: number(source.igstAmount), roundOffAmount: number(source.roundOffAmount), grandTotal: number(source.grandTotal),
    amountPaid, changeGiven: 0, status, paymentMethod: (source.paymentMethodConfirmed || source.paymentMethodRequested || 'CASH') as PaymentMethod, paymentsHistory: payments, deliveryStatus: 'PENDING_DISPATCH',
    workflowStatus: source.workflowStatus, creditNoteAmount: number(source.creditNoteAmount), creditNoteReason: source.creditNoteReason, paymentConfirmedAtUtc: source.paymentConfirmedAtUtc, paymentMethodConfirmed: source.paymentMethodConfirmed as PaymentMethod | undefined, paymentSpecificReference: source.paymentSpecificReference
  };
}

export async function hydrateInvoicesFromServer(): Promise<Invoice[]> {
  if (typeof window === 'undefined') return [];
  const localInvoices = (() => { try { const raw = localStorage.getItem(INVOICE_STORAGE_KEY); return raw ? JSON.parse(raw) as Invoice[] : []; } catch { return []; } })();
  if (!sessionStorage.getItem(AUTH_TOKEN_KEY)) return localInvoices;
  try {
    const response = await fetch('/api/invoices'); if (!response.ok) throw new Error(`Invoice API HTTP ${response.status}`);
    const payload = await response.json() as InvoiceApiResponse; const serverInvoices = normalizeServerInvoices(payload).map(mapInvoice);
    const merged = new Map<string, Invoice>(); for (const invoice of localInvoices) merged.set(invoice.id || invoice.invoiceNumber, invoice); for (const invoice of serverInvoices) merged.set(invoice.id || invoice.invoiceNumber, invoice);
    const invoices = Array.from(merged.values()).sort((a, b) => (Date.parse(b.date || '') || 0) - (Date.parse(a.date || '') || 0));
    localStorage.setItem(INVOICE_STORAGE_KEY, JSON.stringify(invoices)); return invoices;
  } catch (error) { console.warn('Invoice history API unavailable; retaining existing local invoice cache.', error); return localInvoices; }
}
