import { Invoice, PaymentMethod, Product, Customer, CartItem } from '../types';
import { setInvoicesFromServer } from './storage';

type ServerInvoice = {
  id: string; invoiceNumber?: string | null; quotationNumber?: string | null; invoiceDate: string;
  salespersonName?: string; salespersonMobile?: string; subTotal?: number; subtotal?: number;
  discountAmount?: number; promoDiscountAmount?: number; branchManagerDiscountPercent?: number;
  branchManagerDiscountAmount?: number; branchManagerRemarks?: string; taxAmount?: number; taxableAmount?: number;
  cgstAmount?: number; sgstAmount?: number; igstAmount?: number; roundOffAmount?: number; grandTotal: number;
  status?: string; workflowStatus?: string; creditNoteAmount?: number; creditNoteReason?: string;
  paymentMethodRequested?: string; paymentMethodConfirmed?: string; paymentConfirmedAtUtc?: string; paymentSpecificReference?: string;
  vehicleNumber?: string; warehouseVehicleNumber?: string; warehouseLoadedBy?: string; warehouseVerifiedBy?: string; warehouseLoadedAtUtc?: string; warehouseRemarks?: string; deliveredAtUtc?: string; deliveredByName?: string;
  customer?: { id: string; name?: string; phone?: string; email?: string; gstin?: string; billingAddress?: string; shippingAddress?: string; city?: string; state?: string; stateCode?: string };
  salesperson?: { id: string; name?: string; mobile?: string };
  lines?: Array<{ id: string; productId: string; quantity: number; unitPrice: number; discountPercent: number; discountAmount: number; taxableAmount: number; cgstAmount: number; sgstAmount: number; igstAmount: number; lineTotal: number; product?: { id: string; sku?: string; name?: string; unit?: string; hsnCode?: string; sellingPrice?: number; gstRate?: number; stock?: number; reorderLevel?: number } }>;
  payments?: Array<{ id: string; amount: number; method: string; reference?: string; paymentDateUtc?: string }>;
};

type InvoiceApiResponse = ServerInvoice[] | { items?: ServerInvoice[]; value?: ServerInvoice[] };
const number = (value: unknown): number => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; };
const normalize = (payload: InvoiceApiResponse): ServerInvoice[] => Array.isArray(payload) ? payload : Array.isArray(payload.items) ? payload.items : Array.isArray(payload.value) ? payload.value : [];

// SQL Server datetime2 values do not carry timezone metadata. The billing API stores
// invoice/payment timestamps as UTC, so explicitly mark timezone-less API timestamps as UTC
// before the browser converts them to the configured India timezone for display.
const asUtcIso = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed)) return trimmed;
  return `${trimmed}Z`;
};

function mapCustomer(c?: ServerInvoice['customer']): Customer | undefined { if (!c) return undefined; return { id:c.id,name:c.name||'Customer',phone:c.phone||'',email:c.email,gstNumber:c.gstin,address:c.billingAddress,billingAddress:c.billingAddress,shippingAddress:c.shippingAddress,city:c.city,state:c.state,stateCode:c.stateCode,loyaltyPoints:0,totalSpent:0,outstandingBalance:0 }; }
function mapLine(l: NonNullable<ServerInvoice['lines']>[number]): CartItem { const p=l.product; const product:Product={id:l.productId,sku:p?.sku||l.productId,barcode:p?.sku||l.productId,name:p?.name||'Item',category:'General',costPrice:0,sellingPrice:number(l.unitPrice),stock:number(p?.stock),reorderLevel:number(p?.reorderLevel),taxRate:number(p?.gstRate),unit:p?.unit||'PCS',hsnCode:p?.hsnCode,updatedAt:new Date().toISOString()}; return {product,quantity:number(l.quantity),inputQuantity:number(l.quantity),selectedUnit:undefined,discountAmount:number(l.discountAmount),discountPercent:number(l.discountPercent),finalUnitPrice:number(l.unitPrice),totalPrice:number(l.lineTotal)}; }
function mapInvoice(s:ServerInvoice):Invoice { const invoiceDate=asUtcIso(s.invoiceDate)||new Date().toISOString(); const confirmedAt=asUtcIso(s.paymentConfirmedAtUtc); const warehouseLoadedAt=asUtcIso(s.warehouseLoadedAtUtc); const deliveredAt=asUtcIso(s.deliveredAtUtc); const payments=(s.payments||[]).map(p=>({id:p.id,amount:number(p.amount),method:(p.method||s.paymentMethodConfirmed||s.paymentMethodRequested||'CASH') as PaymentMethod,referenceNumber:p.reference,date:asUtcIso(p.paymentDateUtc)||confirmedAt||invoiceDate})); const amountPaid=payments.reduce((x,p)=>x+p.amount,0); const status=s.status==='PAID'||s.workflowStatus==='PAYMENT_CONFIRMED'||s.workflowStatus==='COMPLETED'?'PAID':amountPaid>0?'PARTIAL':'UNPAID'; const deliveryStatus=s.workflowStatus==='COMPLETED' ? 'DELIVERED' : 'PENDING_DISPATCH'; return {id:s.id,invoiceNumber:s.invoiceNumber?.trim()||s.quotationNumber?.trim()||'',quotationNumber:s.quotationNumber?.trim()||undefined,date:invoiceDate,customer:mapCustomer(s.customer),cashierName:'Billing',cashierRole:'BILLING_USER',salespersonName:s.salespersonName||s.salesperson?.name,salespersonMobile:s.salespersonMobile||s.salesperson?.mobile,items:(s.lines||[]).map(mapLine),subtotal:number(s.subTotal??s.subtotal),itemDiscountsTotal:number(s.discountAmount),promoDiscountAmount:number(s.promoDiscountAmount),branchManagerDiscountPercent:number(s.branchManagerDiscountPercent),branchManagerDiscountAmount:number(s.branchManagerDiscountAmount),branchManagerRemarks:s.branchManagerRemarks,manualDiscountAmount:number(s.branchManagerDiscountAmount),taxTotal:number(s.taxableAmount?number(s.cgstAmount)+number(s.sgstAmount)+number(s.igstAmount):s.taxAmount),cgstAmount:number(s.cgstAmount),sgstAmount:number(s.sgstAmount),igstAmount:number(s.igstAmount),roundOffAmount:number(s.roundOffAmount),grandTotal:number(s.grandTotal),amountPaid,changeGiven:0,status,paymentMethod:(s.paymentMethodConfirmed||s.paymentMethodRequested||'CASH') as PaymentMethod,paymentsHistory:payments,deliveryStatus,workflowStatus:s.workflowStatus,creditNoteAmount:number(s.creditNoteAmount),creditNoteReason:s.creditNoteReason,paymentConfirmedAtUtc:confirmedAt,paymentMethodConfirmed:s.paymentMethodConfirmed as PaymentMethod|undefined,paymentSpecificReference:s.paymentSpecificReference,vehicleNumber:s.vehicleNumber || s.warehouseVehicleNumber,warehouseLoadedBy:s.warehouseLoadedBy,warehouseVerifiedBy:s.warehouseVerifiedBy,warehouseLoadedAtUtc:warehouseLoadedAt,warehouseRemarks:s.warehouseRemarks,deliveredAtUtc:deliveredAt,deliveredByName:s.deliveredByName}; }

export async function hydrateInvoicesFromServer(): Promise<Invoice[]> {
  const response=await fetch('/api/invoices/history');
  if(!response.ok) throw new Error(`Invoice API HTTP ${response.status}`);
  const invoices=normalize(await response.json() as InvoiceApiResponse).map(mapInvoice).sort((a,b)=>(Date.parse(b.date||'')||0)-(Date.parse(a.date||'')||0));
  setInvoicesFromServer(invoices);
  return invoices;
}
