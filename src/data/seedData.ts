import { Product, Customer, PromoRule, Invoice, Expense, UserProfile, BusinessStoreDetails, AuditLog } from '../types';

export const INITIAL_USERS: UserProfile[] = [
  {
    id: 'u-1',
    name: 'Sarah Jenkins',
    email: 'sarah@bizflow.com',
    role: 'ADMIN',
    pin: '1234',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    phone: '+1 (555) 019-2834'
  },
  {
    id: 'u-2',
    name: 'Marcus Vance',
    email: 'marcus@bizflow.com',
    role: 'MANAGER',
    pin: '2222',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    phone: '+1 (555) 012-9988'
  },
  {
    id: 'u-3',
    name: 'Chloe Bennett',
    email: 'chloe@bizflow.com',
    role: 'CASHIER',
    pin: '1111',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    phone: '+1 (555) 018-3344'
  },
  {
    id: 'u-4',
    name: 'David Sterling',
    email: 'david@bizflow.com',
    role: 'ACCOUNTANT',
    pin: '3333',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    phone: '+1 (555) 014-7711'
  },
  {
    id: 'u-5',
    name: 'Vikram Patel',
    email: 'vikram@bizflow.com',
    role: 'WAREHOUSE',
    pin: '4444',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    phone: '+1 (555) 016-5522'
  }
];

export const INITIAL_STORE_DETAILS: BusinessStoreDetails = {
  name: 'Apex Tiles & Ceramics Studio',
  tagline: 'Wholesale & Retail Vitrified, Wall & Floor Tiles Specialist',
  address: '108 Industrial Tile Corridor, Sector 4, Gujarat 363642',
  phone: '+91 98765 43210',
  email: 'sales@apextiles.com',
  taxRegistrationNumber: '24AAAAA0000A1Z5',
  currencySymbol: '₹',
  receiptHeader: 'Thank you for choosing Apex Tiles & Ceramics Studio!',
  receiptFooter: 'Please inspect tile lot numbers & batch shades before installation. No returns on broken boxes.',
  upiId: 'apextiles@upi'
};

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-101',
    sku: 'TL-VIT-6060-HG',
    barcode: '890123456001',
    name: 'Statuario White High Gloss Vitrified Tile',
    category: 'Vitrified Floor Tiles',
    costPrice: 420.00,
    sellingPrice: 650.00,
    stock: 140, // 140 boxes in stock
    reorderLevel: 25,
    taxRate: 18.00,
    unit: 'box',
    description: 'Italian Statuario marble look double charged vitrified floor tiles with Nano polish.',
    imageUrl: 'https://images.unsplash.com/photo-1615873968403-89e068629265?w=300&auto=format&fit=crop&q=80',
    updatedAt: new Date().toISOString(),
    tileDimensions: '600x600 mm (2x2 ft)',
    pcsPerBox: 4,
    sqftPerBox: 15.50,
    tileFinish: 'High Gloss Polish',
    tileType: 'Vitrified Floor Tile',
    batchNo: 'LOT-2026-A1',
    pricePerSqFt: 41.93,
    weightPerBoxKg: 28.5
  },
  {
    id: 'prod-102',
    sku: 'TL-PGVT-1260-MT',
    barcode: '890123456002',
    name: 'Armani Grey Marble GVT Floor Slab Tile',
    category: 'GVT / PGVT Slabs',
    costPrice: 850.00,
    sellingPrice: 1280.00,
    stock: 85,
    reorderLevel: 15,
    taxRate: 18.00,
    unit: 'box',
    description: 'Premium GVT vitrified slab tile with silk matt finish and anti-stain technology.',
    imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=300&auto=format&fit=crop&q=80',
    updatedAt: new Date().toISOString(),
    tileDimensions: '1200x600 mm (4x2 ft)',
    pcsPerBox: 2,
    sqftPerBox: 15.50,
    tileFinish: 'Silk Matt / Satin',
    tileType: 'PGVT / GVT Slab',
    batchNo: 'LOT-2026-B4',
    pricePerSqFt: 82.58,
    weightPerBoxKg: 29.0
  },
  {
    id: 'prod-103',
    sku: 'TL-WALL-3060-GL',
    barcode: '890123456003',
    name: 'Subway Glossy White Ceramic Bathroom Wall Tile',
    category: 'Ceramic Wall Tiles',
    costPrice: 280.00,
    sellingPrice: 420.00,
    stock: 12, // LOW STOCK
    reorderLevel: 20,
    taxRate: 18.00,
    unit: 'box',
    description: 'Beveled edge high gloss water-resistant ceramic wall tile ideal for bathrooms and kitchens.',
    imageUrl: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=300&auto=format&fit=crop&q=80',
    updatedAt: new Date().toISOString(),
    tileDimensions: '300x600 mm (1x2 ft)',
    pcsPerBox: 8,
    sqftPerBox: 15.50,
    tileFinish: 'High Gloss Glazed',
    tileType: 'Ceramic Wall Tile',
    batchNo: 'LOT-2026-W2',
    pricePerSqFt: 27.10,
    weightPerBoxKg: 21.0
  },
  {
    id: 'prod-104',
    sku: 'TL-OUT-4040-RS',
    barcode: '890123456004',
    name: 'Rustic Stone Outdoor Parking Anti-Skid Tile',
    category: 'Outdoor & Parking',
    costPrice: 310.00,
    sellingPrice: 480.00,
    stock: 6, // LOW STOCK
    reorderLevel: 15,
    taxRate: 18.00,
    unit: 'box',
    description: 'Heavy duty punch finish anti-skid floor tile designed for driveways and patio areas.',
    imageUrl: 'https://images.unsplash.com/photo-1595846519845-68e298c2edd8?w=300&auto=format&fit=crop&q=80',
    updatedAt: new Date().toISOString(),
    tileDimensions: '400x400 mm (1.3x1.3 ft)',
    pcsPerBox: 6,
    sqftPerBox: 10.33,
    tileFinish: 'Rustic Anti-Skid',
    tileType: 'Heavy Duty Parking',
    batchNo: 'LOT-2026-P1',
    pricePerSqFt: 46.47,
    weightPerBoxKg: 20.5
  },
  {
    id: 'prod-105',
    sku: 'TL-SLAB-8016-CV',
    barcode: '890123456005',
    name: 'Onyx Gold Carving Texture Vitrified Mega Slab',
    category: 'GVT / PGVT Slabs',
    costPrice: 1800.00,
    sellingPrice: 2850.00,
    stock: 45,
    reorderLevel: 10,
    taxRate: 18.00,
    unit: 'box',
    description: 'Luxurious carving effect vein-matched vitrified slab for feature walls and living rooms.',
    imageUrl: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=300&auto=format&fit=crop&q=80',
    updatedAt: new Date().toISOString(),
    tileDimensions: '800x1600 mm (2.6x5.2 ft)',
    pcsPerBox: 2,
    sqftPerBox: 27.56,
    tileFinish: 'Carving Metallic',
    tileType: 'Mega Slab Vitrified',
    batchNo: 'LOT-2026-X9',
    pricePerSqFt: 103.41,
    weightPerBoxKg: 52.0
  },
  {
    id: 'prod-106',
    sku: 'TL-WOD-2012-WD',
    barcode: '890123456006',
    name: 'Oak Wood Grain Timber Plank Porcelain Tile',
    category: 'Wood Plank Tiles',
    costPrice: 490.00,
    sellingPrice: 750.00,
    stock: 90,
    reorderLevel: 20,
    taxRate: 18.00,
    unit: 'box',
    description: 'Natural oak wood grain textured porcelain plank tiles for warm bedroom interiors.',
    imageUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=300&auto=format&fit=crop&q=80',
    updatedAt: new Date().toISOString(),
    tileDimensions: '200x1200 mm (8x48 inch)',
    pcsPerBox: 6,
    sqftPerBox: 15.50,
    tileFinish: 'Textured Wood Matt',
    tileType: 'Porcelain Plank Tile',
    batchNo: 'LOT-2026-WD3',
    pricePerSqFt: 48.39,
    weightPerBoxKg: 28.0
  },
  {
    id: 'prod-107',
    sku: 'CHEM-ADH-POLY-20',
    barcode: '890123456007',
    name: 'Polymer Modified Heavy Duty Tile Adhesive (20kg)',
    category: 'Adhesives & Chemicals',
    costPrice: 220.00,
    sellingPrice: 380.00,
    stock: 250,
    reorderLevel: 50,
    taxRate: 18.00,
    unit: 'bag',
    description: 'High bond strength polymer modified grey adhesive bag for vitrified tiles and slabs.',
    imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=300&auto=format&fit=crop&q=80',
    updatedAt: new Date().toISOString(),
    tileDimensions: '20kg Bag',
    pcsPerBox: 1,
    sqftPerBox: 50.0, // Coverage approx 50 sq.ft per bag
    tileFinish: 'Grey Powder',
    tileType: 'Tile Fixing Adhesive',
    batchNo: 'LOT-2026-C1',
    pricePerSqFt: 7.60,
    weightPerBoxKg: 20.0
  },
  {
    id: 'prod-108',
    sku: 'CHEM-GRT-WPR-05',
    barcode: '890123456008',
    name: 'Waterproof Epoxy Tile Joint Grout - Ivory (5kg)',
    category: 'Adhesives & Chemicals',
    costPrice: 180.00,
    sellingPrice: 290.00,
    stock: 180,
    reorderLevel: 30,
    taxRate: 18.00,
    unit: 'bucket',
    description: 'Stain-resistant waterproof resin epoxy tile joint filler with metallic glitter option.',
    imageUrl: 'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=300&auto=format&fit=crop&q=80',
    updatedAt: new Date().toISOString(),
    tileDimensions: '5kg Pack',
    pcsPerBox: 1,
    sqftPerBox: 150.0,
    tileFinish: 'Ivory Finish',
    tileType: 'Epoxy Joint Grout',
    batchNo: 'LOT-2026-G2',
    pricePerSqFt: 1.93,
    weightPerBoxKg: 5.0
  }
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    name: 'Royal Infrastructure & Builders',
    phone: '+91 98250 11223',
    email: 'accounts@royalinfra.com',
    customerType: 'LEDGER',
    gstNumber: '24AAAAA1234A1Z5',
    gstLegalName: 'Royal Infrastructure Projects Private Limited',
    gstTradeName: 'Royal Infrastructure & Builders',
    gstStatus: 'ACTIVE',
    gstState: '24 - Gujarat',
    gstAddress: 'Plot 45, Commercial Hub, Ring Road, Ahmedabad, Gujarat 380015',
    taxNumber: '24AAAAA1234A1Z5',
    address: 'Plot 45, Commercial Hub, Ring Road, Ahmedabad, Gujarat 380015',
    loyaltyPoints: 1240,
    totalSpent: 185000.00,
    outstandingBalance: 45000.00
  },
  {
    id: 'cust-2',
    name: 'Emily Watson (Retail)',
    phone: '+91 98765 00112',
    email: 'emily.watson@gmail.com',
    customerType: 'NORMAL',
    address: '405 Residency Apartments, Sector 2, Rajkot, Gujarat',
    loyaltyPoints: 120,
    totalSpent: 14200.00,
    outstandingBalance: 0
  },
  {
    id: 'cust-3',
    name: 'Shree Ram Tile Mall & Sanitaryware',
    phone: '+91 94260 55443',
    email: 'purchase@shreeramtiles.in',
    customerType: 'LEDGER',
    gstNumber: '27AAPCU9876M1Z2',
    gstLegalName: 'Shree Ram Ceramic Enterprises Partnership',
    gstTradeName: 'Shree Ram Tile Mall',
    gstStatus: 'ACTIVE',
    gstState: '27 - Maharashtra',
    gstAddress: '88 Link Road, Near Highway Plaza, Mumbai, Maharashtra 400053',
    taxNumber: '27AAPCU9876M1Z2',
    address: '88 Link Road, Near Highway Plaza, Mumbai, Maharashtra 400053',
    loyaltyPoints: 2850,
    totalSpent: 420000.00,
    outstandingBalance: 82500.00
  },
  {
    id: 'cust-4',
    name: 'Robert Miller',
    phone: '+91 97123 44321',
    email: 'rmiller@outlook.com',
    customerType: 'NORMAL',
    address: 'Villa 12, Green Acres Colony, Surat',
    loyaltyPoints: 45,
    totalSpent: 8500.00,
    outstandingBalance: 0
  }
];

export const INITIAL_PROMOS: PromoRule[] = [
  {
    id: 'promo-1',
    code: 'WELCOME10',
    title: 'New Customer Welcome',
    description: 'Get 10% off on orders above $30',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    minOrderValue: 30,
    maxDiscountAmount: 50,
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
    isActive: true,
    autoApply: false,
    usageCount: 28,
    usageLimit: 100
  },
  {
    id: 'promo-2',
    code: 'SUMMER20',
    title: 'Summer Season Mega Savings',
    description: 'Flat $20 off on store orders of $100 or more',
    discountType: 'FLAT_AMOUNT',
    discountValue: 20,
    minOrderValue: 100,
    validFrom: '2026-06-01',
    validUntil: '2026-08-31',
    isActive: true,
    autoApply: true,
    usageCount: 64
  },
  {
    id: 'promo-3',
    code: 'TECHVIP15',
    title: 'Electronics VIP Discount',
    description: '15% discount on Electronics category items',
    discountType: 'PERCENTAGE',
    discountValue: 15,
    minOrderValue: 50,
    validFrom: '2026-05-01',
    validUntil: '2026-11-30',
    isActive: true,
    autoApply: false,
    usageCount: 14,
    targetCategory: 'Electronics'
  },
  {
    id: 'promo-4',
    code: 'FLASH50',
    title: 'Super Saver $5 Flat',
    description: '$5 off on small purchases above $25',
    discountType: 'FLAT_AMOUNT',
    discountValue: 5,
    minOrderValue: 25,
    validFrom: '2026-08-01',
    validUntil: '2026-08-20',
    isActive: true,
    autoApply: false,
    usageCount: 41
  }
];

export const INITIAL_EXPENSES: Expense[] = [
  {
    id: 'exp-101',
    title: 'Storefront Monthly Rent',
    category: 'RENT',
    amount: 1800.00,
    date: '2026-08-01',
    paidTo: 'Evergreen Real Estate Holdings',
    paymentMethod: 'BANK_TRANSFER',
    recordedBy: 'David Sterling',
    receiptNumber: 'REC-RENT-0826'
  },
  {
    id: 'exp-102',
    title: 'Electricity & High-Speed Internet',
    category: 'UTILITIES',
    amount: 245.50,
    date: '2026-08-05',
    paidTo: 'Austin Energy & Spectrum',
    paymentMethod: 'CARD',
    recordedBy: 'Sarah Jenkins',
    receiptNumber: 'UT-98124'
  },
  {
    id: 'exp-103',
    title: 'Electronics Supplier Restock Invoice',
    category: 'SUPPLIER_PAYMENT',
    amount: 850.00,
    date: '2026-08-08',
    paidTo: 'TechSource Wholesale Inc',
    paymentMethod: 'BANK_TRANSFER',
    recordedBy: 'Marcus Vance',
    receiptNumber: 'INV-TS-4410'
  },
  {
    id: 'exp-104',
    title: 'Local Flyer & Instagram Ads Campaign',
    category: 'MARKETING',
    amount: 150.00,
    date: '2026-08-10',
    paidTo: 'Meta Ads Platform',
    paymentMethod: 'CARD',
    recordedBy: 'Sarah Jenkins'
  }
];

export const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'inv-1001',
    invoiceNumber: 'INV-2026-1001',
    date: '2026-08-12T10:15:00Z',
    customer: INITIAL_CUSTOMERS[1], // Emily Watson
    cashierName: 'Chloe Bennett',
    cashierRole: 'CASHIER',
    items: [
      {
        product: INITIAL_PRODUCTS[0], // Wireless Mouse
        quantity: 1,
        discountAmount: 0,
        finalUnitPrice: 29.99,
        totalPrice: 29.99
      },
      {
        product: INITIAL_PRODUCTS[7], // USB Cable
        quantity: 2,
        discountAmount: 0,
        finalUnitPrice: 9.99,
        totalPrice: 19.98
      }
    ],
    subtotal: 49.97,
    itemDiscountsTotal: 0,
    promoCodeApplied: 'WELCOME10',
    promoDiscountAmount: 5.00,
    manualDiscountAmount: 0,
    taxTotal: 3.71,
    grandTotal: 48.68,
    amountPaid: 50.00,
    changeGiven: 1.32,
    status: 'PAID',
    paymentMethod: 'CASH',
    deliveryStatus: 'DELIVERED',
    dispatchDate: '2026-08-12T11:00:00Z',
    driverName: 'Robert Logistics',
    driverPhone: '+1 (555) 901-2211',
    vehicleNumber: 'TX-8821-EXP',
    trackingNumber: 'TRK-9812401',
    transporterName: 'Swift Express Logistics',
    ewayBillNo: '381029481029',
    irnNo: 'a1b2c3d4e5f67890123456789012345678901234567890123456789012345678',
    paymentsHistory: [
      {
        id: 'pay-1',
        amount: 48.68,
        method: 'CASH',
        date: '2026-08-12T10:15:00Z',
        notes: 'Cash payment rendered at POS'
      }
    ]
  },
  {
    id: 'inv-1002',
    invoiceNumber: 'INV-2026-1002',
    date: '2026-08-12T11:40:00Z',
    dueDate: '2026-08-26',
    customer: INITIAL_CUSTOMERS[0], // Apex Innovations
    cashierName: 'Marcus Vance',
    cashierRole: 'MANAGER',
    items: [
      {
        product: INITIAL_PRODUCTS[1], // Mechanical Keyboard
        quantity: 2,
        discountAmount: 10,
        finalUnitPrice: 74.99,
        totalPrice: 149.98
      },
      {
        product: INITIAL_PRODUCTS[6], // Repair Service
        quantity: 2,
        discountAmount: 0,
        finalUnitPrice: 75.00,
        totalPrice: 150.00
      }
    ],
    subtotal: 309.98,
    itemDiscountsTotal: 10,
    promoCodeApplied: 'SUMMER20',
    promoDiscountAmount: 20.00,
    manualDiscountAmount: 0,
    taxTotal: 23.92,
    grandTotal: 303.90,
    amountPaid: 183.90,
    changeGiven: 0,
    status: 'PARTIAL',
    paymentMethod: 'ON_ACCOUNT',
    deliveryStatus: 'IN_TRANSIT',
    dispatchDate: '2026-08-12T13:30:00Z',
    driverName: 'Suresh Kumar',
    driverPhone: '+1 (555) 304-8822',
    vehicleNumber: 'TX-4019-LOG',
    trackingNumber: 'TRK-8812039',
    transporterName: 'FedEx Ground Freight',
    ewayBillNo: '381029481030',
    distanceKm: 45,
    paymentsHistory: [
      {
        id: 'pay-2',
        amount: 183.90,
        method: 'BANK_TRANSFER',
        referenceNumber: 'TXN-BK-99120',
        date: '2026-08-12T11:42:00Z',
        notes: 'Deposit received'
      }
    ],
    notes: 'Partial payment on account; balance $120 due in 14 days.'
  },
  {
    id: 'inv-1003',
    invoiceNumber: 'INV-2026-1003',
    date: '2026-08-12T14:20:00Z',
    customer: INITIAL_CUSTOMERS[2], // Urban Bistro
    cashierName: 'Chloe Bennett',
    cashierRole: 'CASHIER',
    items: [
      {
        product: INITIAL_PRODUCTS[3], // Coffee Beans
        quantity: 5,
        discountAmount: 0,
        finalUnitPrice: 18.50,
        totalPrice: 92.50
      }
    ],
    subtotal: 92.50,
    itemDiscountsTotal: 0,
    promoDiscountAmount: 0,
    manualDiscountAmount: 0,
    taxTotal: 4.63,
    grandTotal: 97.13,
    amountPaid: 97.13,
    changeGiven: 0,
    status: 'PAID',
    paymentMethod: 'UPI_QR',
    deliveryStatus: 'PACKED',
    paymentsHistory: [
      {
        id: 'pay-3',
        amount: 97.13,
        method: 'UPI_QR',
        referenceNumber: 'UPI-REF-883192',
        date: '2026-08-12T14:20:00Z'
      }
    ]
  },
  {
    id: 'inv-1004',
    invoiceNumber: 'INV-2026-1004',
    date: '2026-08-11T16:05:00Z',
    customer: INITIAL_CUSTOMERS[3], // Robert Miller
    cashierName: 'Sarah Jenkins',
    cashierRole: 'ADMIN',
    items: [
      {
        product: INITIAL_PRODUCTS[2], // Headset
        quantity: 1,
        discountAmount: 0,
        finalUnitPrice: 119.00,
        totalPrice: 119.00
      }
    ],
    subtotal: 119.00,
    itemDiscountsTotal: 0,
    promoCodeApplied: 'SUMMER20',
    promoDiscountAmount: 20.00,
    manualDiscountAmount: 0,
    taxTotal: 8.17,
    grandTotal: 107.17,
    amountPaid: 107.17,
    changeGiven: 0,
    status: 'PAID',
    paymentMethod: 'CARD',
    deliveryStatus: 'PENDING_DISPATCH',
    paymentsHistory: [
      {
        id: 'pay-4',
        amount: 107.17,
        method: 'CARD',
        referenceNumber: 'AUTH-CC-4401',
        date: '2026-08-11T16:05:00Z'
      }
    ]
  }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'audit-101',
    timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    category: 'PRODUCT',
    severity: 'HIGH',
    action: 'Product Price Modified',
    performedBy: 'Sarah Jenkins',
    performedByRole: 'ADMIN',
    targetId: 'prod-101',
    targetName: 'Statuario White High Gloss Vitrified Tile',
    details: 'Selling price per box updated for catalog revision.',
    previousValue: '₹610.00 / box',
    newValue: '₹650.00 / box',
    ipAddress: '192.168.1.104'
  },
  {
    id: 'audit-102',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    category: 'USER',
    severity: 'CRITICAL',
    action: 'User Role & Permissions Changed',
    performedBy: 'Sarah Jenkins',
    performedByRole: 'ADMIN',
    targetId: 'u-2',
    targetName: 'Marcus Vance',
    details: 'Promoted Marcus Vance from Cashier to Store Manager with full inventory write permissions.',
    previousValue: 'Role: CASHIER',
    newValue: 'Role: MANAGER',
    ipAddress: '192.168.1.104'
  },
  {
    id: 'audit-103',
    timestamp: new Date(Date.now() - 1000 * 60 * 280).toISOString(),
    category: 'INVOICE',
    severity: 'HIGH',
    action: 'Invoice Refund Processed',
    performedBy: 'Marcus Vance',
    performedByRole: 'MANAGER',
    targetId: 'inv-1002',
    targetName: 'INV-2026-1002',
    details: 'Customer return due to shade batch mismatch on 5 boxes of ceramic wall tiles. Stock auto-restocked.',
    previousValue: 'Status: PAID (₹1,450.00)',
    newValue: 'Status: REFUNDED',
    ipAddress: '192.168.1.112'
  },
  {
    id: 'audit-104',
    timestamp: new Date(Date.now() - 1000 * 60 * 420).toISOString(),
    category: 'STOCK',
    severity: 'MEDIUM',
    action: 'Inventory Audit Correction',
    performedBy: 'Vikram Patel',
    performedByRole: 'WAREHOUSE',
    targetId: 'prod-103',
    targetName: 'Moroccan Handcrafted Art Wall Tile',
    details: 'Deducted 4 broken boxes found during physical warehouse count.',
    previousValue: 'Stock: 48 boxes',
    newValue: 'Stock: 44 boxes',
    ipAddress: '192.168.1.120'
  },
  {
    id: 'audit-105',
    timestamp: new Date(Date.now() - 1000 * 60 * 1440).toISOString(),
    category: 'PROMO',
    severity: 'MEDIUM',
    action: 'Promo Offer Created',
    performedBy: 'Marcus Vance',
    performedByRole: 'MANAGER',
    targetId: 'promo-3',
    targetName: 'BUILD10 (10% Off Bulk Tiles)',
    details: 'Created new contractor ledger promo rule for orders above ₹500.00.',
    previousValue: 'Rule Non-Existent',
    newValue: 'Rule Active (10% Max ₹100.00)',
    ipAddress: '192.168.1.112'
  },
  {
    id: 'audit-106',
    timestamp: new Date(Date.now() - 1000 * 60 * 2880).toISOString(),
    category: 'SYSTEM',
    severity: 'CRITICAL',
    action: 'Store Tax Registration Details Updated',
    performedBy: 'Sarah Jenkins',
    performedByRole: 'ADMIN',
    targetId: 'store-details',
    targetName: 'Apex Tiles & Ceramics Studio',
    details: 'Updated store GSTIN registration number for new financial quarter compliance.',
    previousValue: 'GSTIN: 24AAAAA0000A1Z1',
    newValue: 'GSTIN: 24AAAAA0000A1Z5',
    ipAddress: '192.168.1.104'
  }
];

