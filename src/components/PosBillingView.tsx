import React, { useState, useMemo, useEffect } from 'react';
import {
  Product,
  Customer,
  PromoRule,
  CartItem,
  PaymentMethod,
  Invoice,
  UserProfile,
  BusinessStoreDetails,
  TileQtyUnit,
  DraftBill
} from '../types';
import { Storage } from '../lib/storage';
import { formatCurrency, generateInvoiceNumber, generateId, formatDateTime } from '../lib/utils';
import { TileAreaCalculatorModal } from './TileAreaCalculatorModal';
import { lookupGstDetails, GstLookupResult } from '../lib/gstUtils';
import {
  Search,
  Barcode,
  Plus,
  Minus,
  Trash2,
  Tag,
  User,
  UserPlus,
  CreditCard,
  Banknote,
  QrCode,
  Building2,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Receipt,
  RotateCcw,
  Percent,
  Calculator,
  Ruler,
  Boxes,
  ShieldCheck,
  Building,
  Scale,
  Weight,
  Loader2,
  Check,
  X,
  FileSpreadsheet,
  ArrowRight,
  Bookmark,
  FolderOpen,
  Save,
  CheckCircle
} from 'lucide-react';

interface PosBillingViewProps {
  products: Product[];
  customers: Customer[];
  promos: PromoRule[];
  activeUser: UserProfile;
  storeDetails: BusinessStoreDetails;
  onCompleteInvoice: (invoice: Invoice, updatedProducts: Product[], updatedCustomer?: Customer) => void;
  onAddNewCustomer: (newCust: Omit<Customer, 'id' | 'loyaltyPoints' | 'totalSpent' | 'outstandingBalance'>) => Customer;
  currencySymbol: string;
}

export const PosBillingView: React.FC<PosBillingViewProps> = ({
  products,
  customers,
  promos,
  activeUser,
  storeDetails,
  onCompleteInvoice,
  onAddNewCustomer,
  currencySymbol
}) => {
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Manual Quick Entry (2-3 Digit/Letter Type-ahead) State
  const [quickInputTerm, setQuickInputTerm] = useState('');
  const [selectedQuickProd, setSelectedQuickProd] = useState<Product | null>(null);
  const [quickQty, setQuickQty] = useState<number>(1);
  const [quickUnit, setQuickUnit] = useState<TileQtyUnit>('box');
  const [showQuickDropdown, setShowQuickDropdown] = useState(false);

  // Cart State
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [salespersons, setSalespersons] = useState<Array<{ id: string; code: string; name: string; mobile: string; isActive: boolean }>>([]);
  const [selectedSalespersonId, setSelectedSalespersonId] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoRule | null>(null);
  const [promoDismissed, setPromoDismissed] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [manualDiscount, setManualDiscount] = useState<number>(0);

  // Customer Type & Ledger GST State
  const [customerType, setCustomerType] = useState<'NORMAL' | 'LEDGER'>('NORMAL');
  const [gstInput, setGstInput] = useState('');
  const [isVerifyingGst, setIsVerifyingGst] = useState(false);
  const [gstData, setGstData] = useState<GstLookupResult | null>(null);
  const [ledgerCustName, setLedgerCustName] = useState('');
  const [ledgerCustPhone, setLedgerCustPhone] = useState('');

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [dueDateInput, setDueDateInput] = useState<string>('2026-08-26');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Modals & Draft Bills State
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [isTileCalcOpen, setIsTileCalcOpen] = useState(false);
  const [showDraftsModal, setShowDraftsModal] = useState(false);
  const [showBarcodeScannerModal, setShowBarcodeScannerModal] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [manualScanInput, setManualScanInput] = useState<string>('');
  const [drafts, setDrafts] = useState<DraftBill[]>(() => Storage.getDrafts());
  const [toastNotification, setToastNotification] = useState<string | null>(null);

  const [newCustType, setNewCustType] = useState<'NORMAL' | 'LEDGER'>('NORMAL');
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustTax, setNewCustTax] = useState('');
  const [newCustBillingAddress, setNewCustBillingAddress] = useState('');
  const [newCustShippingAddress, setNewCustShippingAddress] = useState('');
  const [newCustCity, setNewCustCity] = useState('');
  const [newCustState, setNewCustState] = useState('');
  const [newCustStateCode, setNewCustStateCode] = useState('');
  const [newCustPincode, setNewCustPincode] = useState('');
  const [shippingSameAsBilling, setShippingSameAsBilling] = useState(true);

  const selectedSalesperson = useMemo(
    () => salespersons.find((person) => person.id === selectedSalespersonId) || null,
    [salespersons, selectedSalespersonId]
  );

  useEffect(() => {
    let cancelled = false;
    fetch('/api/salespersons')
      .then(async (response) => {
        if (!response.ok) throw new Error(`Salesperson API HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setSalespersons(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        console.error('Unable to load salesperson master:', error);
        if (!cancelled) setSalespersons([]);
      });
    return () => { cancelled = true; };
  }, []);

  // Draft Bill Handler - Save current session on hold
  const handleSaveAsDraft = () => {
    if (cartItems.length === 0) {
      setToastNotification('Cart is empty. Please add items before saving as draft.');
      setTimeout(() => setToastNotification(null), 3000);
      return;
    }

    const newDraft: DraftBill = {
      id: generateId('draft'),
      createdAt: new Date().toISOString(),
      customer: selectedCustomer || undefined,
      customerType,
      gstInput,
      gstData,
      cartItems: [...cartItems],
      notes: paymentNotes,
      savedBy: activeUser.name,
      totalAmount: grandTotal,
      totalWeightKg: totalShipmentWeightKg
    };

    const updated = [newDraft, ...drafts];
    setDrafts(updated);
    Storage.saveDrafts(updated);

    // Reset current POS session
    setCartItems([]);
    setSelectedCustomer(null);
    setGstInput('');
    setGstData(null);
    setPaymentNotes('');
    setAppliedPromo(null);
    setPromoInput('');

    setToastNotification('Draft Bill saved on hold successfully!');
    setTimeout(() => setToastNotification(null), 3500);
  };

  // Draft Bill Handler - Restore draft into active POS session
  const handleLoadDraft = (draft: DraftBill) => {
    setCartItems(draft.cartItems);
    if (draft.customer) setSelectedCustomer(draft.customer);
    if (draft.customerType) setCustomerType(draft.customerType);
    if (draft.gstInput) setGstInput(draft.gstInput);
    if (draft.gstData) setGstData(draft.gstData);
    if (draft.notes) setPaymentNotes(draft.notes);

    // Remove restored draft
    const remaining = drafts.filter((d) => d.id !== draft.id);
    setDrafts(remaining);
    Storage.saveDrafts(remaining);

    setShowDraftsModal(false);
    setToastNotification('Draft Bill restored to active cart!');
    setTimeout(() => setToastNotification(null), 3500);
  };

  // Draft Bill Handler - Delete draft
  const handleDeleteDraft = (draftId: string) => {
    const remaining = drafts.filter((d) => d.id !== draftId);
    setDrafts(remaining);
    Storage.saveDrafts(remaining);
  };

  // Sync customer type when selectedCustomer changes
  useEffect(() => {
    if (selectedCustomer) {
      if (selectedCustomer.customerType === 'LEDGER' || selectedCustomer.gstNumber || selectedCustomer.taxNumber) {
        setCustomerType('LEDGER');
        setGstInput(selectedCustomer.gstNumber || selectedCustomer.taxNumber || '');
        if (selectedCustomer.gstNumber) {
          handleVerifyGst(selectedCustomer.gstNumber);
        }
      } else {
        setCustomerType('NORMAL');
        setGstInput('');
        setGstData(null);
      }
    }
  }, [selectedCustomer]);

  // GST Verification Handler
  const handleVerifyGst = async (overrideGst?: string) => {
    const targetGst = overrideGst || gstInput;
    if (!targetGst.trim()) return;

    setIsVerifyingGst(true);
    try {
      const res = await lookupGstDetails(targetGst);
      setGstData(res);
      if (res.isValid && res.status === 'ACTIVE') {
        if (!ledgerCustName) {
          setLedgerCustName(res.tradeName || res.legalName);
        }
      }
    } catch (err) {
      console.error('GST lookup failed:', err);
    } finally {
      setIsVerifyingGst(false);
    }
  };

  // Quick Type-Ahead Product Suggestions (2-3 characters filter)
  const quickSuggestions = useMemo(() => {
    if (!quickInputTerm || quickInputTerm.trim().length < 2) return [];
    const term = quickInputTerm.trim().toLowerCase();
    return products.filter((p) => {
      return (
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        p.barcode.toLowerCase().includes(term) ||
        (p.tileDimensions && p.tileDimensions.toLowerCase().includes(term)) ||
        (p.tileFinish && p.tileFinish.toLowerCase().includes(term))
      );
    }).slice(0, 10);
  }, [products, quickInputTerm]);

  // Calculate equivalent boxes & weight for manual quick entry
  const quickCalculatedDetails = useMemo(() => {
    if (!selectedQuickProd) return { boxes: 0, weightKg: 0, totalPrice: 0 };

    const pcsPerBox = selectedQuickProd.pcsPerBox || 4;
    const sqftPerBox = selectedQuickProd.sqftPerBox || 15.5;
    const weightPerBox = selectedQuickProd.weightPerBoxKg || 25;

    let boxes = 0;
    if (quickUnit === 'box') {
      boxes = quickQty;
    } else if (quickUnit === 'pcs') {
      boxes = Math.ceil(quickQty / pcsPerBox);
    } else if (quickUnit === 'sqft') {
      boxes = Math.ceil(quickQty / sqftPerBox);
    } else if (quickUnit === 'sqmt') {
      boxes = Math.ceil((quickQty * 10.7639) / sqftPerBox);
    } else if (quickUnit === 'set') {
      boxes = quickQty;
    }

    const safeBoxes = Math.max(1, boxes);
    const weightKg = safeBoxes * weightPerBox;

    let unitPrice = selectedQuickProd.sellingPrice;
    let totalPrice = quickQty * unitPrice;
    if (quickUnit === 'pcs') {
      unitPrice = selectedQuickProd.sellingPrice / pcsPerBox;
      totalPrice = quickQty * unitPrice;
    } else if (quickUnit === 'sqft') {
      unitPrice = selectedQuickProd.pricePerSqFt || (selectedQuickProd.sellingPrice / sqftPerBox);
      totalPrice = quickQty * unitPrice;
    } else if (quickUnit === 'sqmt') {
      unitPrice = (selectedQuickProd.pricePerSqFt || (selectedQuickProd.sellingPrice / sqftPerBox)) * 10.7639;
      totalPrice = quickQty * unitPrice;
    } else if (quickUnit === 'set') {
      totalPrice = quickQty * selectedQuickProd.sellingPrice;
    } else {
      totalPrice = safeBoxes * selectedQuickProd.sellingPrice;
    }

    return {
      boxes: safeBoxes,
      weightKg: Math.round(weightKg * 10) / 10,
      totalPrice: Math.round(totalPrice * 100) / 100,
      unitPrice: Math.round(unitPrice * 100) / 100
    };
  }, [selectedQuickProd, quickQty, quickUnit]);

  // Add Quick Item to Cart
  const handleAddQuickToCart = () => {
    if (!selectedQuickProd) return;

    const { boxes, weightKg, totalPrice } = quickCalculatedDetails;
    if (boxes <= 0 || selectedQuickProd.stock <= 0) return;

    setCartItems((prev) => {
      const existing = prev.find((item) => item.product.id === selectedQuickProd.id);
      if (existing) {
        const newQty = Math.min(selectedQuickProd.stock, existing.quantity + boxes);
        const unitPrice = selectedQuickProd.sellingPrice - existing.discountAmount;
        const newWeight = newQty * (selectedQuickProd.weightPerBoxKg || 25);
        return prev.map((item) =>
          item.product.id === selectedQuickProd.id
            ? {
                ...item,
                quantity: newQty,
                inputQuantity: quickQty,
                selectedUnit: quickUnit,
                itemWeightKg: Math.round(newWeight * 10) / 10,
                totalPrice: unitPrice * newQty
              }
            : item
        );
      } else {
        const initialQty = Math.min(selectedQuickProd.stock, boxes);
        return [
          ...prev,
          {
            product: selectedQuickProd,
            quantity: initialQty,
            inputQuantity: quickQty,
            selectedUnit: quickUnit,
            itemWeightKg: Math.round(weightKg * 10) / 10,
            discountAmount: 0,
            discountPercent: 0,
            finalUnitPrice: quickCalculatedDetails.unitPrice,
            totalPrice
          }
        ];
      }
    });

    // Reset quick input state
    setSelectedQuickProd(null);
    setQuickInputTerm('');
    setQuickQty(1);
    setShowQuickDropdown(false);
  };

  // Cart Handlers
  const handleAddToCartWithBoxes = (product: Product, boxCount: number) => {
    if (product.stock <= 0 || boxCount <= 0) return;

    const weightPerBox = product.weightPerBoxKg || 25;

    setCartItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        const newQty = Math.min(product.stock, existing.quantity + boxCount);
        const unitPrice = product.sellingPrice - existing.discountAmount;
        return prev.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: newQty,
                itemWeightKg: Math.round(newQty * weightPerBox * 10) / 10,
                totalPrice: unitPrice * newQty
              }
            : item
        );
      } else {
        const initialQty = Math.min(product.stock, boxCount);
        return [
          ...prev,
          {
            product,
            quantity: initialQty,
            inputQuantity: boxCount,
            selectedUnit: 'box',
            itemWeightKg: Math.round(initialQty * weightPerBox * 10) / 10,
            discountAmount: 0,
            finalUnitPrice: product.sellingPrice,
            totalPrice: product.sellingPrice * initialQty
          }
        ];
      }
    });
  };

  // Extract Categories
  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map((p) => p.category)));
    return ['ALL', ...cats];
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        p.name.toLowerCase().includes(searchLower) ||
        p.sku.toLowerCase().includes(searchLower) ||
        p.barcode.toLowerCase().includes(searchLower) ||
        (p.tileDimensions && p.tileDimensions.toLowerCase().includes(searchLower));
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchTerm]);

  // Cart Calculations
  const subtotal = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.totalPrice, 0);
  }, [cartItems]);

  const itemDiscountsTotal = useMemo(() => {
    return cartItems.reduce((acc, item) => {
      const billedQuantity = item.inputQuantity ?? item.quantity;
      return acc + item.discountAmount * billedQuantity;
    }, 0);
  }, [cartItems]);

  // Total Shipment Weight Calculation (kg)
  const totalShipmentWeightKg = useMemo(() => {
    return cartItems.reduce((acc, item) => {
      const w = item.itemWeightKg || (item.quantity * (item.product.weightPerBoxKg || 25));
      return acc + w;
    }, 0);
  }, [cartItems]);

  // Check if Auto-apply promo rule fits
  const eligiblePromos = useMemo(() => {
    return promos.filter((p) => p.isActive && subtotal >= p.minOrderValue);
  }, [promos, subtotal]);

  const autoPromo = useMemo(() => {
    if (promoDismissed || appliedPromo) return null;
    return eligiblePromos.find((p) => p.autoApply) || null;
  }, [eligiblePromos, appliedPromo, promoDismissed]);

  const activePromoRule = appliedPromo || autoPromo;

  const promoDiscountAmount = useMemo(() => {
    if (!activePromoRule) return 0;

    let discount = 0;
    if (activePromoRule.discountType === 'PERCENTAGE') {
      discount = (subtotal * activePromoRule.discountValue) / 100;
      if (activePromoRule.maxDiscountAmount && discount > activePromoRule.maxDiscountAmount) {
        discount = activePromoRule.maxDiscountAmount;
      }
    } else if (activePromoRule.discountType === 'FLAT_AMOUNT') {
      discount = Math.min(activePromoRule.discountValue, subtotal);
    }
    return discount;
  }, [activePromoRule, subtotal]);

  // Tax calculation
  const taxTotal = useMemo(() => {
    const taxableSubtotal = Math.max(0, subtotal - promoDiscountAmount - manualDiscount);
    return cartItems.reduce((acc, item) => {
      const itemTaxable = (item.totalPrice / (subtotal || 1)) * taxableSubtotal;
      return acc + (itemTaxable * (item.product.taxRate || 18.00)) / 100;
    }, 0);
  }, [cartItems, subtotal, promoDiscountAmount, manualDiscount]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal - promoDiscountAmount - manualDiscount + taxTotal);
  }, [subtotal, promoDiscountAmount, manualDiscount, taxTotal]);

  const cashChange = useMemo(() => {
    const tendered = parseFloat(cashTendered) || 0;
    return Math.max(0, tendered - grandTotal);
  }, [cashTendered, grandTotal]);

  // Standard Cart Add
  const handleAddToCart = (product: Product) => {
    if (product.stock <= 0) return;
    const weightPerBox = product.weightPerBoxKg || 25;

    setCartItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        const newQty = existing.quantity + 1;
        const unitPrice = product.sellingPrice - existing.discountAmount;
        return prev.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: newQty,
                itemWeightKg: Math.round(newQty * weightPerBox * 10) / 10,
                totalPrice: unitPrice * newQty
              }
            : item
        );
      } else {
        return [
          ...prev,
          {
            product,
            quantity: 1,
            inputQuantity: 1,
            selectedUnit: 'box',
            itemWeightKg: Math.round(weightPerBox * 10) / 10,
            discountAmount: 0,
            finalUnitPrice: product.sellingPrice,
            totalPrice: product.sellingPrice
          }
        ];
      }
    });
  };

  // Core Barcode Processor: Finds product by barcode or SKU and automatically adds to cart
  const processScannedBarcode = (code: string) => {
    if (!code) return;
    const cleanCode = code.trim().toLowerCase();

    const matchedProduct = products.find((p) => {
      const barcodeMatch = p.barcode && p.barcode.trim().toLowerCase() === cleanCode;
      const skuMatch = p.sku && p.sku.trim().toLowerCase() === cleanCode;
      const idMatch = p.id && p.id.trim().toLowerCase() === cleanCode;
      return barcodeMatch || skuMatch || idMatch;
    });

    if (matchedProduct) {
      if (matchedProduct.stock <= 0) {
        setToastNotification(`⚠️ Product "${matchedProduct.name}" is OUT OF STOCK!`);
        setTimeout(() => setToastNotification(null), 4000);
        return;
      }
      handleAddToCart(matchedProduct);
      setLastScannedCode(code.trim());
      setToastNotification(`⚡ USB Barcode Scanned: "${matchedProduct.name}" (${matchedProduct.sku}) added to cart!`);
      setSearchTerm('');
      setManualScanInput('');
      setTimeout(() => setToastNotification(null), 4000);
    } else {
      setToastNotification(`⚠️ Barcode / SKU "${code}" not found in inventory catalog.`);
      setTimeout(() => setToastNotification(null), 4000);
    }
  };

  // USB/HID Barcode Hardware Keyboard Listener
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore navigation or modifier keys
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) {
        return;
      }

      const activeElem = document.activeElement as HTMLElement | null;
      const isInputFocused =
        activeElem &&
        (activeElem.tagName === 'INPUT' || activeElem.tagName === 'TEXTAREA' || activeElem.tagName === 'SELECT');

      const now = Date.now();
      const timeDiff = now - lastKeyTime;
      lastKeyTime = now;

      // When Enter key is received (USB HID barcode scanners append Enter after scanning)
      if (e.key === 'Enter') {
        if (buffer.length >= 2) {
          const scannedCode = buffer.trim();
          buffer = '';
          if (scannedCode) {
            processScannedBarcode(scannedCode);
            if (isInputFocused && activeElem) {
              (activeElem as HTMLInputElement).blur();
            }
            e.preventDefault();
          }
        } else if (isInputFocused && activeElem?.getAttribute('placeholder')?.includes('Search catalog')) {
          // If user hit Enter while typing in main search bar
          const val = (activeElem as HTMLInputElement).value.trim();
          if (val) {
            processScannedBarcode(val);
            e.preventDefault();
          }
        }
        return;
      }

      // Single printable character
      if (e.key.length === 1) {
        // If time between keystrokes > 80ms and NOT in main search bar, reset buffer
        if (timeDiff > 80 && !isInputFocused) {
          buffer = '';
        }
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products]);

  const handleUpdateLineDiscount = (productId: string, discountPercent: number) => {
    const safePercent = Math.min(100, Math.max(0, Number(discountPercent) || 0));
    setCartItems((prev) => prev.map((item) => {
      if (item.product.id !== productId) return item;
      const billedQuantity = item.inputQuantity ?? item.quantity;
      const baseTotal = item.totalPrice + (item.discountAmount * billedQuantity);
      const discountAmount = (baseTotal * safePercent) / 100 / Math.max(1, billedQuantity);
      const baseUnitPrice = baseTotal / Math.max(1, billedQuantity);
      return {
        ...item,
        discountPercent: safePercent,
        discountAmount: Math.round(discountAmount * 100) / 100,
        finalUnitPrice: Math.round((baseUnitPrice - discountAmount) * 100) / 100,
        totalPrice: Math.round((baseTotal - (baseTotal * safePercent / 100)) * 100) / 100
      };
    }));
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setCartItems((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > item.product.stock) return item;
            const unitPrice = item.product.sellingPrice - item.discountAmount;
            const wBox = item.product.weightPerBoxKg || 25;
            return {
              ...item,
              quantity: newQty,
              itemWeightKg: Math.round(newQty * wBox * 10) / 10,
              totalPrice: unitPrice * newQty
            };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const handleApplyPromoCode = (e: React.FormEvent) => {
    e.preventDefault();
    setPromoError('');
    const code = promoInput.trim().toUpperCase();
    if (!code) return;

    const promo = promos.find((p) => p.code.toUpperCase() === code);
    if (!promo) {
      setPromoError('Invalid promo code');
      return;
    }

    if (!promo.isActive) {
      setPromoError('This promo code is currently inactive');
      return;
    }

    if (subtotal < promo.minOrderValue) {
      setPromoError(`Requires minimum order value of ${formatCurrency(promo.minOrderValue, currencySymbol)}`);
      return;
    }

    setAppliedPromo(promo);
    setPromoDismissed(false);
    setPromoInput('');
  };

  const handleCreateCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCustName.trim();
    const phone = newCustPhone.trim();
    const billingAddress = newCustBillingAddress.trim();
    const shippingAddress = (shippingSameAsBilling ? newCustBillingAddress : newCustShippingAddress).trim();
    const city = newCustCity.trim();
    const state = newCustState.trim();
    const stateCode = newCustStateCode.trim();
    const gstin = newCustTax.trim().toUpperCase();

    if (!name || !phone || !billingAddress || !city || !state) {
      setToastNotification('Customer name, mobile, billing address, city and state are required.');
      setTimeout(() => setToastNotification(null), 4500);
      return;
    }

    if (newCustType === 'LEDGER' && !gstin) {
      setToastNotification('GSTIN is mandatory for a Ledger (B2B) customer.');
      setTimeout(() => setToastNotification(null), 4500);
      return;
    }

    const created = onAddNewCustomer({
      name,
      phone,
      email: newCustEmail.trim() || undefined,
      customerType: newCustType,
      gstNumber: gstin || undefined,
      gstStatus: gstin ? 'ACTIVE' : undefined,
      taxNumber: gstin || undefined,
      address: billingAddress,
      billingAddress,
      shippingAddress: shippingAddress || billingAddress,
      city,
      state,
      stateCode: newCustType === 'LEDGER' ? stateCode : undefined,
      pincode: newCustPincode.trim() || undefined,
      gstState: state,
      gstAddress: billingAddress
    });

    setSelectedCustomer(created);
    setShowAddCustomerModal(false);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustEmail('');
    setNewCustTax('');
    setNewCustBillingAddress('');
    setNewCustShippingAddress('');
    setNewCustCity('');
    setNewCustState('');
    setNewCustStateCode('');
    setNewCustPincode('');
    setShippingSameAsBilling(true);
  };

  const handleCheckoutSubmit = async () => {
    if (cartItems.length === 0) {
      setToastNotification('Add at least one item before saving the bill.');
      setTimeout(() => setToastNotification(null), 4000);
      return;
    }

    if (!selectedCustomer || !selectedCustomer.name.trim()) {
      setToastNotification('Customer name is required before saving the bill.');
      setTimeout(() => setToastNotification(null), 4000);
      return;
    }

    if (!selectedCustomer.phone?.trim()) {
      setToastNotification('Customer mobile number is required before saving the bill.');
      setTimeout(() => setToastNotification(null), 4000);
      return;
    }

    if (!selectedCustomer.address?.trim() && !selectedCustomer.gstAddress?.trim()) {
      setToastNotification('Customer address is required before saving the bill.');
      setTimeout(() => setToastNotification(null), 4000);
      return;
    }

    if (!selectedSalesperson) {
      setToastNotification('Select a salesperson before saving the bill.');
      setTimeout(() => setToastNotification(null), 4000);
      return;
    }

    let finalInvoiceNumber = '';
    try {
      const response = await fetch('/api/invoice-number', { method: 'POST' });
      if (!response.ok) throw new Error(`Invoice numbering API HTTP ${response.status}`);
      const payload = await response.json();
      finalInvoiceNumber = String(payload?.invoiceNumber || '').trim();
      if (!finalInvoiceNumber) throw new Error('Invoice numbering API returned an empty number.');
    } catch (error) {
      console.error('Invoice number allocation failed:', error);
      setToastNotification('Unable to generate the invoice number. The bill was not saved.');
      setTimeout(() => setToastNotification(null), 5000);
      return;
    }

    const paidAmount =
      paymentMethod === 'CASH'
        ? Math.max(grandTotal, parseFloat(cashTendered) || grandTotal)
        : paymentMethod === 'ON_ACCOUNT'
        ? Math.min(grandTotal, (parseFloat(cashTendered) || 0))
        : grandTotal;

    const isFullyPaid = paidAmount >= grandTotal;
    const isUnpaid = paidAmount === 0 && paymentMethod === 'ON_ACCOUNT';
    const isPartial = paymentMethod === 'ON_ACCOUNT' && paidAmount > 0 && paidAmount < grandTotal;

    const invoiceStatus = isFullyPaid ? 'PAID' : isPartial ? 'PARTIAL' : isUnpaid ? 'UNPAID' : 'PAID';

    // Deduct stock levels
    const updatedProductsList = products.map((prod) => {
      const cartItem = cartItems.find((ci) => ci.product.id === prod.id);
      if (cartItem) {
        return {
          ...prod,
          stock: Math.max(0, prod.stock - cartItem.quantity),
          updatedAt: new Date().toISOString()
        };
      }
      return prod;
    });

    // Prepare active customer or temp ledger customer details
    let finalCustomerObj: Customer | undefined = selectedCustomer || undefined;

    if (!finalCustomerObj && customerType === 'LEDGER' && gstInput.trim()) {
      // Auto-register ledger customer if entered on the fly
      finalCustomerObj = onAddNewCustomer({
        name: ledgerCustName || gstData?.tradeName || gstData?.legalName || `Ledger GST (${gstInput})`,
        phone: ledgerCustPhone || '+91 99000 00000',
        customerType: 'LEDGER',
        gstNumber: gstInput.trim(),
        gstLegalName: gstData?.legalName,
        gstTradeName: gstData?.tradeName,
        gstStatus: gstData?.status || 'ACTIVE',
        gstState: gstData?.stateName,
        taxNumber: gstInput.trim(),
        address: gstData?.address || 'Registered Business GST Address'
      });
    }

    let updatedCustomerObj: Customer | undefined;
    if (finalCustomerObj) {
      const newBalance =
        paymentMethod === 'ON_ACCOUNT'
          ? finalCustomerObj.outstandingBalance + Math.max(0, grandTotal - paidAmount)
          : finalCustomerObj.outstandingBalance;

      updatedCustomerObj = {
        ...finalCustomerObj,
        totalSpent: finalCustomerObj.totalSpent + grandTotal,
        loyaltyPoints: finalCustomerObj.loyaltyPoints + Math.floor(grandTotal / 10),
        outstandingBalance: newBalance
      };
    }

    const newInvoice: Invoice = {
      id: generateId('inv'),
      invoiceNumber: finalInvoiceNumber,
      date: new Date().toISOString(),
      dueDate: paymentMethod === 'ON_ACCOUNT' ? dueDateInput : undefined,
      customer: updatedCustomerObj || finalCustomerObj,
      cashierName: activeUser.name,
      cashierRole: activeUser.role,
      salespersonName: selectedSalesperson.name,
      salespersonMobile: selectedSalesperson.mobile,
      items: cartItems,
      subtotal,
      itemDiscountsTotal,
      promoCodeApplied: activePromoRule ? activePromoRule.code : undefined,
      promoDiscountAmount,
      manualDiscountAmount: manualDiscount,
      taxTotal,
      grandTotal,
      amountPaid: paidAmount,
      changeGiven: paymentMethod === 'CASH' ? cashChange : 0,
      status: invoiceStatus,
      paymentMethod,
      paymentsHistory: [
        {
          id: generateId('pay'),
          amount: paidAmount,
          method: paymentMethod,
          date: new Date().toISOString(),
          notes: paymentNotes || `Initial ${paymentMethod} payment at POS`
        }
      ],
      notes: `${paymentNotes} | Shipment Weight: ${totalShipmentWeightKg.toFixed(1)} kg`
    };

    onCompleteInvoice(newInvoice, updatedProductsList, updatedCustomerObj);

    // Clear cart & state
    setCartItems([]);
    setSelectedCustomer(null);
    setSelectedSalespersonId('');
    setAppliedPromo(null);
    setPromoDismissed(false);
    setManualDiscount(0);
    setCashTendered('');
    setPaymentNotes('');
    setGstInput('');
    setGstData(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full items-start">
      {/* LEFT 7 COLS: Manual Entry (2-3 Letter Search), Categories & Product Grid */}
      <div className="lg:col-span-7 space-y-4">
        
        {/* ULTRA-FAST MANUAL TILE ENTRY BAR (2-3 Digits/Letters Type-Ahead) */}
        <div className="bg-slate-900 border-2 border-indigo-500/40 p-4 rounded-3xl shadow-xl space-y-3 relative">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-black text-indigo-400 uppercase tracking-wider flex items-center space-x-2">
              <Boxes className="w-4 h-4 text-indigo-400" />
              <span>Manual Tile Fast Entry (Type 2-3 Digits/Letters)</span>
            </span>
            <span className="text-[10px] bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded-full font-mono border border-indigo-700/50">
              Instant Auto-Suggest Engine
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {/* Typeahead Product Input (md:col-span-6) */}
            <div className="md:col-span-6 relative">
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Type 2-3 letters/digits (e.g. <span className="text-indigo-400 font-mono">600</span>, <span className="text-indigo-400 font-mono font-bold">1200</span>, <span className="text-indigo-400 font-mono">vit</span>, <span className="text-indigo-400 font-mono">sta</span>):
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-indigo-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={quickInputTerm}
                  onChange={(e) => {
                    setQuickInputTerm(e.target.value);
                    setShowQuickDropdown(true);
                  }}
                  onFocus={() => setShowQuickDropdown(true)}
                  placeholder="e.g. 600, 1200, Statuario, PGVT, 890..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-800 border border-indigo-500/50 rounded-xl text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400"
                />
                {quickInputTerm && (
                  <button
                    onClick={() => {
                      setQuickInputTerm('');
                      setSelectedQuickProd(null);
                      setShowQuickDropdown(false);
                    }}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Type-Ahead Dropdown Popover */}
              {showQuickDropdown && quickSuggestions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-slate-900 border-2 border-indigo-500/80 rounded-2xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
                  <div className="bg-slate-950 px-3 py-1.5 text-[10px] text-slate-400 font-mono border-b border-slate-800 flex justify-between">
                    <span>{quickSuggestions.length} MATCHES FOUND</span>
                    <span>SELECT PRODUCT</span>
                  </div>
                  {quickSuggestions.map((prod) => (
                    <div
                      key={prod.id}
                      onClick={() => {
                        setSelectedQuickProd(prod);
                        setQuickInputTerm(`${prod.name} (${prod.tileDimensions || prod.unit})`);
                        setShowQuickDropdown(false);
                      }}
                      className="p-2.5 border-b border-slate-800/80 hover:bg-indigo-950/60 cursor-pointer transition flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <img
                          src={prod.imageUrl || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=100&auto=format&fit=crop&q=80'}
                          alt=""
                          className="w-9 h-9 object-cover rounded-lg border border-slate-700 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-slate-100 truncate">{prod.name}</p>
                          <p className="text-[10px] text-indigo-300 font-mono">
                            {prod.tileDimensions} • {prod.tileFinish || 'Standard'} • Lot: {prod.batchNo || 'N/A'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-extrabold text-xs text-white block">
                          {formatCurrency(prod.sellingPrice, currencySymbol)}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-semibold">
                          Stock: {prod.stock} boxes ({prod.weightPerBoxKg || 25} kg/box)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Qty Input & Flexible Unit Selector (md:col-span-4) */}
            <div className="md:col-span-4 grid grid-cols-2 gap-1.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-300 mb-1">Required Qty</label>
                <input
                  type="number"
                  min="1"
                  value={quickQty}
                  onChange={(e) => setQuickQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-black text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-300 mb-1">Unit</label>
                <select
                  value={quickUnit}
                  onChange={(e) => setQuickUnit(e.target.value as TileQtyUnit)}
                  className="w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="box">Box</option>
                  <option value="pcs">Nos</option>
                </select>
              </div>
            </div>

            {/* Add Button (md:col-span-2) */}
            <div className="md:col-span-2">
              <button
                onClick={handleAddQuickToCart}
                disabled={!selectedQuickProd}
                className={`w-full py-2.5 rounded-xl text-xs font-black flex items-center justify-center space-x-1 transition shadow-lg ${
                  selectedQuickProd
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30'
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Add to Bill</span>
              </button>
            </div>
          </div>

          {/* Selected Product Calculated Details Bar */}
          {selectedQuickProd && (
            <div className="p-2.5 bg-slate-800/90 rounded-2xl border border-indigo-500/30 flex flex-wrap items-center justify-between text-xs gap-2">
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-indigo-300">{selectedQuickProd.name}</span>
                <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-md font-mono">
                  {selectedQuickProd.tileDimensions}
                </span>
              </div>

              <div className="flex items-center space-x-4 font-mono">
                <span className="text-slate-300">
                  Total Boxes: <strong className="text-white">{quickCalculatedDetails.boxes} boxes</strong>
                </span>
                <span className="text-amber-300 flex items-center space-x-1">
                  <Weight className="w-3.5 h-3.5" />
                  <span>Weight: <strong>{quickCalculatedDetails.weightKg} kg</strong></span>
                </span>
                <span className="text-emerald-400 font-extrabold">
                  Price: {formatCurrency(quickCalculatedDetails.totalPrice, currencySymbol)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Standard Search Bar & Tile Calculator Button */}
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search catalog tile name, SKU, dimensions, finish..."
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700/80 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400"
              />
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => setIsTileCalcOpen(true)}
                className="px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition"
              >
                <Calculator className="w-4 h-4 text-indigo-400" />
                <span>Tile Room Calc</span>
              </button>

              <button
                onClick={() => setShowBarcodeScannerModal(true)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 hover:border-emerald-500/50 text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition shadow relative group"
                title="USB/HID Hardware Barcode Scanner Active & Listening"
              >
                <Barcode className="w-4 h-4 text-emerald-400" />
                <span>Barcode Scan</span>
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Catalog Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[calc(100vh-25rem)] overflow-y-auto pr-1">
          {filteredProducts.map((product) => {
            const isOutOfStock = product.stock <= 0;
            const isLowStock = product.stock > 0 && product.stock <= product.reorderLevel;

            return (
              <div
                key={product.id}
                onClick={() => !isOutOfStock && handleAddToCart(product)}
                className={`group relative p-3 rounded-2xl bg-slate-900 border transition flex flex-col justify-between ${
                  isOutOfStock
                    ? 'opacity-50 border-slate-800 cursor-not-allowed'
                    : 'border-slate-800 hover:border-indigo-500/60 hover:shadow-lg cursor-pointer'
                }`}
              >
                <div>
                  <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-800 mb-2.5">
                    <img
                      src={product.imageUrl || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=300&auto=format&fit=crop&q=80'}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    {isOutOfStock ? (
                      <span className="absolute top-2 left-2 px-2 py-0.5 bg-rose-900/90 text-rose-200 font-bold text-[10px] rounded-md border border-rose-700">
                        Out of Stock
                      </span>
                    ) : isLowStock ? (
                      <span className="absolute top-2 left-2 px-2 py-0.5 bg-amber-900/90 text-amber-200 font-bold text-[10px] rounded-md border border-amber-700">
                        {product.stock} Left
                      </span>
                    ) : null}
                  </div>

                  <p className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider">
                    {product.tileDimensions || product.sku}
                  </p>
                  <h4 className="font-bold text-sm text-slate-100 group-hover:text-indigo-300 transition line-clamp-1">
                    {product.name}
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {product.weightPerBoxKg || 25} kg/box • {product.sqftPerBox || 15.5} sq.ft
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800">
                  <div>
                    <span className="font-extrabold text-base text-white">
                      {formatCurrency(product.sellingPrice, currencySymbol)}
                    </span>
                    <span className="text-[10px] text-slate-400 block">/ {product.unit}</span>
                  </div>

                  <button
                    disabled={isOutOfStock}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition ${
                      isOutOfStock
                        ? 'bg-slate-800 text-slate-600'
                        : 'bg-indigo-600/20 group-hover:bg-indigo-600 text-indigo-400 group-hover:text-white'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT 5 COLS: Customer Selector (Normal vs Ledger GST), Cart Items & Checkout */}
      <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between space-y-4">
        
        {/* CUSTOMER TYPE SELECTION & ACTIVE GST LOOKUP ENGINE */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="font-bold text-sm text-white flex items-center space-x-2">
              <User className="w-4 h-4 text-indigo-400" />
              <span>Customer Billing Mode</span>
            </h3>

            {/* Normal vs Ledger Toggle */}
            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setCustomerType('NORMAL');
                  setSelectedCustomer(null);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  customerType === 'NORMAL'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Normal (B2C)
              </button>
              <button
                type="button"
                onClick={() => setCustomerType('LEDGER')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${
                  customerType === 'LEDGER'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Ledger (GST B2B)</span>
              </button>
            </div>
          </div>

          {/* NORMAL CUSTOMER SELECTOR */}
          {customerType === 'NORMAL' ? (
            <div className="flex items-center space-x-2 bg-slate-800/80 p-2.5 rounded-2xl border border-slate-700/70">
              <User className="w-4 h-4 text-indigo-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <select
                  value={selectedCustomer?.id || ''}
                  onChange={(e) => {
                    const found = customers.find((c) => c.id === e.target.value);
                    setSelectedCustomer(found || null);
                  }}
                  className="w-full bg-transparent text-xs text-white font-medium focus:outline-none cursor-pointer"
                >
                  <option value="" className="bg-slate-900 text-slate-400">
                    Walk-in / Cash Retail Customer
                  </option>
                  {customers
                    .filter((c) => c.customerType !== 'LEDGER')
                    .map((c) => (
                      <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                        {c.name} ({c.phone}) - {c.loyaltyPoints} pts
                      </option>
                    ))}
                </select>
              </div>

              <button
                onClick={() => {
                  setNewCustType('NORMAL');
                  setShowAddCustomerModal(true);
                }}
                className="p-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-xl transition shrink-0"
                title="Add New Normal Customer"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* LEDGER / GST B2B CUSTOMER SECTION */
            <div className="bg-slate-800/90 p-3 rounded-2xl border border-emerald-500/40 space-y-3">
              {/* Existing Ledger Dropdown */}
              <div>
                <label className="block text-[10px] font-bold text-slate-300 mb-1">
                  Select Existing Ledger Account:
                </label>
                <select
                  value={selectedCustomer?.id || ''}
                  onChange={(e) => {
                    const found = customers.find((c) => c.id === e.target.value);
                    setSelectedCustomer(found || null);
                  }}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="" className="bg-slate-900 text-slate-400">
                    -- Create / Enter New Ledger GST Account --
                  </option>
                  {customers
                    .filter((c) => c.customerType === 'LEDGER' || c.gstNumber)
                    .map((c) => (
                      <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                        {c.gstTradeName || c.name} | GST: {c.gstNumber} (Bal: {formatCurrency(c.outstandingBalance, currencySymbol)})
                      </option>
                    ))}
                </select>
              </div>

              {/* GST Input & Portal Verification Engine */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-emerald-300">
                  GST Number (GSTIN) Verification:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={gstInput}
                    onChange={(e) => setGstInput(e.target.value.toUpperCase())}
                    placeholder="e.g. 24AAAAA1234A1Z5 or 27AAPCU9876M1Z2"
                    className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleVerifyGst()}
                    disabled={isVerifyingGst || !gstInput.trim()}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow"
                  >
                    {isVerifyingGst ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    )}
                    <span>Check GST</span>
                  </button>
                </div>
              </div>

              {/* GST Verification Status Badge & Business Details */}
              {gstData && (
                <div className={`p-2.5 rounded-xl border text-xs space-y-1.5 transition ${
                  gstData.status === 'ACTIVE'
                    ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-200'
                    : 'bg-rose-950/70 border-rose-500/60 text-rose-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold flex items-center space-x-1.5">
                      {gstData.status === 'ACTIVE' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                      )}
                      <span>GSTIN Status: {gstData.status}</span>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-900 rounded border border-slate-700">
                      {gstData.taxpayerType}
                    </span>
                  </div>

                  {gstData.status === 'ACTIVE' ? (
                    <div className="text-[11px] space-y-0.5 pt-1 border-t border-emerald-800/60">
                      <p><strong>Trade Name:</strong> {gstData.tradeName}</p>
                      <p><strong>Legal Name:</strong> {gstData.legalName}</p>
                      <p className="truncate"><strong>State:</strong> {gstData.stateName} ({gstData.stateCode})</p>
                      <p className="text-[10px] text-emerald-300/80 truncate"><strong>Address:</strong> {gstData.address}</p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-rose-300">{gstData.message}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Toast Floating Alert Banner */}
        {toastNotification && (
          <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white font-bold text-xs px-4 py-2.5 rounded-2xl shadow-2xl border border-emerald-400 flex items-center space-x-2 animate-bounce">
            <CheckCircle className="w-4 h-4 text-white" />
            <span>{toastNotification}</span>
          </div>
        )}

        {/* CART ITEMS & FREIGHT WEIGHT SUMMARY */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-2 gap-2">
            <div className="flex items-center space-x-2">
              <Receipt className="w-5 h-5 text-indigo-400" />
              <h3 className="font-bold text-base text-white">Current Cart Bill</h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                {cartItems.length} items
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {/* Draft Bills Trigger Button */}
              <button
                type="button"
                onClick={() => setShowDraftsModal(true)}
                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs rounded-xl border border-amber-500/40 flex items-center space-x-1.5 transition"
              >
                <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                <span>On-Hold Drafts ({drafts.length})</span>
              </button>

              {/* Total Shipment Weight Header Badge */}
              {totalShipmentWeightKg > 0 && (
                <span className="px-2.5 py-1 bg-amber-950 text-amber-300 font-mono text-xs font-bold rounded-xl border border-amber-500/40 flex items-center space-x-1.5">
                  <Weight className="w-3.5 h-3.5 text-amber-400" />
                  <span>{totalShipmentWeightKg.toFixed(1)} kg</span>
                  <span className="text-[10px] opacity-75">({(totalShipmentWeightKg / 1000).toFixed(2)} T)</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-48 space-y-2 pr-1">
            {cartItems.length === 0 ? (
              <div className="py-8 text-center text-slate-500 space-y-2">
                <Receipt className="w-10 h-10 mx-auto opacity-30 text-indigo-400" />
                <p className="text-xs">Cart is empty. Use Fast Manual Entry or click tile cards.</p>
              </div>
            ) : (
              cartItems.map((item) => {
                const itemW = item.itemWeightKg || (item.quantity * (item.product.weightPerBoxKg || 25));
                return (
                  <div
                    key={item.product.id}
                    className="p-2.5 bg-slate-800/60 rounded-2xl border border-slate-700/60 flex items-center justify-between space-x-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs text-slate-100 truncate">{item.product.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {item.product.tileDimensions || item.product.unit} • Lot: {item.product.batchNo || 'L1'}
                      </p>
                      <div className="flex items-center space-x-2 text-[10px] text-indigo-300 font-semibold mt-0.5">
                        <span>{formatCurrency(item.finalUnitPrice, currencySymbol)} × {item.inputQuantity ?? item.quantity} {item.selectedUnit || item.product.unit || 'unit'}</span>
                        <span className="text-amber-400">• {itemW.toFixed(1)} kg</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1 bg-slate-900 rounded-xl px-2 py-1 border border-slate-700">
                        <button
                          onClick={() => handleUpdateQuantity(item.product.id, -1)}
                          className="text-slate-400 hover:text-white"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold text-white px-1.5">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateQuantity(item.product.id, 1)}
                          className="text-slate-400 hover:text-white"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <label className="text-[9px] text-slate-400">Disc %</label>
                        <input type="number" min="0" max="100" step="0.01" value={item.discountPercent ?? 0} onChange={(e) => handleUpdateLineDiscount(item.product.id, Number(e.target.value))} className="w-14 px-1.5 py-1 bg-slate-900 border border-amber-500/40 rounded-lg text-[10px] text-white text-right font-bold" title="Line item discount percentage" />
                      </div>
                      <span className="font-extrabold text-xs text-white min-w-[55px] text-right">
                        {formatCurrency(item.totalPrice, currencySymbol)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Promo Code & Offers Section */}
        <div className="bg-slate-800/80 p-2.5 rounded-2xl border border-slate-700 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              <span>Promo Code & Discounts</span>
            </span>

            {activePromoRule && (
              <button
                onClick={() => setAppliedPromo(null)}
                className="text-[10px] text-rose-400 hover:underline"
              >
                Remove
              </button>
            )}
          </div>

          {activePromoRule ? (
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <select
                  value={activePromoRule.code}
                  onChange={(e) => {
                    const nextCode = e.target.value;
                    if (!nextCode) {
                      setAppliedPromo(null);
                      setPromoDismissed(true);
                      return;
                    }
                    const nextPromo = eligiblePromos.find((p) => p.code === nextCode) || null;
                    setAppliedPromo(nextPromo);
                    setPromoDismissed(false);
                  }}
                  className="flex-1 px-3 py-1 bg-slate-900 border border-emerald-500/40 rounded-xl text-xs text-white font-semibold"
                >
                  {eligiblePromos.map((promo) => (
                    <option key={promo.id} value={promo.code}>
                      {promo.code} - {promo.title}
                    </option>
                  ))}
                  <option value="">No Promotion</option>
                </select>
                <button
                  type="button"
                  onClick={() => { setAppliedPromo(null); setPromoDismissed(true); }}
                  className="px-3 py-1 text-[10px] text-rose-300 bg-rose-950/50 border border-rose-500/30 rounded-xl font-bold"
                >
                  Remove
                </button>
              </div>
              <div className="p-2 bg-emerald-950/60 border border-emerald-500/40 rounded-xl flex items-center justify-between text-xs text-emerald-300">
                <div><span className="font-bold">{activePromoRule.code}</span> ({activePromoRule.title})</div>
                <span className="font-extrabold text-emerald-400">-{formatCurrency(promoDiscountAmount, currencySymbol)}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <select
                  value=""
                  onChange={(e) => {
                    const nextPromo = eligiblePromos.find((p) => p.code === e.target.value) || null;
                    if (nextPromo) { setAppliedPromo(nextPromo); setPromoDismissed(false); }
                  }}
                  className="flex-1 px-3 py-1 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-300"
                >
                  <option value="">Select Promotion (optional)</option>
                  {eligiblePromos.map((promo) => (
                    <option key={promo.id} value={promo.code}>{promo.code} - {promo.title}</option>
                  ))}
                </select>
                <button type="button" onClick={() => setPromoDismissed(false)} className="px-3 py-1 text-[10px] text-slate-300 bg-slate-900 border border-slate-700 rounded-xl">Reset</button>
              </div>
              <form onSubmit={handleApplyPromoCode} className="flex gap-2">
                <input
                  type="text"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value)}
                  placeholder="Promo Code (e.g. WELCOME10)"
                  className="flex-1 px-3 py-1 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white uppercase tracking-wider focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button type="submit" className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow transition">Apply</button>
              </form>
            </div>
          )}

          {promoError && <p className="text-[10px] text-rose-400">{promoError}</p>}
        </div>

        {/* Salesperson Selection */}
        <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-[10px] font-bold text-slate-300">Salesperson *</label>
            <span className="text-[10px] text-slate-500">Cashier: {activeUser.name}</span>
          </div>
          <select
            value={selectedSalespersonId}
            onChange={(e) => setSelectedSalespersonId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-indigo-500/40 rounded-xl text-xs text-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Select salesperson for this bill</option>
            {salespersons.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name} ({person.mobile})
              </option>
            ))}
          </select>
          {!selectedSalespersonId && <p className="text-[10px] text-amber-400 mt-1">Select a salesperson before checkout.</p>}
        </div>

        {/* Payment Method Selector */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-300">Payment Mode</label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'CASH', label: 'Cash', icon: Banknote },
              { id: 'CARD', label: 'Card', icon: CreditCard },
              { id: 'UPI_QR', label: 'UPI / QR', icon: QrCode },
              { id: 'BANK_TRANSFER', label: 'Bank Transfer', icon: Building2 },
              { id: 'ON_ACCOUNT', label: 'On Account (Credit)', icon: Clock }
            ].map((m) => {
              const Icon = m.icon;
              const isSelected = paymentMethod === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                  className={`p-1.5 rounded-xl text-xs font-semibold flex flex-col items-center space-y-0.5 transition border ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-[10px]">{m.label}</span>
                </button>
              );
            })}
          </div>

          {paymentMethod === 'CASH' && (
            <div className="p-2 bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-300 font-medium">Cash Tendered:</span>
              <input
                type="number"
                value={cashTendered}
                onChange={(e) => setCashTendered(e.target.value)}
                placeholder={grandTotal.toFixed(2)}
                className="w-28 px-2 py-1 bg-slate-900 border border-slate-600 rounded-lg text-white font-bold text-right text-xs"
              />
              <span className="text-slate-400">Change: {formatCurrency(cashChange, currencySymbol)}</span>
            </div>
          )}

          {paymentMethod === 'UPI_QR' && (
            <div className="p-3 bg-slate-800/90 rounded-2xl border border-indigo-500/30 flex items-center justify-between gap-3 text-xs shadow-lg">
              <div className="space-y-1 overflow-hidden">
                <div className="flex items-center space-x-1.5 text-indigo-400 font-bold">
                  <QrCode className="w-4 h-4 shrink-0" />
                  <span>Scan & Pay via UPI</span>
                </div>
                <p className="text-[11px] text-slate-300 font-mono font-semibold truncate">
                  UPI ID: <strong className="text-white">{storeDetails.upiId || 'apextiles@upi'}</strong>
                </p>
                <p className="text-[10px] text-slate-400">
                  Amount Payable: <strong className="text-emerald-400 font-bold">{formatCurrency(grandTotal, currencySymbol)}</strong>
                </p>
              </div>
              <div className="shrink-0 p-1 bg-white rounded-xl shadow border border-indigo-300">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                    `upi://pay?pa=${storeDetails.upiId || 'apextiles@upi'}&pn=${encodeURIComponent(
                      storeDetails.name
                    )}&am=${grandTotal.toFixed(2)}&cu=INR&tn=${encodeURIComponent('POS Bill Counter Sale')}`
                  )}`}
                  alt="UPI QR Code"
                  className="w-16 h-16 object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          )}

          {paymentMethod === 'ON_ACCOUNT' && (
            <div className="p-2 bg-slate-800 rounded-xl border border-slate-700 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Invoice Due Date:</span>
                <input
                  type="date"
                  value={dueDateInput}
                  onChange={(e) => setDueDateInput(e.target.value)}
                  className="px-2 py-1 bg-slate-900 border border-slate-600 rounded-lg text-white text-xs"
                />
              </div>
              <p className="text-[10px] text-amber-400">Recorded under Ledger Accounts Receivable</p>
            </div>
          )}
        </div>

        {/* Totals Summary & Checkout Button */}
        <div className="pt-2 border-t border-slate-800 space-y-2">
          <div className="space-y-1 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal, currencySymbol)}</span>
            </div>
            {promoDiscountAmount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Promo Discount</span>
                <span>-{formatCurrency(promoDiscountAmount, currencySymbol)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Tax (GST 18%)</span>
              <span>{formatCurrency(taxTotal, currencySymbol)}</span>
            </div>
            {totalShipmentWeightKg > 0 && (
              <div className="flex justify-between text-amber-300 font-mono text-[11px]">
                <span>Total Freight Weight</span>
                <span>{totalShipmentWeightKg.toFixed(1)} kg ({(totalShipmentWeightKg / 1000).toFixed(2)} Tons)</span>
              </div>
            )}
            <div className="flex justify-between font-extrabold text-base text-white pt-1 border-t border-slate-800">
              <span>Grand Total</span>
              <span className="text-indigo-400">{formatCurrency(grandTotal, currencySymbol)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSaveAsDraft}
              disabled={cartItems.length === 0}
              className={`px-4 py-3 rounded-2xl font-bold text-xs flex items-center justify-center space-x-1.5 transition border ${
                cartItems.length === 0
                  ? 'bg-slate-800 text-slate-600 border-slate-700/60 cursor-not-allowed'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40 shadow-md'
              }`}
              title="Save bill on hold to restore later"
            >
              <Bookmark className="w-4 h-4 text-amber-400" />
              <span>Save Draft</span>
            </button>

            <button
              onClick={handleCheckoutSubmit}
              disabled={cartItems.length === 0}
              className={`flex-1 py-3 rounded-2xl font-bold text-sm flex items-center justify-center space-x-2 shadow-xl transition ${
                cartItems.length === 0
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-indigo-600/30'
              }`}
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>Complete Checkout & Print</span>
            </button>
          </div>
        </div>
      </div>

      {/* Add New Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-lg text-white">Add New Customer</h3>
              <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                <button
                  type="button"
                  onClick={() => setNewCustType('NORMAL')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    newCustType === 'NORMAL' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => setNewCustType('LEDGER')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    newCustType === 'LEDGER' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Ledger (GST)
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateCustomerSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {newCustType === 'LEDGER' ? 'Business / Firm Name' : 'Customer Name'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    placeholder={newCustType === 'LEDGER' ? 'e.g. Royal BuildCon Pvt Ltd' : 'e.g. John Doe'}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={newCustEmail}
                    onChange={(e) => setNewCustEmail(e.target.value)}
                    placeholder="accounts@business.com"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">GSTIN {newCustType === 'LEDGER' ? '*' : '(Optional)'}</label>
                  <input
                    type="text"
                    value={newCustTax}
                    onChange={(e) => setNewCustTax(e.target.value.toUpperCase())}
                    placeholder="24AAAAA1234A1Z5"
                    maxLength={15}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-mono uppercase"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 mb-2">Billing Address</h4>
                <textarea
                  required
                  value={newCustBillingAddress}
                  onChange={(e) => setNewCustBillingAddress(e.target.value)}
                  rows={2}
                  placeholder="Door / Flat, Street, Area, Locality"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs resize-none"
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                  <input
                    required
                    type="text"
                    value={newCustCity}
                    onChange={(e) => setNewCustCity(e.target.value)}
                    placeholder="City *"
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                  />
                  <input
                    required
                    type="text"
                    value={newCustState}
                    onChange={(e) => setNewCustState(e.target.value)}
                    placeholder="State *"
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                  />
                  {newCustType === 'LEDGER' && (
                    <input
                      required
                      type="text"
                      value={newCustStateCode}
                      onChange={(e) => setNewCustStateCode(e.target.value.toUpperCase())}
                      placeholder="State Code *"
                      maxLength={3}
                      className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs uppercase"
                    />
                  )}
                  <input
                    type="text"
                    value={newCustPincode}
                    onChange={(e) => setNewCustPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Pincode (Optional)"
                    maxLength={6}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300">Shipping Address</h4>
                  <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shippingSameAsBilling}
                      onChange={(e) => setShippingSameAsBilling(e.target.checked)}
                      className="accent-indigo-500"
                    />
                    Same as billing
                  </label>
                </div>
                {!shippingSameAsBilling && (
                  <textarea
                    required
                    value={newCustShippingAddress}
                    onChange={(e) => setNewCustShippingAddress(e.target.value)}
                    rows={2}
                    placeholder="Shipping / delivery address"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs resize-none"
                  />
                )}
              </div>

              {newCustType === 'LEDGER' && (
                <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-[11px] text-emerald-200">
                  Ledger customers require a valid GSTIN and complete billing details before they can be used on an invoice.
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800 sticky bottom-0 bg-slate-900">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tile Area & Box Calculator Modal */}
      <TileAreaCalculatorModal
        isOpen={isTileCalcOpen}
        onClose={() => setIsTileCalcOpen(false)}
        products={products}
        onAddToCartWithBoxes={handleAddToCartWithBoxes}
        currencySymbol={currencySymbol}
      />

      {/* On-Hold / Draft Bills Manager Modal */}
      {showDraftsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-2xl space-y-4 max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <FolderOpen className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-lg text-white">On-Hold Draft Bills ({drafts.length})</h3>
              </div>
              <button
                onClick={() => setShowDraftsModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {drafts.length === 0 ? (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <Bookmark className="w-12 h-12 mx-auto text-amber-400/40" />
                  <p className="text-sm font-bold text-slate-300">No Draft Bills on Hold</p>
                  <p className="text-xs text-slate-500">
                    You can save any active cart session as a draft using the "Save Draft" button in the POS panel.
                  </p>
                </div>
              ) : (
                drafts.map((d) => (
                  <div
                    key={d.id}
                    className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-3 hover:border-amber-500/50 transition"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-700/60 pb-2">
                      <div>
                        <div className="font-extrabold text-xs text-white flex items-center space-x-2">
                          <User className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{d.customer?.name || 'Walk-in Retail Customer'}</span>
                          {d.customerType === 'LEDGER' && (
                            <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                              GST Ledger
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Saved by <strong>{d.savedBy}</strong> on {formatDateTime(d.createdAt)}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-black text-amber-400 block">
                          {formatCurrency(d.totalAmount, currencySymbol)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {d.cartItems.length} items • {d.totalWeightKg.toFixed(1)} kg
                        </span>
                      </div>
                    </div>

                    {/* Draft Items Preview */}
                    <div className="text-xs text-slate-300 space-y-1">
                      <p className="text-[11px] font-semibold text-slate-400">Items in draft:</p>
                      <ul className="list-disc list-inside text-[11px] text-slate-200 space-y-0.5">
                        {d.cartItems.map((item, idx) => (
                          <li key={idx} className="truncate">
                            <strong>{item.quantity} {item.unit}</strong> - {item.product.name} ({formatCurrency(item.totalPrice, currencySymbol)})
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-700/50">
                      <button
                        onClick={() => handleDeleteDraft(d.id)}
                        className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded-xl text-xs font-semibold flex items-center space-x-1 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Draft</span>
                      </button>

                      <button
                        onClick={() => handleLoadDraft(d)}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold flex items-center space-x-1.5 shadow-lg transition"
                      >
                        <ArrowRight className="w-4 h-4" />
                        <span>Restore Draft into POS</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowDraftsModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Hardware Listener & Simulator Modal */}
      {showBarcodeScannerModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                  <Barcode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">USB / HID Barcode Scanner</h3>
                  <p className="text-xs text-slate-400">Hardware Listener Active & Ready</p>
                </div>
              </div>
              <button
                onClick={() => setShowBarcodeScannerModal(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl flex items-start space-x-3">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping shrink-0 mt-1" />
              <p className="text-xs text-emerald-200 leading-relaxed">
                <strong className="text-white font-bold">USB Hardware Scanner Status: Connected & Listening.</strong> Plug in any standard USB/HID barcode reader gun. Point and scan product barcodes anywhere in POS mode to automatically add items directly to your billing cart.
              </p>
            </div>

            {/* Manual Test Scan Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Test / Manual Barcode Entry:</label>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (manualScanInput) {
                    processScannedBarcode(manualScanInput);
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={manualScanInput}
                  onChange={(e) => setManualScanInput(e.target.value)}
                  placeholder="Scan or type barcode (e.g. 8901234567890 or TL-6060-PG)..."
                  className="flex-1 px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition shrink-0"
                >
                  Scan Item
                </button>
              </form>
            </div>

            {/* Quick Catalog Barcode Simulator List */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="text-xs font-bold text-slate-400">Quick-Test Catalog Barcodes:</span>
              <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                {products.map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between text-xs hover:border-slate-700 transition"
                  >
                    <div className="overflow-hidden pr-2">
                      <p className="font-bold text-white truncate">{p.name}</p>
                      <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono mt-0.5">
                        <span>SKU: {p.sku}</span>
                        <span>•</span>
                        <span className="text-indigo-300">Barcode: {p.barcode || 'N/A'}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => processScannedBarcode(p.barcode || p.sku)}
                      className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 rounded-xl font-bold text-[11px] transition shrink-0 flex items-center space-x-1"
                    >
                      <Barcode className="w-3.5 h-3.5" />
                      <span>Simulate Scan</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowBarcodeScannerModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
