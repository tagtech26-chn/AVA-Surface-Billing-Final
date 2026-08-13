import React, { useState, useMemo } from 'react';
import { Invoice, DeliveryStatus, Product, BusinessStoreDetails } from '../types';
import { formatCurrency, formatDateTime } from '../lib/utils';
import {
  Truck,
  PackageCheck,
  PackageSearch,
  Clock,
  CheckCircle,
  AlertCircle,
  Printer,
  Search,
  Filter,
  User,
  Phone,
  FileText,
  MapPin,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Barcode
} from 'lucide-react';

interface WarehouseViewProps {
  invoices: Invoice[];
  products: Product[];
  storeDetails: BusinessStoreDetails;
  onUpdateDeliveryStatus: (
    invoiceId: string,
    status: DeliveryStatus,
    dispatchDetails?: {
      driverName?: string;
      driverPhone?: string;
      vehicleNumber?: string;
      transporterName?: string;
      trackingNumber?: string;
      deliveryNotes?: string;
    }
  ) => void;
}

export const WarehouseView: React.FC<WarehouseViewProps> = ({
  invoices,
  products,
  storeDetails,
  onUpdateDeliveryStatus
}) => {
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showDispatchModal, setShowDispatchModal] = useState<boolean>(false);
  const [showPackingSlipModal, setShowPackingSlipModal] = useState<boolean>(false);

  // Form states for dispatching
  const [driverName, setDriverName] = useState<string>('');
  const [driverPhone, setDriverPhone] = useState<string>('');
  const [vehicleNumber, setVehicleNumber] = useState<string>('');
  const [transporterName, setTransporterName] = useState<string>('');
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [deliveryNotes, setDeliveryNotes] = useState<string>('');
  const [targetStatus, setTargetStatus] = useState<DeliveryStatus>('PACKED');

  // Low Stock Items for Warehouse Alert
  const lowStockProducts = useMemo(() => {
    return products.filter((p) => p.stock <= p.reorderLevel);
  }, [products]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const currentStatus = inv.deliveryStatus || 'PENDING_DISPATCH';
      const matchesStatus = statusFilter === 'ALL' || currentStatus === statusFilter;

      const q = searchQuery.toLowerCase();
      const matchesSearch =
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customer?.name.toLowerCase().includes(q) ||
        (inv.driverName && inv.driverName.toLowerCase().includes(q)) ||
        (inv.vehicleNumber && inv.vehicleNumber.toLowerCase().includes(q)) ||
        (inv.trackingNumber && inv.trackingNumber.toLowerCase().includes(q));

      return matchesStatus && matchesSearch;
    });
  }, [invoices, statusFilter, searchQuery]);

  // Summary Metrics
  const metrics = useMemo(() => {
    let pending = 0;
    let packed = 0;
    let inTransit = 0;
    let delivered = 0;

    invoices.forEach((inv) => {
      const st = inv.deliveryStatus || 'PENDING_DISPATCH';
      if (st === 'PENDING_DISPATCH') pending++;
      else if (st === 'PACKED') packed++;
      else if (st === 'IN_TRANSIT') inTransit++;
      else if (st === 'DELIVERED') delivered++;
    });

    return { pending, packed, inTransit, delivered };
  }, [invoices]);

  const handleOpenDispatch = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setDriverName(inv.driverName || '');
    setDriverPhone(inv.driverPhone || '');
    setVehicleNumber(inv.vehicleNumber || '');
    setTransporterName(inv.transporterName || '');
    setTrackingNumber(inv.trackingNumber || `TRK-${Date.now().toString().slice(-6)}`);
    setDeliveryNotes(inv.deliveryNotes || '');
    setTargetStatus(inv.deliveryStatus || 'PACKED');
    setShowDispatchModal(true);
  };

  const handleOpenPackingSlip = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setShowPackingSlipModal(true);
  };

  const handleSaveDispatch = () => {
    if (!selectedInvoice) return;
    onUpdateDeliveryStatus(selectedInvoice.id, targetStatus, {
      driverName,
      driverPhone,
      vehicleNumber,
      transporterName,
      trackingNumber,
      deliveryNotes
    });
    setShowDispatchModal(false);
  };

  const statusBadge = (status?: DeliveryStatus) => {
    const st = status || 'PENDING_DISPATCH';
    switch (st) {
      case 'PENDING_DISPATCH':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-[11px] font-bold">
            <Clock className="w-3 h-3" />
            <span>Pending Dispatch</span>
          </span>
        );
      case 'PACKED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 text-[11px] font-bold">
            <PackageCheck className="w-3 h-3" />
            <span>Packed &amp; Ready</span>
          </span>
        );
      case 'IN_TRANSIT':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 text-[11px] font-bold">
            <Truck className="w-3 h-3" />
            <span>Out for Delivery</span>
          </span>
        );
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[11px] font-bold">
            <CheckCircle className="w-3 h-3" />
            <span>Delivered</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 text-[11px] font-bold">
            <AlertCircle className="w-3 h-3" />
            <span>Cancelled</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-semibold">
            <Truck className="w-3.5 h-3.5" />
            <span>Logistics &amp; Dispatch Terminal</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            Warehouse Order Fulfillment
          </h1>
          <p className="text-slate-400 text-sm max-w-2xl">
            Track customer orders, assign dispatch drivers, generate delivery challans, and print packing slips for warehouse operations.
          </p>
        </div>

        {lowStockProducts.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 flex items-center space-x-3 text-amber-300 text-xs">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="font-bold">{lowStockProducts.length} Items Below Reorder Threshold</p>
              <p className="text-[11px] text-amber-400/80">Check inventory stock levels before packing large bulk orders.</p>
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Pending Dispatch</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-white">{metrics.pending}</p>
          <p className="text-[10px] text-slate-500">Requires picking &amp; packing</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Packed &amp; Ready</span>
            <PackageCheck className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-white">{metrics.packed}</p>
          <p className="text-[10px] text-slate-500">Awaiting carrier pick up</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Out for Delivery</span>
            <Truck className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-white">{metrics.inTransit}</p>
          <p className="text-[10px] text-slate-500">In transit with driver</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Completed Deliveries</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-white">{metrics.delivered}</p>
          <p className="text-[10px] text-slate-500">Fulfilled &amp; acknowledged</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search invoice #, customer, driver, tracking #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          {(['ALL', 'PENDING_DISPATCH', 'PACKED', 'IN_TRANSIT', 'DELIVERED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {st === 'ALL'
                ? 'All Orders'
                : st === 'PENDING_DISPATCH'
                ? 'Pending'
                : st === 'PACKED'
                ? 'Packed'
                : st === 'IN_TRANSIT'
                ? 'In Transit'
                : 'Delivered'}
            </button>
          ))}
        </div>
      </div>

      {/* Order Dispatch Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5">Invoice &amp; Customer</th>
                <th className="p-3.5">Items &amp; Value</th>
                <th className="p-3.5">Fulfillment Status</th>
                <th className="p-3.5">Logistics &amp; Vehicle</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    No order fulfillment entries match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/50 transition">
                    <td className="p-3.5 space-y-1">
                      <div className="font-bold text-white flex items-center space-x-2">
                        <span>{inv.invoiceNumber}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({formatDateTime(inv.date)})
                        </span>
                      </div>
                      <div className="text-slate-300 text-xs flex items-center space-x-1">
                        <User className="w-3 h-3 text-slate-500" />
                        <span>{inv.customer?.name || 'Walk-in Retail Customer'}</span>
                      </div>
                      {inv.customer?.address && (
                        <div className="text-[11px] text-slate-400 flex items-center space-x-1 truncate max-w-xs">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">{inv.customer.address}</span>
                        </div>
                      )}
                    </td>

                    <td className="p-3.5 space-y-1">
                      <div className="font-bold text-emerald-400">{formatCurrency(inv.grandTotal)}</div>
                      <div className="text-[11px] text-slate-400">
                        {inv.items.length} Product Line{inv.items.length > 1 ? 's' : ''} (
                        {inv.items.reduce((sum, item) => sum + item.quantity, 0)} units)
                      </div>
                    </td>

                    <td className="p-3.5">{statusBadge(inv.deliveryStatus)}</td>

                    <td className="p-3.5 text-slate-400 space-y-0.5 text-[11px]">
                      {inv.driverName ? (
                        <>
                          <div className="font-medium text-slate-200 flex items-center space-x-1">
                            <User className="w-3 h-3 text-indigo-400" />
                            <span>{inv.driverName}</span>
                            {inv.driverPhone && <span className="text-slate-500">({inv.driverPhone})</span>}
                          </div>
                          {inv.vehicleNumber && (
                            <div>Vehicle: <span className="text-slate-300 font-mono">{inv.vehicleNumber}</span></div>
                          )}
                          {inv.trackingNumber && (
                            <div>Tracking #: <span className="text-indigo-300 font-mono">{inv.trackingNumber}</span></div>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-500 italic">No logistics driver assigned yet</span>
                      )}
                    </td>

                    <td className="p-3.5 text-right space-x-2">
                      <button
                        onClick={() => handleOpenPackingSlip(inv)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center space-x-1 transition"
                        title="Print Packing Slip"
                      >
                        <Printer className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="hidden sm:inline">Packing Slip</span>
                      </button>

                      <button
                        onClick={() => handleOpenDispatch(inv)}
                        className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center space-x-1 transition shadow-sm"
                      >
                        <span>Update Status</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispatch Modal */}
      {showDispatchModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl text-white animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-base flex items-center space-x-2">
                  <Truck className="w-5 h-5 text-indigo-400" />
                  <span>Update Order Dispatch: {selectedInvoice.invoiceNumber}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Customer: {selectedInvoice.customer?.name || 'Walk-in'}
                </p>
              </div>
              <button onClick={() => setShowDispatchModal(false)} className="text-slate-400 hover:text-white text-lg">
                &times;
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1.5">Fulfillment Status</label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as DeliveryStatus)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                >
                  <option value="PENDING_DISPATCH">Pending Dispatch</option>
                  <option value="PACKED">Packed &amp; Ready in Warehouse</option>
                  <option value="IN_TRANSIT">Out for Delivery (In Transit)</option>
                  <option value="DELIVERED">Delivered to Customer</option>
                  <option value="CANCELLED">Cancelled Delivery</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Driver / Agent Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Robert Express"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Driver Phone #</label>
                  <input
                    type="text"
                    placeholder="+1 (555) 000-1122"
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Vehicle License No.</label>
                  <input
                    type="text"
                    placeholder="e.g. TX-8812-LOG"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Tracking Number</label>
                  <input
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Delivery &amp; Handling Notes</label>
                <textarea
                  rows={2}
                  placeholder="Special instructions for driver (e.g., Leave at front gate, fragile electronics)..."
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end space-x-3">
              <button
                onClick={() => setShowDispatchModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDispatch}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
              >
                Save Dispatch Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Packing Slip Modal */}
      {showPackingSlipModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl p-6 md:p-8 max-w-2xl w-full space-y-6 shadow-2xl relative my-8">
            <div className="flex items-center justify-between border-b pb-4 border-slate-200">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
                  WAREHOUSE PACKING SLIP &amp; DELIVERY CHALLAN
                </h2>
                <p className="text-xs text-slate-500">{storeDetails.name}</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs inline-flex items-center space-x-1.5 shadow"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Slip</span>
                </button>
                <button
                  onClick={() => setShowPackingSlipModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-800 text-xl font-bold"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Slip Header Info */}
            <div className="grid grid-cols-2 gap-4 text-xs border-b pb-4 border-slate-200">
              <div>
                <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Deliver To:</p>
                <p className="font-bold text-sm text-slate-900 mt-1">{selectedInvoice.customer?.name || 'Walk-In Customer'}</p>
                <p className="text-slate-600">{selectedInvoice.customer?.address || 'Store Pickup'}</p>
                <p className="text-slate-600">{selectedInvoice.customer?.phone || 'N/A'}</p>
              </div>

              <div className="text-right space-y-1">
                <p className="font-mono font-bold text-sm text-slate-900">{selectedInvoice.invoiceNumber}</p>
                <p className="text-slate-500">Date: {formatDateTime(selectedInvoice.date)}</p>
                <p className="text-slate-500">Tracking #: <span className="font-mono text-slate-800 font-bold">{selectedInvoice.trackingNumber || 'TRK-NEW'}</span></p>
                <p className="text-slate-500">Driver: <span className="font-bold">{selectedInvoice.driverName || 'Unassigned'}</span></p>
              </div>
            </div>

            {/* Item List Table for Warehouse Packers */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Item Picking Checklist</p>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-y border-slate-200 font-bold">
                    <th className="p-2">Check</th>
                    <th className="p-2">SKU / Item Name</th>
                    <th className="p-2 text-center">Unit</th>
                    <th className="p-2 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedInvoice.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-2 w-12 text-center">
                        <input type="checkbox" className="w-4 h-4 rounded border-slate-300" />
                      </td>
                      <td className="p-2">
                        <div className="font-bold text-slate-900">{item.product.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">SKU: {item.product.sku} | Barcode: {item.product.barcode}</div>
                      </td>
                      <td className="p-2 text-center text-slate-600">{item.product.unit}</td>
                      <td className="p-2 text-right font-bold text-sm text-slate-900">{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Signatures & Notes */}
            <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs text-slate-600">
              <div className="border-t border-slate-400 pt-2 text-center">
                <p className="font-bold">Packed &amp; Dispatched By</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Warehouse Supervisor Signature</p>
              </div>
              <div className="border-t border-slate-400 pt-2 text-center">
                <p className="font-bold">Received in Good Condition</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Customer / Receiver Signature</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
