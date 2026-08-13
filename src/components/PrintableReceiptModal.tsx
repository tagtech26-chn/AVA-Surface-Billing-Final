import React from 'react';
import { Invoice, BusinessStoreDetails } from '../types';
import { formatCurrency, formatDateTime } from '../lib/utils';
import { Printer, Download, X, Store, CheckCircle2, QrCode } from 'lucide-react';

interface PrintableReceiptModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  storeDetails: BusinessStoreDetails;
}

export const PrintableReceiptModal: React.FC<PrintableReceiptModalProps> = ({
  invoice,
  onClose,
  storeDetails
}) => {
  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white text-slate-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative">
        {/* Controls Header (Hidden during print) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center space-x-2">
            <Printer className="w-5 h-5 text-indigo-400" />
            <span className="font-bold text-sm">Receipt & Invoice Preview</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 shadow transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="p-8 space-y-6 text-xs print:p-0 print:text-black font-sans">
          {/* Store Branding Header */}
          <div className="text-center space-y-1 border-b border-slate-200 pb-4">
            <div className="w-10 h-10 mx-auto rounded-xl bg-slate-900 text-white flex items-center justify-center mb-1">
              <Store className="w-5 h-5" />
            </div>
            <h2 className="font-black text-lg text-slate-900 uppercase tracking-tight">{storeDetails.name}</h2>
            <p className="text-[11px] text-slate-500 italic">{storeDetails.tagline}</p>
            <p className="text-[11px] text-slate-600">{storeDetails.address}</p>
            <p className="text-[11px] text-slate-600">Tel: {storeDetails.phone} | Tax ID: {storeDetails.taxRegistrationNumber}</p>
          </div>

          {/* Invoice Meta */}
          <div className="flex justify-between items-start text-[11px] bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <div>
              <p className="font-mono font-bold text-slate-900 text-sm">{invoice.invoiceNumber}</p>
              <p className="text-slate-500">Date: {formatDateTime(invoice.date)}</p>
              <p className="text-slate-500">Issued By: {invoice.cashierName} ({invoice.cashierRole})</p>
            </div>

            <div className="text-right">
              {invoice.customer ? (
                <div>
                  <p className="font-bold text-slate-900">Billed To:</p>
                  <p className="text-slate-700">{invoice.customer.name}</p>
                  <p className="text-slate-500">{invoice.customer.phone}</p>
                </div>
              ) : (
                <p className="font-semibold text-slate-500">Walk-in Customer</p>
              )}
            </div>
          </div>

          {/* Itemized Line Items Table */}
          <div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-900 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-2">Item</th>
                  <th className="py-2 text-center">Qty</th>
                  <th className="py-2 text-right">Unit Price</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {invoice.items.map((item, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-2">
                      <p className="font-bold text-slate-900">{item.product.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{item.product.sku}</p>
                    </td>
                    <td className="py-2 text-center font-bold">{item.quantity}</td>
                    <td className="py-2 text-right">{formatCurrency(item.finalUnitPrice, storeDetails.currencySymbol)}</td>
                    <td className="py-2 text-right font-extrabold">{formatCurrency(item.totalPrice, storeDetails.currencySymbol)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Breakdown */}
          <div className="pt-3 border-t-2 border-slate-900 space-y-1.5 text-right font-medium text-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal:</span>
              <span>{formatCurrency(invoice.subtotal, storeDetails.currencySymbol)}</span>
            </div>

            {invoice.promoDiscountAmount > 0 && (
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Promo Discount ({invoice.promoCodeApplied}):</span>
                <span>-{formatCurrency(invoice.promoDiscountAmount, storeDetails.currencySymbol)}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-slate-500">Tax Breakdown (VAT/GST):</span>
              <span>{formatCurrency(invoice.taxTotal, storeDetails.currencySymbol)}</span>
            </div>

            <div className="flex justify-between font-black text-slate-900 text-base pt-2 border-t border-slate-200">
              <span>Grand Total:</span>
              <span>{formatCurrency(invoice.grandTotal, storeDetails.currencySymbol)}</span>
            </div>

            <div className="flex justify-between text-slate-600 text-[11px]">
              <span>Payment Mode ({invoice.paymentMethod}):</span>
              <span>{formatCurrency(invoice.amountPaid, storeDetails.currencySymbol)}</span>
            </div>

            {invoice.changeGiven > 0 && (
              <div className="flex justify-between text-slate-600 text-[11px]">
                <span>Change Returned:</span>
                <span>{formatCurrency(invoice.changeGiven, storeDetails.currencySymbol)}</span>
              </div>
            )}
          </div>

          {/* Dynamic UPI / QR Code Section */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 text-left print:border-slate-300">
            <div className="space-y-1">
              <div className="flex items-center space-x-1.5 text-xs font-black text-slate-900">
                <QrCode className="w-4 h-4 text-indigo-600" />
                <span>UPI / Digital Payment QR</span>
              </div>
              <p className="text-[11px] font-bold text-slate-800">
                UPI ID: <span className="font-mono text-indigo-700">{storeDetails.upiId || 'apextiles@upi'}</span>
              </p>
              <p className="text-[10px] text-slate-500">
                Scan via GPay, PhonePe, Paytm, or BHIM UPI to pay <strong className="text-slate-900 font-bold">{formatCurrency(invoice.grandTotal, storeDetails.currencySymbol)}</strong>
              </p>
              <div className="flex items-center space-x-1 pt-0.5 text-[9px] font-bold text-slate-500 uppercase">
                <span className="px-1.5 py-0.5 bg-slate-200/80 rounded">GPay</span>
                <span className="px-1.5 py-0.5 bg-slate-200/80 rounded">PhonePe</span>
                <span className="px-1.5 py-0.5 bg-slate-200/80 rounded">Paytm</span>
                <span className="px-1.5 py-0.5 bg-slate-200/80 rounded">BHIM</span>
              </div>
            </div>

            <div className="shrink-0 text-center space-y-0.5">
              <div className="p-1 bg-white border border-slate-300 rounded-xl shadow-sm inline-block">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                    `upi://pay?pa=${storeDetails.upiId || 'apextiles@upi'}&pn=${encodeURIComponent(
                      storeDetails.name
                    )}&am=${invoice.grandTotal.toFixed(2)}&cu=INR&tn=${encodeURIComponent(
                      'Bill ' + invoice.invoiceNumber
                    )}`
                  )}`}
                  alt="UPI QR Code"
                  className="w-20 h-20 object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <p className="text-[9px] font-mono font-bold text-indigo-700">
                {formatCurrency(invoice.grandTotal, storeDetails.currencySymbol)}
              </p>
            </div>
          </div>

          {/* Barcode & Footer Policy */}
          <div className="pt-6 border-t border-dashed border-slate-300 text-center space-y-2">
            <div className="font-mono text-center tracking-widest text-lg font-bold text-slate-800">
              ||| | ||||| || |||| ||| |||||
            </div>
            <p className="text-[10px] text-slate-500 uppercase font-mono">{invoice.id}</p>
            <p className="text-[11px] text-slate-600 font-semibold">{storeDetails.receiptHeader}</p>
            <p className="text-[10px] text-slate-400 leading-normal">{storeDetails.receiptFooter}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
