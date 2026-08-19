import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, Clock3, FileText, PackageSearch, Plus, Receipt, RotateCcw, Save, Search,
  ShoppingCart, Trash2, UserRound, WalletCards, X
} from 'lucide-react';
import { Customer, DraftBill, Invoice, PaymentMethod, Product, PromoRule, TileQtyUnit, UserProfile, BusinessStoreDetails, CartItem } from '../types';
import { Storage } from '../lib/storage';
import { generateId } from '../lib/utils';

interface Props {
  products: Product[];
  customers: Customer[];
  promos: PromoRule[];
  activeUser: UserProfile;
  storeDetails: BusinessStoreDetails;
  onCompleteInvoice: (invoice: Invoice, updatedProducts: Product[], updatedCustomer?: Customer) => void;
  onAddNewCustomer: (newCust: Omit<Customer, 'id' | 'loyaltyPoints' | 'totalSpent' | 'outstandingBalance'>) => Customer;
  currencySymbol: string;
}

type Salesperson = { id: string; code: string; name: string; mobile: string; isActive: boolean };
type NewCustomer = { name: string; phone: string; address: string; city: string; state: string; stateCode: string; gstNumber: string };
const emptyCustomer: NewCustomer = { name: '', phone: '', address: '', city: '', state: '', stateCode: '', gstNumber: '' };

export const ModernPosBillingView: React.FC<Props> = ({
  products, customers, promos, activeUser, storeDetails, onCompleteInvoice, onAddNewCustomer, currencySymbol
}) => {
  const [search, setSearch] = useState('');
  const [serverResults, setServerResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [unit, setUnit] = useState<TileQtyUnit>('box');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customersSearch, setCustomersSearch] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerType, setCustomerType] = useState<'NORMAL' | 'LEDGER'>('NORMAL');
  const [newCustomer, setNewCustomer] = useState<NewCustomer>(emptyCustomer);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [salespersons, setSalespersons] = useState<Salesperson[]>([]);
  const [salespersonId, setSalespersonId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [cashTendered, setCashTendered] = useState('');
  const [manualDiscount, setManualDiscount] = useState(0);
  const [promoCode, setPromoCode] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showCustomerPanel, setShowCustomerPanel] = useState(false);
  const [heldBills, setHeldBills] = useState<DraftBill[]>(() => Storage.getDrafts());
  const [showHeldBills, setShowHeldBills] = useState(false);

  const activeSalesperson = useMemo(() => salespersons.find((s) => s.id === salespersonId), [salespersons, salespersonId]);
  const filteredCustomers = useMemo(() => {
    const term = customersSearch.trim().toLowerCase();
    if (!term) return customers.slice(0, 25);
    return customers.filter((c) => `${c.name} ${c.phone} ${c.gstNumber || ''}`.toLowerCase().includes(term)).slice(0, 25);
  }, [customers, customersSearch]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/salespersons')
      .then(async (r) => { if (!r.ok) throw new Error(`Salesperson API HTTP ${r.status}`); return r.json(); })
      .then((data) => { if (!cancelled) setSalespersons(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setSalespersons([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) { setServerResults([]); setSearching(false); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/products?search=${encodeURIComponent(term)}&page=1&pageSize=20`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Product API HTTP ${response.status}`);
        const payload = await response.json();
        const rows = Array.isArray(payload) ? payload : payload.items;
        if (!controller.signal.aborted) {
          setServerResults((rows || []).map((p: any) => {
            const local = products.find((x) => x.id === p.id || x.sku === p.sku);
            return {
              id: p.id, sku: p.sku, barcode: p.sku, name: p.name, category: local?.category || 'General',
              costPrice: Number(p.costPrice || 0), sellingPrice: Number(p.sellingPrice || local?.sellingPrice || 0), stock: Number(p.stock || 0),
              reorderLevel: Number(p.reorderLevel || 0), taxRate: Number(p.taxRate ?? p.gstRate ?? 0), unit: p.unit || local?.unit || 'box',
              hsnCode: p.hsnCode || local?.hsnCode, description: local?.description || '', updatedAt: new Date().toISOString(),
              sellingPricePerPcs: local?.sellingPricePerPcs,
              sellingPricePerBox: local?.sellingPricePerBox,
              sellingPricePerSqFt: local?.sellingPricePerSqFt,
              sellingPricePerSqMt: local?.sellingPricePerSqMt,
              sellingPricePerSet: local?.sellingPricePerSet,
              weightPerBoxKg: local?.weightPerBoxKg,
              pcsPerBox: local?.pcsPerBox
            } as Product;
          }));
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setServerResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [search, products]);

  const suggestions = useMemo(() => {
    if (search.trim().length < 2) return [];
    const merged = [...serverResults, ...products.filter((p) => {
      const t = search.trim().toLowerCase();
      return p.name.toLowerCase().includes(t) || p.sku.toLowerCase().includes(t) || p.barcode.toLowerCase().includes(t);
    })];
    const seen = new Set<string>();
    return merged.filter((p) => { if (seen.has(p.id)) return false; seen.add(p.id); return true; }).slice(0, 12);
  }, [products, search, serverResults]);

  const lineTotals = useMemo(() => cart.reduce((sum, line) => sum + line.totalPrice, 0), [cart]);
  const itemDiscounts = useMemo(() => cart.reduce((sum, line) => sum + line.discountAmount * line.quantity, 0), [cart]);
  const subtotal = Math.max(0, lineTotals - itemDiscounts);
  const activePromo = promos.find((p) => p.isActive && p.code.toLowerCase() === promoCode.trim().toLowerCase());
  const promoDiscount = useMemo(() => {
    if (!activePromo || subtotal < activePromo.minOrderValue) return 0;
    const value = activePromo.discountType === 'PERCENTAGE' ? subtotal * activePromo.discountValue / 100 : activePromo.discountValue;
    return Math.min(value, activePromo.maxDiscountAmount ?? value);
  }, [activePromo, subtotal]);
  const taxable = Math.max(0, subtotal - manualDiscount - promoDiscount);
  const tax = useMemo(() => cart.reduce((sum, line) => {
    const lineBase = Math.max(0, line.totalPrice - line.discountAmount * line.quantity);
    return sum + lineBase * (line.product.taxRate || 0) / 100;
  }, 0), [cart]);
  const grandTotal = Math.max(0, Math.round((taxable + tax) * 100) / 100);
  const change = paymentMethod === 'CASH' ? Math.max(0, Number(cashTendered || 0) - grandTotal) : 0;
  const totalWeight = cart.reduce((sum, line) => sum + (line.itemWeightKg || (line.quantity * (line.product.weightPerBoxKg || 25))), 0);

  const normalizeUnit = (value?: string): TileQtyUnit => {
    const normalized = (value || '').trim().toLowerCase();
    if (normalized === 'pcs' || normalized === 'pc' || normalized === 'nos' || normalized === 'no' || normalized === 'piece' || normalized === 'pieces') return 'pcs';
    if (normalized === 'box' || normalized === 'boxes') return 'box';
    if (normalized === 'sqft') return 'sqft';
    if (normalized === 'sqmt') return 'sqmt';
    if (normalized === 'set' || normalized === 'sets') return 'set';
    return 'box';
  };

  const getUnitPrice = (product: Product, selected: TileQtyUnit): number => {
    if (selected === 'pcs') return Number(product.sellingPricePerPcs ?? product.sellingPrice ?? 0);
    if (selected === 'box') return Number(product.sellingPricePerBox ?? product.sellingPrice ?? 0);
    if (selected === 'sqft') return Number(product.sellingPricePerSqFt ?? product.sellingPrice ?? 0);
    if (selected === 'sqmt') return Number(product.sellingPricePerSqMt ?? product.sellingPrice ?? 0);
    if (selected === 'set') return Number(product.sellingPricePerSet ?? product.sellingPrice ?? 0);
    return Number(product.sellingPrice ?? 0);
  };

  const chooseProduct = (product: Product) => {
    setSelectedProduct(product);
    setSearch(product.name);
    setQty(1);
    setUnit(normalizeUnit(product.unit));
  };

  const addProduct = () => {
    if (!selectedProduct || selectedProduct.stock <= 0) return;
    const enteredQty = Math.max(0.01, Number(qty) || 0.01);
    if (enteredQty > selectedProduct.stock) {
      setMessage(`Only ${selectedProduct.stock} ${selectedProduct.unit} available.`);
      return;
    }
    const unitPrice = getUnitPrice(selectedProduct, unit);
    setCart((current) => {
      const existing = current.find((line) => line.product.id === selectedProduct.id && line.selectedUnit === unit);
      if (existing) {
        const nextQty = existing.quantity + enteredQty;
        if (nextQty > selectedProduct.stock) {
          setMessage(`Only ${selectedProduct.stock} ${unit} available for this item.`);
          return current;
        }
        return current.map((line) => line === existing
          ? { ...line, quantity: nextQty, inputQuantity: nextQty, selectedUnit: unit, totalPrice: nextQty * line.finalUnitPrice,
              itemWeightKg: unit === 'box' ? nextQty * (selectedProduct.weightPerBoxKg || 25) : line.itemWeightKg }
          : line);
      }
      return [...current, {
        product: selectedProduct,
        quantity: enteredQty,
        inputQuantity: enteredQty,
        selectedUnit: unit,
        itemWeightKg: unit === 'box' ? enteredQty * (selectedProduct.weightPerBoxKg || 25) : undefined,
        discountAmount: 0,
        discountPercent: 0,
        finalUnitPrice: unitPrice,
        totalPrice: enteredQty * unitPrice
      }];
    });
    setSelectedProduct(null); setSearch(''); setQty(1); setUnit('box'); setMessage('');
  };

  const updateLine = (id: string, patch: Partial<CartItem>) => setCart((current) => current.map((line) => {
    if (line.product.id !== id) return line;
    const nextQty = Math.max(0.01, Math.min(line.product.stock, Number(patch.quantity ?? line.quantity)));
    const nextDiscount = Math.max(0, Number(patch.discountPercent ?? line.discountPercent ?? 0));
    return {
      ...line,
      ...patch,
      quantity: nextQty,
      inputQuantity: nextQty,
      discountPercent: nextDiscount,
      discountAmount: nextDiscount > 0 ? line.finalUnitPrice * nextDiscount / 100 : Number(patch.discountAmount ?? line.discountAmount),
      totalPrice: nextQty * line.finalUnitPrice,
      itemWeightKg: line.selectedUnit === 'box' ? nextQty * (line.product.weightPerBoxKg || 25) : line.itemWeightKg
    };
  }));

  const selectCustomer = (value: string) => {
    const found = customers.find((c) => c.id === value) || null;
    setCustomer(found);
    if (found?.customerType === 'LEDGER' || found?.gstNumber) setCustomerType('LEDGER');
  };

  const createCustomer = () => {
    if (!newCustomer.name.trim() || !newCustomer.phone.trim() || !newCustomer.address.trim()) {
      setMessage('Customer name, mobile and billing address are required.'); return;
    }
    const created = onAddNewCustomer({
      name: newCustomer.name.trim(), phone: newCustomer.phone.trim(), address: newCustomer.address.trim(),
      billingAddress: newCustomer.address.trim(), shippingAddress: newCustomer.address.trim(), city: newCustomer.city.trim(),
      state: newCustomer.state.trim(), stateCode: newCustomer.stateCode.trim(), gstNumber: newCustomer.gstNumber.trim() || undefined,
      customerType, email: undefined, loyaltyPoints: 0, totalSpent: 0, outstandingBalance: 0
    } as any);
    setCustomer(created); setCreatingCustomer(false); setShowCustomerPanel(false); setNewCustomer(emptyCustomer);
  };

  const saveDraft = () => {
    if (!cart.length) { setMessage('Add at least one item before holding the bill.'); return; }
    const draft: DraftBill = {
      id: generateId('draft'), createdAt: new Date().toISOString(), customer: customer || undefined, customerType,
      cartItems: cart, notes, savedBy: activeUser.name, totalAmount: grandTotal, totalWeightKg: totalWeight
    };
    const next = [draft, ...Storage.getDrafts()];
    Storage.saveDrafts(next);
    setHeldBills(next);
    setShowHeldBills(true);
    setCart([]); setManualDiscount(0); setPromoCode(''); setCashTendered(''); setNotes('');
    setMessage(`Bill placed on hold. ${next.length} bill${next.length === 1 ? '' : 's'} on hold.`);
  };

  const resumeDraft = (draft: DraftBill) => {
    if (cart.length) {
      setMessage('Clear or hold the current bill before resuming another held bill.');
      return;
    }
    setCart(draft.cartItems || []);
    setCustomer(draft.customer || null);
    setCustomerType(draft.customerType || 'NORMAL');
    setNotes(draft.notes || '');
    const next = heldBills.filter((d) => d.id !== draft.id);
    Storage.saveDrafts(next);
    setHeldBills(next);
    setShowHeldBills(false);
    setMessage('Held bill restored. Review the items and save when ready.');
  };

  const deleteDraft = (draftId: string) => {
    const next = heldBills.filter((d) => d.id !== draftId);
    Storage.saveDrafts(next);
    setHeldBills(next);
    setMessage('Held bill removed.');
  };

  const submit = async () => {
    if (!cart.length) { setMessage('Add at least one item before saving the bill.'); return; }
    if (!customer?.name || !customer.phone || !(customer.address || customer.billingAddress)) { setMessage('Select a customer or create one with mobile and address.'); setShowCustomerPanel(true); return; }
    if (!activeSalesperson) { setMessage('Select a salesperson before checkout.'); return; }
    setSaving(true); setMessage('Saving bill...');
    const updatedProducts = products.map((p) => {
      const line = cart.find((x) => x.product.id === p.id);
      return line ? { ...p, stock: Math.max(0, p.stock - line.quantity) } : p;
    });
    const now = new Date().toISOString();
    const invoice: Invoice = {
      id: generateId('inv'), invoiceNumber: `POS-${Date.now()}`, date: now, customer, cashierName: activeUser.name, cashierRole: activeUser.role,
      salespersonName: activeSalesperson.name, salespersonMobile: activeSalesperson.mobile, items: cart, subtotal, itemDiscountsTotal: itemDiscounts,
      promoCodeApplied: activePromo?.code, promoDiscountAmount: promoDiscount, manualDiscountAmount: manualDiscount, taxTotal: tax,
      grandTotal, amountPaid: 0, changeGiven: change, status: 'UNPAID', paymentMethod, paymentsHistory: [], notes: `${notes} | Shipment Weight: ${totalWeight.toFixed(1)} kg`
    };
    try {
      await onCompleteInvoice(invoice, updatedProducts, customer);
      setCart([]); setManualDiscount(0); setPromoCode(''); setCashTendered(''); setNotes(''); setMessage('Bill submitted successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save bill.');
    } finally { setSaving(false); }
  };

  const resetBill = () => { setCart([]); setManualDiscount(0); setPromoCode(''); setCashTendered(''); setNotes(''); setMessage('Current bill cleared.'); };

  return (
    <div className="space-y-4 pb-6">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/95 shadow-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><div className="p-2 rounded-xl bg-indigo-600/15 text-indigo-300"><Receipt className="w-5 h-5" /></div><div><p className="text-[10px] uppercase tracking-[0.2em] text-indigo-400 font-black">Accounting Voucher Creation</p><h1 className="text-lg font-black text-white">Sales Bill Entry</h1></div></div>
          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400"><span className="px-2 py-1 rounded-lg bg-slate-800">B2C / B2B</span><span className="px-2 py-1 rounded-lg bg-slate-800">Cashier: {activeUser.name}</span></div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 p-4">
          <div className="lg:col-span-2"><label className="label-modern">Customer</label><select value={customer?.id || ''} onChange={(e) => selectCustomer(e.target.value)} className="field-modern"><option value="">Select customer...</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name} {c.phone ? `• ${c.phone}` : ''}</option>)}</select></div>
          <div><label className="label-modern">Billing Mode</label><div className="flex h-10 rounded-xl bg-slate-950 border border-slate-700 p-1"><button onClick={() => setCustomerType('NORMAL')} className={`flex-1 rounded-lg text-[11px] font-black ${customerType === 'NORMAL' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>B2C</button><button onClick={() => setCustomerType('LEDGER')} className={`flex-1 rounded-lg text-[11px] font-black ${customerType === 'LEDGER' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>B2B</button></div></div>
          <div className="lg:col-span-2"><label className="label-modern">Salesperson *</label><select value={salespersonId} onChange={(e) => setSalespersonId(e.target.value)} className="field-modern"><option value="">Select salesperson...</option>{salespersons.filter((s) => s.isActive !== false).map((s) => <option key={s.id} value={s.id}>{s.name} • {s.mobile}</option>)}</select></div>
          <div className="flex items-end"><button onClick={() => setShowCustomerPanel((v) => !v)} className="w-full h-10 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-black flex items-center justify-center gap-2"><UserRound className="w-4 h-4" /> New / Find Customer</button></div>
        </div>
        {showCustomerPanel && <div className="mx-4 mb-4 rounded-2xl border border-indigo-500/30 bg-indigo-950/15 p-4"><div className="flex items-center justify-between mb-3"><p className="text-xs font-black text-indigo-300">Customer data entry</p><button onClick={() => setShowCustomerPanel(false)}><X className="w-4 h-4 text-slate-500" /></button></div><div className="grid grid-cols-2 lg:grid-cols-4 gap-2"><input value={customersSearch} onChange={(e) => setCustomersSearch(e.target.value)} placeholder="Search existing customer..." className="field-modern lg:col-span-2" />{filteredCustomers.slice(0, 4).map((c) => <button key={c.id} onClick={() => { setCustomer(c); setShowCustomerPanel(false); }} className="text-left rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs"><b className="text-white">{c.name}</b><span className="block text-slate-500">{c.phone || 'No mobile'}</span></button>)}</div>{creatingCustomer ? <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-3">{([['name','Name'],['phone','Mobile'],['address','Billing address'],['city','City'],['state','State'],['stateCode','State code'],['gstNumber','GSTIN']] as const).map(([key, label]) => <input key={key} value={newCustomer[key]} onChange={(e) => setNewCustomer((v) => ({ ...v, [key]: e.target.value }))} placeholder={label} className="field-modern" />)}<button onClick={createCustomer} className="h-10 rounded-xl bg-emerald-600 text-white text-xs font-black">Save Customer</button></div> : <button onClick={() => setCreatingCustomer(true)} className="mt-3 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black flex items-center gap-2"><Plus className="w-4 h-4" /> Create customer</button>}</div>}
      </div>

      <div className="rounded-2xl border-2 border-indigo-500/50 bg-slate-900 shadow-2xl overflow-visible">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between"><div className="flex items-center gap-2"><PackageSearch className="w-5 h-5 text-indigo-400" /><div><p className="text-[10px] uppercase tracking-widest text-indigo-400 font-black">Item Entry</p><p className="text-sm font-black text-white">Type item code, SKU or description</p></div></div><span className="text-[10px] font-black text-emerald-400">SERVER SEARCH • MAX 20 MATCHES</span></div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 items-end">
          <div className="md:col-span-6 relative"><label className="label-modern">Name of Item / Stock Code</label><div className="relative"><Search className="absolute left-3 top-3 w-4 h-4 text-indigo-400" /><input autoComplete="off" value={search} onChange={(e) => { setSearch(e.target.value); setSelectedProduct(null); }} placeholder="e.g. 600, PGVT, Statuario, TL-PGVT..." className="field-modern pl-10" />{search && <button onClick={() => { setSearch(''); setSelectedProduct(null); }} className="absolute right-3 top-3 text-slate-500"><X className="w-4 h-4" /></button></div>{search.trim().length >= 2 && <div className="absolute z-50 left-4 right-4 top-[76px] bg-slate-950 border border-indigo-500/60 rounded-2xl shadow-2xl overflow-hidden">{searching ? <div className="p-4 text-xs text-slate-500">Searching stock master...</div> : suggestions.length === 0 ? <div className="p-4 text-xs text-slate-500">No matching item.</div> : suggestions.map((p) => <button key={p.id} onClick={() => chooseProduct(p)} className="w-full text-left px-4 py-3 border-b border-slate-800 hover:bg-indigo-950/50 flex items-center justify-between gap-4"><div className="min-w-0"><div className="text-xs font-black text-white truncate">{p.name}</div><div className="text-[10px] font-mono text-indigo-300 mt-1">{p.sku} • {p.unit} {p.hsnCode ? `• HSN ${p.hsnCode}` : ''}</div></div><div className="text-right shrink-0"><b className="text-white text-sm">{currencySymbol}{p.sellingPrice.toFixed(2)}</b><span className={`block text-[10px] ${p.stock <= p.reorderLevel ? 'text-amber-400' : 'text-emerald-400'}`}>{p.stock} {p.unit} available</span></div></button>)}</div>}</div>
          <div><label className="label-modern">Quantity</label><input type="number" min="0.01" step="0.01" value={qty} onChange={(e) => setQty(Math.max(0.01, Number(e.target.value) || 0.01))} className="field-modern text-center font-black" /></div>
          <div><label className="label-modern">Unit</label><select value={unit} onChange={(e) => setUnit(e.target.value as TileQtyUnit)} className="field-modern"><option value="box">Box</option><option value="pcs">Nos</option></select></div>
          <div className="md:col-span-2"><label className="label-modern">Rate</label><div className="field-modern flex items-center bg-slate-950 text-white font-black">{currencySymbol}{selectedProduct ? getUnitPrice(selectedProduct, unit).toFixed(2) : '0.00'} <span className="ml-2 text-[10px] text-slate-500">/ {unit}</span></div></div>
          <button disabled={!selectedProduct} onClick={addProduct} className="h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-xs font-black flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Add</button>
        </div>
        {selectedProduct && <div className="mx-4 mb-4 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 flex flex-wrap items-center gap-4 text-[11px]"><span className="font-black text-indigo-300">{selectedProduct.name}</span><span className="text-slate-500">Stock: {selectedProduct.stock} {unit}</span><span className="text-slate-500">Tax: {selectedProduct.taxRate}%</span><span className="text-slate-500">HSN: {selectedProduct.hsnCode || '—'}</span></div>}
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-indigo-400" /><span className="text-sm font-black text-white">Current Bill</span><span className="px-2 py-0.5 rounded-lg bg-indigo-600/15 text-indigo-300 text-[10px] font-black">{cart.length} ITEMS</span></div>
          <div className="flex items-center gap-2"><button onClick={() => { setHeldBills(Storage.getDrafts()); setShowHeldBills(true); }} className="text-[11px] font-black text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 flex items-center gap-2"><Clock3 className="w-4 h-4" /> On Hold ({heldBills.length})</button><button onClick={resetBill} className="text-[10px] font-black text-slate-500 hover:text-rose-300 flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Clear</button></div>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="bg-slate-950 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="p-3">Code</th><th className="p-3">Name of Item</th><th className="p-3">Stock</th><th className="p-3">Qty</th><th className="p-3">Unit</th><th className="p-3 text-right">Rate</th><th className="p-3 text-right">Discount %</th><th className="p-3 text-right">Amount</th><th className="p-3"></th></tr></thead><tbody className="divide-y divide-slate-800">{cart.length === 0 ? <tr><td colSpan={9} className="p-12 text-center text-slate-600"><FileText className="w-8 h-8 mx-auto mb-2" /><p className="text-sm font-bold">No items entered</p><p className="text-xs mt-1">Type an item code or description above to begin.</p></td></tr> : cart.map((line) => <tr key={`${line.product.id}-${line.selectedUnit || line.product.unit}`} className="hover:bg-slate-800/30"><td className="p-3 font-mono text-xs text-indigo-300">{line.product.sku}</td><td className="p-3"><div className="text-xs font-black text-white">{line.product.name}</div><div className="text-[10px] text-slate-500">{line.product.tileDimensions || line.product.hsnCode || 'Stock item'}</div></td><td className="p-3 text-xs"><span className={line.product.stock <= line.product.reorderLevel ? 'text-amber-400' : 'text-emerald-400'}>{line.product.stock} {line.selectedUnit || line.product.unit}</span></td><td className="p-3"><input type="number" min="0.01" step="0.01" max={line.product.stock} value={line.quantity} onChange={(e) => updateLine(line.product.id, { quantity: Number(e.target.value) })} className="w-20 field-modern text-center" /></td><td className="p-3 text-xs text-slate-400 font-black">{line.selectedUnit || line.product.unit}</td><td className="p-3 text-right text-xs font-black text-white">{currencySymbol}{line.finalUnitPrice.toFixed(2)} <span className="text-[10px] text-slate-500">/ {line.selectedUnit || line.product.unit}</span></td><td className="p-3 text-right"><input type="number" min="0" max="100" value={line.discountPercent || 0} onChange={(e) => updateLine(line.product.id, { discountPercent: Number(e.target.value) })} className="w-20 field-modern text-right" /></td><td className="p-3 text-right text-sm font-black text-white">{currencySymbol}{(line.totalPrice - line.discountAmount * line.quantity).toFixed(2)}</td><td className="p-3 text-right"><button onClick={() => setCart((c) => c.filter((x) => x.product.id !== line.product.id || x.selectedUnit !== line.selectedUnit))} className="p-2 rounded-lg text-slate-500 hover:bg-rose-950 hover:text-rose-300"><Trash2 className="w-4 h-4" /></button></td></tr>)}</tbody></table></div>
      </div>

      {showHeldBills && <div className="fixed inset-0 z-[80] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowHeldBills(false)}>
        <div className="w-full max-w-3xl max-h-[80vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-widest text-amber-400 font-black">Held Transactions</p><h2 className="text-lg font-black text-white">Bills on Hold ({heldBills.length})</h2></div><button onClick={() => setShowHeldBills(false)} className="p-2 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button></div>
          <div className="max-h-[60vh] overflow-y-auto p-4 space-y-2">{heldBills.length === 0 ? <div className="py-12 text-center text-slate-500"><Clock3 className="w-8 h-8 mx-auto mb-2" /><p className="font-bold">No bills are currently on hold.</p></div> : heldBills.map((draft) => <div key={draft.id} className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"><div><div className="flex items-center gap-2"><span className="font-black text-white">{draft.customer?.name || 'Walk-in customer'}</span><span className="text-[10px] text-slate-500">{new Date(draft.createdAt).toLocaleString()}</span></div><div className="text-xs text-slate-400 mt-1">{draft.cartItems?.length || 0} item line(s) • {currencySymbol}{draft.totalAmount.toFixed(2)} • by {draft.savedBy}</div>{draft.notes && <div className="text-[10px] text-slate-500 mt-1 truncate max-w-xl">{draft.notes}</div>}</div><div className="flex items-center gap-2 shrink-0"><button onClick={() => resumeDraft(draft)} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black">Resume</button><button onClick={() => deleteDraft(draft.id)} className="px-4 py-2 rounded-lg bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs font-black">Delete</button></div></div>)}</div>
        </div>
      </div>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 rounded-2xl border border-slate-700 bg-slate-900 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-black text-white"><WalletCards className="w-4 h-4 text-indigo-400" /> Discounts & Payment</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2"><input value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="Promo code" className="field-modern" /><input type="number" min="0" value={manualDiscount} onChange={(e) => setManualDiscount(Math.max(0, Number(e.target.value) || 0))} placeholder="Manual discount" className="field-modern" /><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} className="field-modern"><option value="CASH">Cash</option><option value="CARD">Card</option><option value="UPI_QR">UPI / QR</option><option value="BANK_TRANSFER">Bank Transfer</option><option value="ON_ACCOUNT">On Account</option></select>{paymentMethod === 'CASH' ? <input type="number" min="0" value={cashTendered} onChange={(e) => setCashTendered(e.target.value)} placeholder="Cash received" className="field-modern" /> : <div className="field-modern text-slate-500">Payment requested</div>}</div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Narration / remarks" rows={2} className="field-modern resize-none w-full" />
          {activePromo && subtotal >= activePromo.minOrderValue && <div className="text-[11px] text-emerald-400 font-bold">Promo {activePromo.code} applied: {currencySymbol}{promoDiscount.toFixed(2)}</div>}
        </div>
        <div className="rounded-2xl border border-indigo-500/40 bg-slate-950 p-4 space-y-2">
          <div className="flex justify-between text-xs text-slate-400"><span>Subtotal</span><b className="text-white">{currencySymbol}{subtotal.toFixed(2)}</b></div>
          <div className="flex justify-between text-xs text-slate-400"><span>Discount</span><b className="text-amber-300">-{currencySymbol}{(itemDiscounts + manualDiscount + promoDiscount).toFixed(2)}</b></div>
          <div className="flex justify-between text-xs text-slate-400"><span>GST</span><b className="text-white">{currencySymbol}{tax.toFixed(2)}</b></div>
          <div className="border-t border-slate-800 pt-3 flex justify-between items-end"><span className="text-xs uppercase tracking-wider font-black text-indigo-300">Net Amount</span><b className="text-2xl font-black text-white">{currencySymbol}{grandTotal.toFixed(2)}</b></div>
          {paymentMethod === 'CASH' && <div className="flex justify-between text-xs text-emerald-400"><span>Change</span><b>{currencySymbol}{change.toFixed(2)}</b></div>}
          <div className="grid grid-cols-2 gap-2 pt-2"><button onClick={saveDraft} className="h-10 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs font-black flex items-center justify-center gap-2"><Clock3 className="w-4 h-4" /> Hold Bill</button><button disabled={saving} onClick={submit} className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-2"><Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Bill'}</button></div>
        </div>
      </div>

      {message && <div className="fixed bottom-5 right-5 z-50 max-w-md rounded-xl border border-indigo-500/40 bg-slate-950 px-4 py-3 text-xs font-bold text-slate-200 shadow-2xl flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> {message}<button onClick={() => setMessage('')}><X className="w-4 h-4 text-slate-500" /></button></div>}

      <style>{`\
        .label-modern{display:block;font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px}\
        .field-modern{width:100%;height:40px;padding:0 12px;border-radius:12px;background:#0f172a;border:1px solid #334155;color:#f8fafc;font-size:12px;outline:none}\
        .field-modern:focus{border-color:#6366f1;box-shadow:0 0 0 2px rgba(99,102,241,.12)}\
        select.field-modern{cursor:pointer}\
        input.field-modern::placeholder,textarea.field-modern::placeholder{color:#64748b}\
      `}</style>
    </div>
  );
};
