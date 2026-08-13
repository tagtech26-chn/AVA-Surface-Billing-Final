export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'ACCOUNTANT' | 'WAREHOUSE';

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
  stock: number; // number of boxes/units in stock
  reorderLevel: number;
  taxRate: number; // e.g. 5, 12, 18 %
  unit: string; // 'box', 'pcs', 'sqft', 'sqmt', 'kg'
  description?: string;
  imageUrl?: string;
  updatedAt: string;

  // Tiles & Ceramics Specific Attributes
  tileDimensions?: string; // e.g. '600x600 mm (2x2 ft)', '1200x600 mm (4x2 ft)', '300x600 mm (1x2 ft)', '800x1600 mm'
  pcsPerBox?: number;      // e.g. 4 pcs/box, 2 pcs/box
  sqftPerBox?: number;     // e.g. 15.5 sq.ft / box
  tileFinish?: string;     // e.g. 'High Gloss', 'Matt / Satin', 'Carving', 'Sugar Finish', 'Rustic'
  tileType?: string;       // e.g. 'Vitrified Floor', 'Ceramic Wall', 'PGVT Slab', 'Elevation', 'Grout'
  batchNo?: string;        // e.g. 'LOT-2026-A1'
  pricePerSqFt?: number;   // calculated or direct price per sq.ft
  weightPerBoxKg?: number; // e.g. 28 kg
}

export interface StockAdjustment {
  id: string;
  productId: string;
  productName: string;
  quantityChange: number; // positive for restock, negative for damage/loss
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
  taxNumber?: string; // GSTIN / VAT No
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
  discountValue: number; // e.g., 20 for 20%, or 15 for $15
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
  quantity: number; // calculated number of boxes
  inputQuantity?: number; // raw value entered by user
  selectedUnit?: TileQtyUnit; // 'box', 'pcs', 'sqft', 'sqmt', 'set'
  itemWeightKg?: number; // total calculated weight for this line item in kg
  discountAmount: number; // custom item-level discount in currency
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
  items: CartItem[];
  subtotal: number;
  itemDiscountsTotal: number;
  promoCodeApplied?: string;
  promoDiscountAmount: number;
  manualDiscountAmount: number;
  taxTotal: number;
  grandTotal: number;
  amountPaid: number;
  changeGiven: number;
  status: InvoiceStatus;
  paymentMethod: PaymentMethod;
  paymentsHistory: PaymentRecord[];
  notes?: string;

  // Warehouse & Delivery Dispatch
  deliveryStatus?: DeliveryStatus;
  dispatchDate?: string;
  driverName?: string;
  driverPhone?: string;
  vehicleNumber?: string;
  trackingNumber?: string;
  transporterName?: string;
  deliveryNotes?: string;

  // e-Way Bill & e-Invoicing Compliance
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
  taxRegistrationNumber: string; // e.g., GSTIN / VAT ID
  currencySymbol: string;
  receiptHeader: string;
  receiptFooter: string;
  upiId?: string;
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

export type AuditCategory = 'PRODUCT' | 'INVOICE' | 'USER' | 'PROMO' | 'STOCK' | 'SYSTEM';
export type AuditSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AuditLog {
  id: string;
  timestamp: string;
  category: AuditCategory;
  severity: AuditSeverity;
  action: string;               // e.g., "Product Price Changed", "Invoice Deleted", "User Role Modified"
  performedBy: string;          // User Name e.g. "Sarah Jenkins"
  performedByRole: UserRole;    // User Role e.g. "ADMIN"
  targetId?: string;            // ID of affected entity
  targetName?: string;          // Name or reference e.g., "INV-2026-1002" or "Statuario Tile"
  details: string;              // Descriptive detail
  previousValue?: string;       // e.g. "₹650.00"
  newValue?: string;            // e.g. "₹720.00"
  ipAddress?: string;           // Optional IP / session metadata
}

export interface TallyLedgerMapping {
  salesLedger: string;      // e.g., "Sales Accounts"
  cashLedger: string;       // e.g., "Cash-in-hand"
  bankLedger: string;       // e.g., "HDFC Bank"
  cgstLedger: string;       // e.g., "Output CGST @ 9%"
  sgstLedger: string;       // e.g., "Output SGST @ 9%"
  igstLedger: string;       // e.g., "Output IGST @ 18%"
  debtorsGroup: string;     // e.g., "Sundry Debtors"
  companyName: string;      // e.g., "BizFlow Store"
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
