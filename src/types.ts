export type UserRole = 'ADMIN' | 'MANAGER' | 'BRANCH_MANAGER' | 'CASHIER' | 'ACCOUNTANT' | 'WAREHOUSE';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  pin: string;
  avatar: string;
  phone?: string;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  reorderLevel: number;
  taxRate: number;
  unit: string;
  hsnCode?: string;
  description?: string;
  imageUrl?: string;
  updatedAt: string;
  tileDimensions?: string;
  pcsPerBox?: number;
  sqftPerBox?: number;
  tileFinish?: string;
  tileType?: string;
  batchNo?: string;
  pricePerSqFt?: number;
  weightPerBoxKg?: number;
}

export interface StockAdjustment {
  id: string;
  productId: string;
  productName: string;
  quantityChange: number;
  type: 'RESTOCK' | 'DAMAGE' | 'LOSS' | 'AUDIT_CORRECTION';
  reason: string;
  performedBy: string;
  date: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  customerType?: 'NORMAL' | 'LEDGER';
  gstNumber?: string;
  gstLegalName?: string;
  gstTradeName?: string;
  gstStatus?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  gstState?: string;
  gstAddress?: string;
  taxNumber?: string;
  address?: string;
  loyaltyPoints: number;
  totalSpent: number;
  outstandingBalance: number;
}

export type DiscountType = 'PERCENTAGE' | 'FLAT_AMOUNT' | 'BUY_X_GET_Y';

export interface PromoRule {
  id: string;
  code: string;
  title: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderValue: number;
  maxDiscountAmount?: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  autoApply: boolean;
  usageCount: number;
  usageLimit?: number;
  targetCategory?: string;
}

export type TileQtyUnit = 'box' | 'pcs' | 'sqft' | 'sqmt' | 'set';

export interface CartItem {
  product: Product;
  quantity: number;
  inputQuantity?: number;
  selectedUnit?: TileQtyUnit;
  itemWeightKg?: number;
  discountAmount: number;
  discountPercent?: number;
  finalUnitPrice: number;
  totalPrice: number;
}

export type PaymentMethod = 'CASH' | 'CARD' | 'UPI_QR' | 'BANK_TRANSFER' | 'STORE_CREDIT' | 'ON_ACCOUNT';
export type InvoiceStatus = 'PAID' | 'UNPAID' | 'PARTIAL' | 'REFUNDED';
export type DeliveryStatus = 'PENDING_DISPATCH' | 'PACKED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

export interface PaymentRecord {
  id: string;
  amount: number;
  method: PaymentMethod;
  referenceNumber?: string;
  date: string;
  notes?: string;
}

export interface DraftBill {
  id: string;
  createdAt: string;
  customer?: Customer;
  customerType: 'NORMAL' | 'LEDGER';
  gstInput?: string;
  gstData?: any;
  cartItems: CartItem[];
  notes?: string;
  savedBy: string;
  totalAmount: number;
  totalWeightKg: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  dueDate?: string;
  customer?: Customer;
  cashierName: string;
  cashierRole: UserRole;
  salespersonName?: string;
  salespersonMobile?: string;
  items: CartItem[];
  subtotal: number;
  itemDiscountsTotal: number;
  promoCodeApplied?: string;
  promoDiscountPercent?: number;
  promoDiscountAmount: number;
  branchManagerDiscountPercent?: number;
  branchManagerDiscountAmount?: number;
  branchManagerRemarks?: string;
  branchManagerUserId?: string;
  manualDiscountAmount: number;
  taxTotal: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  roundOffAmount?: number;
  grandTotal: number;
  amountPaid: number;
  changeGiven: number;
  status: InvoiceStatus;
  paymentMethod: PaymentMethod;
  paymentsHistory: PaymentRecord[];
  notes?: string;
  deliveryStatus?: DeliveryStatus;
  dispatchDate?: string;
  driverName?: string;
  driverPhone?: string;
  vehicleNumber?: string;
  trackingNumber?: string;
  transporterName?: string;
  deliveryNotes?: string;
  ewayBillNo?: string;
  ewayBillDate?: string;
  ewayValidUntil?: string;
  irnNo?: string;
  ackNo?: string;
  ackDate?: string;
  distanceKm?: number;
}

export type ExpenseCategory = 'RENT' | 'UTILITIES' | 'SUPPLIER_PAYMENT' | 'SALARIES' | 'MARKETING' | 'EQUIPMENT' | 'OTHER';

export interface Expense {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  paidTo: string;
  paymentMethod: PaymentMethod;
  recordedBy: string;
  receiptNumber?: string;
  notes?: string;
}

export interface BusinessStoreDetails {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  taxRegistrationNumber: string;
  currencySymbol: string;
  receiptHeader: string;
  receiptFooter: string;
  upiId?: string;
  pan?: string;
  cin?: string;
}

export type AuditCategory = 'PRODUCT' | 'INVOICE' | 'USER' | 'PROMO' | 'STOCK' | 'SYSTEM';
export type AuditSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AuditLog {
  id: string;
  timestamp: string;
  category: AuditCategory;
  severity: AuditSeverity;
  action: string;
  performedBy: string;
  performedByRole: UserRole;
  targetId?: string;
  targetName?: string;
  details: string;
  previousValue?: string;
  newValue?: string;
  ipAddress?: string;
}

export interface TallyLedgerMapping {
  salesLedger: string;
  cashLedger: string;
  bankLedger: string;
  cgstLedger: string;
  sgstLedger: string;
  igstLedger: string;
  debtorsGroup: string;
  companyName: string;
}

export interface AIInsightResponse {
  insight: string;
  recommendations: string[];
  promoIdea?: {
    code: string;
    discount: string;
    description: string;
  };
}
