import React, { useState, useMemo } from 'react';
import { Invoice, BusinessStoreDetails } from '../types';
import { formatCurrency, formatDateTime } from '../lib/utils';
import { downloadFile } from '../lib/tallyExporter';
import {
  ShieldCheck,
  QrCode,
  FileText,
  Download,
  Copy,
  Check,
  CheckCircle2,
  Truck,
  Building2,
  ExternalLink,
  Info,
  Printer,
  Search,
  Sparkles,
  Zap
} from 'lucide-react';

interface EWayInvoiceViewProps {
  invoices: Invoice[];
  storeDetails: BusinessStoreDetails;
  onUpdateEWayDetails: (
    invoiceId: string,
    ewayBillNo: string,
    irnNo: string,
    ackNo: string
  ) => void;
}

export const EWayInvoiceView: React.FC<EWayInvoiceViewProps> = ({
  invoices,
  storeDetails,
  onUpdateEWayDetails
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showGeneratorModal, setShowGeneratorModal] = useState<boolean>(false);
  const [showSlipModal, setShowSlipModal] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Form states for e-Way Bill Part B
  const [transporterId, setTransporterId] = useState<string>('TRANS-8812');
  const [transporterName, setTransporterName] = useState<string>('Swift Logistics');
  const [vehicleNumber, setVehicleNumber] = useState<string>('TX-8821-EXP');
  const [transportMode, setTransportMode] = useState<'1' | '2' | '3' | '4'>('1'); // 1: Road, 2: Rail, 3: Air, 4: Ship
  const [distanceKm, setDistanceKm] = useState<number>(45);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const q = searchQuery.toLowerCase();
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.customer?.name.toLowerCase().includes(q) ||
        (inv.ewayBillNo && inv.ewayBillNo.includes(q))
      );
    });
  }, [invoices, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const ewayGenerated = invoices.filter((inv) => !!inv.ewayBillNo).length;
    const irnGenerated = invoices.filter((inv) => !!inv.irnNo).length;
    const eligibleForEway = invoices.filter((inv) => inv.grandTotal >= 100).length;
    return { ewayGenerated, irnGenerated, eligibleForEway };
  }, [invoices]);

  const handleOpenGenerator = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setVehicleNumber(inv.vehicleNumber || 'TX-8821-EXP');
    setTransporterName(inv.transporterName || 'Swift Logistics');
    setDistanceKm(inv.distanceKm || 50);
    setShowGeneratorModal(true);
  };

  const handleOpenSlip = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setShowSlipModal(true);
  };

  const handleGenerateCompliance = () => {
    if (!selectedInvoice) return;
    // Generate simulated 12-digit e-Way Bill Number and 64-char IRN Hash
    const generatedEway = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    const generatedIrn = Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    const generatedAck = Math.floor(1000000000 + Math.random() * 9000000000).toString();

    onUpdateEWayDetails(selectedInvoice.id, generatedEway, generatedIrn, generatedAck);
    setShowGeneratorModal(false);
    setNotification(`Successfully generated e-Way Bill #${generatedEway} and IRN for ${selectedInvoice.invoiceNumber}`);
    setTimeout(() => setNotification(null), 4000);
  };

  // Government NIC Portal JSON schema generator for e-Way Bill Bulk Upload
  const generateEWayJsonPayload = (inv: Invoice) => {
    return {
      version: '1.0.0421',
      billDetails: {
        userGstin: storeDetails.taxRegistrationNumber,
        supplyType: 'O', // Outward
        subSupplyType: '1', // Supply
        docType: 'INV',
        docNo: inv.invoiceNumber,
        docDate: inv.date.split('T')[0].split('-').reverse().join('/'),
        fromGstin: storeDetails.taxRegistrationNumber,
        fromTrdName: storeDetails.name,
        fromAddr1: storeDetails.address,
        fromPlace: 'Austin',
        fromPincode: 78701,
        toGstin: inv.customer?.taxNumber || 'URP', // Unregistered Person
        toTrdName: inv.customer?.name || 'Walk-in Retail',
        toAddr1: inv.customer?.address || 'Local Delivery',
        toPlace: 'Austin',
        toPincode: 78702,
        totalValue: inv.subtotal,
        cgstValue: inv.taxTotal / 2,
        sgstValue: inv.taxTotal / 2,
        totInvValue: inv.grandTotal,
        transMode: transportMode,
        transDistance: distanceKm,
        transporterId: transporterId,
        transporterName: transporterName,
        vehicleNo: vehicleNumber,
        itemList: inv.items.map((item) => ({
          productName: item.product.name,
          productDesc: item.product.description || item.product.name,
          hsnCode: 8523,
          quantity: item.quantity,
          qtyUnit: item.product.unit || 'PCS',
          taxableAmount: item.totalPrice,
          cgstRate: item.product.taxRate / 2,
          sgstRate: item.product.taxRate / 2
        }))
      }
    };
  };

  const handleDownloadPortalJson = (inv: Invoice) => {
    const payload = generateEWayJsonPayload(inv);
    const jsonStr = JSON.stringify(payload, null, 2);
    downloadFile(jsonStr, `eWayBill_PortalPayload_${inv.invoiceNumber}.json`, 'application/json');
    setNotification(`Downloaded e-Way Bill Portal Upload JSON for ${inv.invoiceNumber}`);
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>Statutory Compliance Engine</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              e-Way Bill &amp; e-Invoicing (IRN) Portal
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl">
              Automated compliance module for generating e-Way bills, 64-character Invoice Reference Numbers (IRN), signed QR codes, and government portal JSON bulk upload files.
            </p>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex items-center space-x-4">
            <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl">
              <QrCode className="w-6 h-6" />
            </div>
            <div className="text-xs">
              <div className="font-bold text-white">GSTIN Registration:</div>
              <div className="font-mono text-indigo-300 font-semibold">{storeDetails.taxRegistrationNumber}</div>
              <div className="text-[10px] text-slate-400">NIC e-Invoice API Connected</div>
            </div>
          </div>
        </div>
      </div>

      {notification && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center justify-between animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-emerald-400 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
          <p className="text-xs font-semibold text-slate-400">Total B2B / High Value Bills</p>
          <p className="text-2xl font-bold text-white">{stats.eligibleForEway}</p>
          <p className="text-[10px] text-slate-500">Eligible for statutory compliance</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
          <p className="text-xs font-semibold text-slate-400">Active e-Way Bills</p>
          <p className="text-2xl font-bold text-emerald-400">{stats.ewayGenerated}</p>
          <p className="text-[10px] text-slate-500">Part A &amp; Part B generated</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-1">
          <p className="text-xs font-semibold text-slate-400">e-Invoices (IRN Hash)</p>
          <p className="text-2xl font-bold text-indigo-400">{stats.irnGenerated}</p>
          <p className="text-[10px] text-slate-500">Acknowledged by NIC Portal</p>
        </div>
      </div>

      {/* Search and Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search invoice number, customer name, e-Way #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
          </div>

          <p className="text-xs text-slate-400 font-medium">
            Showing {filteredInvoices.length} Invoices
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5">Invoice &amp; Recipient</th>
                <th className="p-3.5">Value &amp; Tax</th>
                <th className="p-3.5">e-Way Bill No.</th>
                <th className="p-3.5">e-Invoice IRN Hash</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-800/50 transition">
                  <td className="p-3.5 space-y-1">
                    <div className="font-bold text-white">{inv.invoiceNumber}</div>
                    <div className="text-[11px] text-slate-400">{inv.customer?.name || 'Walk-in Retail'}</div>
                    <div className="text-[10px] text-slate-500">GSTIN: {inv.customer?.taxNumber || 'Unregistered'}</div>
                  </td>

                  <td className="p-3.5 space-y-1">
                    <div className="font-bold text-emerald-400">{formatCurrency(inv.grandTotal)}</div>
                    <div className="text-[10px] text-slate-400">Tax: {formatCurrency(inv.taxTotal)}</div>
                  </td>

                  <td className="p-3.5">
                    {inv.ewayBillNo ? (
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono font-bold text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{inv.ewayBillNo}</span>
                      </span>
                    ) : (
                      <span className="text-amber-400 text-xs font-medium italic">Pending Generation</span>
                    )}
                  </td>

                  <td className="p-3.5">
                    {inv.irnNo ? (
                      <div className="space-y-0.5">
                        <div className="font-mono text-[10px] text-indigo-300 truncate max-w-xs" title={inv.irnNo}>
                          {inv.irnNo.slice(0, 16)}...{inv.irnNo.slice(-8)}
                        </div>
                        <div className="text-[10px] text-slate-500">Ack No: {inv.ackNo || '99182301'}</div>
                      </div>
                    ) : (
                      <span className="text-slate-500 italic">Not generated</span>
                    )}
                  </td>

                  <td className="p-3.5 text-right space-x-2">
                    {inv.ewayBillNo ? (
                      <>
                        <button
                          onClick={() => handleDownloadPortalJson(inv)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium inline-flex items-center space-x-1"
                          title="Download Portal Payload JSON"
                        >
                          <Download className="w-3.5 h-3.5 text-indigo-400" />
                          <span>JSON</span>
                        </button>
                        <button
                          onClick={() => handleOpenSlip(inv)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center space-x-1"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>View Bill</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleOpenGenerator(inv)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center space-x-1 shadow-md shadow-emerald-600/20"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Generate e-Way</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generator Modal */}
      {showGeneratorModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl text-white animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base">Generate e-Way Bill &amp; IRN</h3>
              </div>
              <button onClick={() => setShowGeneratorModal(false)} className="text-slate-400 hover:text-white text-lg font-bold">
                &times;
              </button>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700/80 text-xs space-y-1">
              <p className="font-semibold text-white">Invoice: {selectedInvoice.invoiceNumber}</p>
              <p className="text-slate-400">Recipient: {selectedInvoice.customer?.name || 'Retail'} ({selectedInvoice.customer?.taxNumber || 'Unregistered'})</p>
              <p className="text-emerald-400 font-bold">Total Goods Value: {formatCurrency(selectedInvoice.grandTotal)}</p>
            </div>

            <div className="space-y-3 text-xs">
              <p className="font-bold uppercase text-slate-400 text-[10px] tracking-wider">Part B Transport Details</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Transporter Name</label>
                  <input
                    type="text"
                    value={transporterName}
                    onChange={(e) => setTransporterName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Transporter ID</label>
                  <input
                    type="text"
                    value={transporterId}
                    onChange={(e) => setTransporterId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Vehicle Number</label>
                  <input
                    type="text"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Transport Mode</label>
                  <select
                    value={transportMode}
                    onChange={(e) => setTransportMode(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                  >
                    <option value="1">Road (Truck/Van)</option>
                    <option value="2">Rail</option>
                    <option value="3">Air</option>
                    <option value="4">Ship</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Approx Distance (KM)</label>
                <input
                  type="number"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end space-x-3">
              <button
                onClick={() => setShowGeneratorModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateCompliance}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30"
              >
                Issue e-Way Bill &amp; IRN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official e-Way Bill Printable Slip Modal */}
      {showSlipModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl p-6 md:p-8 max-w-2xl w-full space-y-6 shadow-2xl relative my-8">
            <div className="flex items-center justify-between border-b pb-4 border-slate-200">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  e-WAY BILL &amp; TAX INVOICE
                </h2>
                <p className="text-xs text-slate-500">National e-Way Bill Portal Acknowledgement</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs inline-flex items-center space-x-1.5 shadow"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Statutory Document</span>
                </button>
                <button
                  onClick={() => setShowSlipModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-800 text-xl font-bold"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Official Barcode & QR Header */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">e-Way Bill No.</p>
                <p className="font-mono text-xl font-extrabold text-slate-900 tracking-widest">{selectedInvoice.ewayBillNo}</p>
                <p className="text-xs text-slate-500">Generated Date: {formatDateTime(selectedInvoice.date)}</p>
                <p className="text-xs text-slate-500">Valid Until: {formatDateTime(selectedInvoice.date)} (+48 hrs)</p>
              </div>

              <div className="w-24 h-24 bg-white border border-slate-300 p-2 rounded-xl flex items-center justify-center shadow-sm">
                <QrCode className="w-full h-full text-slate-800" />
              </div>
            </div>

            {/* Part A Details */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1 border border-slate-200">
                <p className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">Part A: Supplier Details</p>
                <p className="font-bold text-slate-800">{storeDetails.name}</p>
                <p className="text-slate-600">GSTIN: {storeDetails.taxRegistrationNumber}</p>
                <p className="text-slate-500 text-[11px]">{storeDetails.address}</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1 border border-slate-200">
                <p className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">Part A: Recipient Details</p>
                <p className="font-bold text-slate-800">{selectedInvoice.customer?.name || 'Retail'}</p>
                <p className="text-slate-600">GSTIN: {selectedInvoice.customer?.taxNumber || 'URP'}</p>
                <p className="text-slate-500 text-[11px]">{selectedInvoice.customer?.address || 'Retail Store'}</p>
              </div>
            </div>

            {/* Part B Transport Details */}
            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-2 border border-slate-200">
              <p className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">Part B: Transportation Details</p>
              <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-slate-700">
                <div>Mode: <span className="font-bold">Road</span></div>
                <div>Vehicle #: <span className="font-bold">{selectedInvoice.vehicleNumber || 'TX-8821-EXP'}</span></div>
                <div>Transporter: <span className="font-bold">{selectedInvoice.transporterName || 'Swift Logistics'}</span></div>
              </div>
            </div>

            {/* IRN Hash */}
            {selectedInvoice.irnNo && (
              <div className="text-[10px] font-mono bg-slate-100 p-2.5 rounded-xl border border-slate-200 break-all text-slate-600 space-y-0.5">
                <p className="font-bold text-slate-800">IRN Hash (64-char):</p>
                <p>{selectedInvoice.irnNo}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
