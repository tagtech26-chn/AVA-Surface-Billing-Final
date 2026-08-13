import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import {
  Product,
  Customer,
  PromoRule,
  Invoice,
  Expense,
  UserProfile,
  BusinessStoreDetails,
  StockAdjustment,
  PaymentMethod,
  DeliveryStatus,
  AuditLog,
  AuditCategory,
  AuditSeverity
} from './types';
import { Storage } from './lib/storage';
import { createAuditEntry } from './lib/auditLogger';

// Components
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { PosBillingView } from './components/PosBillingView';
import { InventoryView } from './components/InventoryView';
import { PromosView } from './components/PromosView';
import { FinancialDashboardView } from './components/FinancialDashboardView';
import { InvoicesView } from './components/InvoicesView';
import { WarehouseView } from './components/WarehouseView';
import { TallyIntegrationView } from './components/TallyIntegrationView';
import { EWayInvoiceView } from './components/EWayInvoiceView';
import { AuditLogView } from './components/AuditLogView';
import { UserControlModal } from './components/UserControlModal';
import { PrintableReceiptModal } from './components/PrintableReceiptModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('pos');

  // Core Data
  const [products, setProducts] = useState<Product[]>(() => Storage.getProducts());
  const [customers, setCustomers] = useState<Customer[]>(() => Storage.getCustomers());
  const [promos, setPromos] = useState<PromoRule[]>(() => Storage.getPromos());
  const [invoices, setInvoices] = useState<Invoice[]>(() => Storage.getInvoices());
  const [expenses, setExpenses] = useState<Expense[]>(() => Storage.getExpenses());
  const [users, setUsers] = useState<UserProfile[]>(() => Storage.getUsers());
  const [activeUserId, setActiveUserId] = useState<string>(() => Storage.getActiveUserId());
  const [storeDetails, setStoreDetails] = useState<BusinessStoreDetails>(() => Storage.getStoreDetails());
  const [stockLogs, setStockLogs] = useState<StockAdjustment[]>(() => Storage.getStockLogs());
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => Storage.getAuditLogs());

  // Modals
  const [isUserControlOpen, setIsUserControlOpen] = useState(false);
  const [printingInvoice, setPrintingInvoice] = useState<Invoice | null>(null);

  // Sync active user object
  const activeUser = users.find((u) => u.id === activeUserId) || users[0];

  // Save changes to local storage whenever state updates
  useEffect(() => { Storage.saveProducts(products); }, [products]);
  useEffect(() => { Storage.saveCustomers(customers); }, [customers]);
  useEffect(() => { Storage.savePromos(promos); }, [promos]);
  useEffect(() => { Storage.saveInvoices(invoices); }, [invoices]);
  useEffect(() => { Storage.saveExpenses(expenses); }, [expenses]);
  useEffect(() => { Storage.saveUsers(users); }, [users]);
  useEffect(() => { Storage.saveActiveUserId(activeUserId); }, [activeUserId]);
  useEffect(() => { Storage.saveStoreDetails(storeDetails); }, [storeDetails]);
  useEffect(() => { Storage.saveStockLogs(stockLogs); }, [stockLogs]);
  useEffect(() => { Storage.saveAuditLogs(auditLogs); }, [auditLogs]);

  // Central Helper for Logging Critical Actions
  const logAudit = (
    category: AuditCategory,
    severity: AuditSeverity,
    action: string,
    details: string,
    targetName?: string,
    targetId?: string,
    previousValue?: string,
    newValue?: string
  ) => {
    const entry = createAuditEntry(
      category,
      severity,
      action,
      activeUser,
      details,
      targetName,
      targetId,
      previousValue,
      newValue
    );
    setAuditLogs((prev) => [entry, ...prev]);
  };

  // Handler: Complete Invoice from POS
  const handleCompleteInvoice = (
    newInvoice: Invoice,
    updatedProducts: Product[],
    updatedCustomer?: Customer
  ) => {
    // Default new invoices to PENDING_DISPATCH delivery status
    const invoiceWithDelivery: Invoice = {
      ...newInvoice,
      deliveryStatus: 'PENDING_DISPATCH'
    };

    setInvoices((prev) => [invoiceWithDelivery, ...prev]);
    setProducts(updatedProducts);

    if (updatedCustomer) {
      setCustomers((prev) =>
        prev.map((c) => (c.id === updatedCustomer.id ? updatedCustomer : c))
      );
    }

    logAudit(
      'INVOICE',
      'MEDIUM',
      'POS Bill Created',
      `Issued POS Invoice #${invoiceWithDelivery.invoiceNumber} for ${invoiceWithDelivery.customer?.name || 'Walk-in'} (Total: ${storeDetails.currencySymbol}${invoiceWithDelivery.grandTotal.toFixed(2)}).`,
      invoiceWithDelivery.invoiceNumber,
      invoiceWithDelivery.id,
      'Draft Bill',
      `Paid ${storeDetails.currencySymbol}${invoiceWithDelivery.grandTotal.toFixed(2)}`
    );

    // Trigger printable receipt modal
    setPrintingInvoice(invoiceWithDelivery);
  };

  // Handler: Update Delivery Status from Warehouse
  const handleUpdateDeliveryStatus = (
    invoiceId: string,
    deliveryStatus: DeliveryStatus,
    dispatchDetails?: {
      driverName?: string;
      driverPhone?: string;
      vehicleNumber?: string;
      transporterName?: string;
      trackingNumber?: string;
      deliveryNotes?: string;
    }
  ) => {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === invoiceId) {
          return {
            ...inv,
            deliveryStatus,
            dispatchDate: new Date().toISOString(),
            ...(dispatchDetails || {})
          };
        }
        return inv;
      })
    );
  };

  // Handler: Update e-Way & e-Invoicing Details
  const handleUpdateEWayDetails = (
    invoiceId: string,
    ewayBillNo: string,
    irnNo: string,
    ackNo: string
  ) => {
    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === invoiceId) {
          return {
            ...inv,
            ewayBillNo,
            ewayBillDate: new Date().toISOString(),
            irnNo,
            ackNo,
            ackDate: new Date().toISOString()
          };
        }
        return inv;
      })
    );
  };

  // Handler: Add New Customer
  const handleAddNewCustomer = (
    newCustData: Omit<Customer, 'id' | 'loyaltyPoints' | 'totalSpent' | 'outstandingBalance'>
  ): Customer => {
    const newCust: Customer = {
      ...newCustData,
      id: `cust-${Date.now()}`,
      loyaltyPoints: 0,
      totalSpent: 0,
      outstandingBalance: 0
    };
    setCustomers((prev) => [...prev, newCust]);
    return newCust;
  };

  // Handler: Save / Update Product
  const handleSaveProduct = (product: Product) => {
    const existing = products.find((p) => p.id === product.id);
    if (existing) {
      const priceChanged =
        existing.sellingPrice !== product.sellingPrice ||
        existing.costPrice !== product.costPrice;
      logAudit(
        'PRODUCT',
        priceChanged ? 'HIGH' : 'MEDIUM',
        priceChanged ? 'Product Price Modified' : 'Product Details Updated',
        priceChanged
          ? `Updated selling price of ${product.name} from ${storeDetails.currencySymbol}${existing.sellingPrice} to ${storeDetails.currencySymbol}${product.sellingPrice}.`
          : `Updated product attributes for ${product.name}.`,
        product.name,
        product.id,
        `${storeDetails.currencySymbol}${existing.sellingPrice}`,
        `${storeDetails.currencySymbol}${product.sellingPrice}`
      );
    } else {
      logAudit(
        'PRODUCT',
        'MEDIUM',
        'New Product Created',
        `Created product entry ${product.name} (SKU: ${product.sku}) with selling price ${storeDetails.currencySymbol}${product.sellingPrice}.`,
        product.name,
        product.id,
        'Non-Existent',
        `${storeDetails.currencySymbol}${product.sellingPrice}`
      );
    }

    setProducts((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      if (exists) {
        return prev.map((p) => (p.id === product.id ? product : p));
      }
      return [product, ...prev];
    });
  };

  // Handler: Stock Adjustment
  const handleStockAdjustment = (adjustment: StockAdjustment) => {
    setStockLogs((prev) => [adjustment, ...prev]);

    logAudit(
      'STOCK',
      'MEDIUM',
      'Physical Inventory Stock Adjustment',
      `Adjusted stock for ${adjustment.productName}. Change: ${adjustment.quantityChange > 0 ? '+' : ''}${adjustment.quantityChange} units (${adjustment.reason}).`,
      adjustment.productName,
      adjustment.productId,
      'Adjustment Type',
      `${adjustment.type} (${adjustment.quantityChange > 0 ? '+' : ''}${adjustment.quantityChange})`
    );
  };

  // Handler: Save / Create Promo Rule
  const handleSavePromo = (promo: PromoRule) => {
    const existing = promos.find((p) => p.id === promo.id);
    logAudit(
      'PROMO',
      'MEDIUM',
      existing ? 'Promo Offer Updated' : 'New Promo Offer Created',
      `Saved promo rule ${promo.code} (${promo.description}).`,
      promo.code,
      promo.id
    );

    setPromos((prev) => {
      const exists = prev.some((p) => p.id === promo.id);
      if (exists) {
        return prev.map((p) => (p.id === promo.id ? promo : p));
      }
      return [promo, ...prev];
    });
  };

  const handleTogglePromoActive = (promoId: string) => {
    const target = promos.find((p) => p.id === promoId);
    if (target) {
      const nextState = !target.isActive;
      logAudit(
        'PROMO',
        'MEDIUM',
        nextState ? 'Promo Offer Activated' : 'Promo Offer Deactivated',
        `${nextState ? 'Enabled' : 'Disabled'} promo code ${target.code}.`,
        target.code,
        target.id,
        target.isActive ? 'Active' : 'Inactive',
        nextState ? 'Active' : 'Inactive'
      );
    }

    setPromos((prev) =>
      prev.map((p) => (p.id === promoId ? { ...p, isActive: !p.isActive } : p))
    );
  };

  // Handler: Record Invoice Payment
  const handleRecordInvoicePayment = (
    invoiceId: string,
    paymentAmount: number,
    method: PaymentMethod,
    notes?: string
  ) => {
    const targetInv = invoices.find((i) => i.id === invoiceId);
    logAudit(
      'INVOICE',
      'MEDIUM',
      'Invoice AR Payment Received',
      `Recorded payment of ${storeDetails.currencySymbol}${paymentAmount.toFixed(2)} via ${method} for invoice ${targetInv?.invoiceNumber || invoiceId}.`,
      targetInv?.invoiceNumber || invoiceId,
      invoiceId
    );

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === invoiceId) {
          const newAmountPaid = inv.amountPaid + paymentAmount;
          const isFullyPaid = newAmountPaid >= inv.grandTotal;
          const newStatus = isFullyPaid ? 'PAID' : 'PARTIAL';

          const newPaymentRecord = {
            id: `pay-${Date.now()}`,
            amount: paymentAmount,
            method,
            date: new Date().toISOString(),
            notes: notes || 'AR Payment Received'
          };

          return {
            ...inv,
            amountPaid: newAmountPaid,
            status: newStatus,
            paymentsHistory: [...inv.paymentsHistory, newPaymentRecord]
          };
        }
        return inv;
      })
    );
  };

  // Handler: Process Invoice Refund
  const handleProcessRefund = (invoiceId: string, restockItems: boolean) => {
    const targetInv = invoices.find((i) => i.id === invoiceId);
    logAudit(
      'INVOICE',
      'HIGH',
      'Invoice Refund Processed',
      `Processed cancellation & refund for invoice ${targetInv?.invoiceNumber || invoiceId}. Stock auto-restocked: ${restockItems ? 'YES' : 'NO'}.`,
      targetInv?.invoiceNumber || invoiceId,
      invoiceId,
      `Status: ${targetInv?.status || 'PAID'}`,
      'Status: REFUNDED'
    );

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.id === invoiceId) {
          if (restockItems) {
            // Restock items into inventory
            setProducts((prodList) =>
              prodList.map((prod) => {
                const item = inv.items.find((ci) => ci.product.id === prod.id);
                if (item) {
                  return {
                    ...prod,
                    stock: prod.stock + item.quantity
                  };
                }
                return prod;
              })
            );
          }
          return {
            ...inv,
            status: 'REFUNDED'
          };
        }
        return inv;
      })
    );
  };

  // Handler: Add Expense
  const handleAddExpense = (expense: Expense) => {
    setExpenses((prev) => [expense, ...prev]);
  };

  // Handler: Add User Profile
  const handleCreateUser = (newUser: Omit<UserProfile, 'id'>) => {
    const created: UserProfile = {
      ...newUser,
      id: `u-${Date.now()}`
    };
    setUsers((prev) => [...prev, created]);

    logAudit(
      'USER',
      'CRITICAL',
      'Staff Account & Role Created',
      `Created staff account for ${created.name} (${created.email}) assigned to role ${created.role}.`,
      created.name,
      created.id,
      'Unassigned',
      `Role: ${created.role}`
    );
  };

  // Handler: Reset Demo Seed Data
  const handleResetSeedData = () => {
    if (window.confirm('Reset all store data back to initial demo seeds?')) {
      Storage.resetToDefaultSeed();
      window.location.reload();
    }
  };

  const lowStockProducts = useMemo(() => products.filter((p) => p.stock <= p.reorderLevel), [products]);
  const lowStockCount = lowStockProducts.length;
  const activePromoCount = promos.filter((p) => p.isActive).length;
  const unpaidInvoiceCount = invoices.filter((i) => i.status === 'UNPAID' || i.status === 'PARTIAL').length;
  const pendingDispatchCount = invoices.filter((i) => !i.deliveryStatus || i.deliveryStatus === 'PENDING_DISPATCH').length;

  const [showLowStockToast, setShowLowStockToast] = useState(true);

  // Trigger low-stock alert toast when active user logs in / switches or on low stock count changes
  useEffect(() => {
    if (lowStockCount > 0) {
      setShowLowStockToast(true);
    }
  }, [activeUserId, lowStockCount]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <Header
        storeDetails={storeDetails}
        activeUser={activeUser}
        onOpenUserControl={() => setIsUserControlOpen(true)}
        onResetSeedData={handleResetSeedData}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lowStockProducts={lowStockProducts}
      />

      {/* Persistent Low Stock Toast Alert Banner upon Login / Session */}
      {showLowStockToast && lowStockCount > 0 && (
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-rose-950 border-b border-amber-500/30 px-4 py-2.5 text-xs text-amber-200 flex items-center justify-between shadow-xl sticky top-16 z-20 transition-all">
          <div className="flex items-center space-x-3 overflow-hidden">
            <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
            <div className="flex items-center space-x-2 truncate">
              <span className="font-black tracking-wide text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/30 shrink-0">
                ⚠️ REORDER ALERT ({lowStockCount})
              </span>
              <span className="hidden sm:inline font-medium text-slate-200 truncate">
                Logged in as <strong className="text-white font-bold">{activeUser.name}</strong>. {lowStockCount} product{lowStockCount > 1 ? 's' : ''} at or below reorder threshold:
              </span>
              <span className="font-semibold text-amber-300 truncate">
                {lowStockProducts.slice(0, 3).map((p) => `${p.name} (${p.stock} left)`).join(', ')}
                {lowStockCount > 3 ? ` +${lowStockCount - 3} more` : ''}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0 ml-3">
            <button
              onClick={() => setActiveTab('inventory')}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-lg transition shadow text-[11px]"
            >
              Review Inventory
            </button>
            <button
              onClick={() => setShowLowStockToast(false)}
              className="p-1 text-slate-400 hover:text-white transition"
              title="Dismiss Alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <Navigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          userRole={activeUser.role}
          lowStockCount={lowStockCount}
          activePromoCount={activePromoCount}
          unpaidInvoiceCount={unpaidInvoiceCount}
          pendingDispatchCount={pendingDispatchCount}
        />

        {/* Content View Container */}
        <main className="flex-1 p-4 sm:p-6 pb-20 md:pb-6 overflow-y-auto max-w-7xl mx-auto w-full">
          {activeTab === 'pos' && (
            <PosBillingView
              products={products}
              customers={customers}
              promos={promos}
              activeUser={activeUser}
              storeDetails={storeDetails}
              onCompleteInvoice={handleCompleteInvoice}
              onAddNewCustomer={handleAddNewCustomer}
              currencySymbol={storeDetails.currencySymbol}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryView
              products={products}
              onSaveProduct={handleSaveProduct}
              onStockAdjustment={handleStockAdjustment}
              stockLogs={stockLogs}
              userRole={activeUser.role}
              currencySymbol={storeDetails.currencySymbol}
            />
          )}

          {activeTab === 'warehouse' && (
            <WarehouseView
              invoices={invoices}
              products={products}
              storeDetails={storeDetails}
              onUpdateDeliveryStatus={handleUpdateDeliveryStatus}
            />
          )}

          {activeTab === 'promos' && (
            <PromosView
              promos={promos}
              onSavePromo={handleSavePromo}
              onTogglePromoActive={handleTogglePromoActive}
              currencySymbol={storeDetails.currencySymbol}
            />
          )}

          {activeTab === 'invoices' && (
            <InvoicesView
              invoices={invoices}
              onRecordPayment={handleRecordInvoicePayment}
              onProcessRefund={handleProcessRefund}
              onSelectInvoiceToPrint={(inv) => setPrintingInvoice(inv)}
              currencySymbol={storeDetails.currencySymbol}
            />
          )}

          {activeTab === 'eway' && (
            <EWayInvoiceView
              invoices={invoices}
              storeDetails={storeDetails}
              onUpdateEWayDetails={handleUpdateEWayDetails}
            />
          )}

          {activeTab === 'tally' && (
            <TallyIntegrationView
              invoices={invoices}
              expenses={expenses}
              products={products}
              customers={customers}
            />
          )}

          {activeTab === 'reports' && (
            <FinancialDashboardView
              invoices={invoices}
              expenses={expenses}
              products={products}
              onAddExpense={handleAddExpense}
              currencySymbol={storeDetails.currencySymbol}
            />
          )}

          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
                <h2 className="text-xl font-bold text-white">Staff Accounts &amp; User Controls</h2>
                <p className="text-xs text-slate-400">
                  Switch active staff session or add new cashier, manager, accountant, or warehouse profiles.
                </p>
                <button
                  onClick={() => setIsUserControlOpen(true)}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition"
                >
                  Manage User Profiles &amp; Roles
                </button>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <AuditLogView
              auditLogs={auditLogs}
              onClearLogs={() => {
                setAuditLogs([]);
                Storage.saveAuditLogs([]);
              }}
              userRole={activeUser.role}
              currencySymbol={storeDetails.currencySymbol}
            />
          )}
        </main>
      </div>

      {/* User Control & Role Switcher Modal */}
      <UserControlModal
        isOpen={isUserControlOpen}
        onClose={() => setIsUserControlOpen(false)}
        users={users}
        activeUser={activeUser}
        onSwitchUser={(user) => setActiveUserId(user.id)}
        onCreateUser={handleCreateUser}
        currencySymbol={storeDetails.currencySymbol}
      />

      {/* Printable Receipt Modal */}
      <PrintableReceiptModal
        invoice={printingInvoice}
        onClose={() => setPrintingInvoice(null)}
        storeDetails={storeDetails}
      />
    </div>
  );
}
