import React from 'react';
import { Invoice, BusinessStoreDetails } from '../types';
import { formatCurrency, formatDateTime } from '../lib/utils';
import { Printer, X } from 'lucide-react';

interface PrintableReceiptModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  storeDetails: BusinessStoreDetails;
}

export const PrintableReceiptModal: React.FC<PrintableReceiptModalProps> = ({ invoice, onClose, storeDetails }) => {
  if (!invoice) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white text-slate-900 w-full max-w-lg shadow-2xl">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <span className="font-bold text-sm">AVA Surfaces — Tax Invoice Preview</span>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="px-4 py-2 bg-white text-slate-900 rounded font-bold text-sm flex items-center gap-2"><Printer className="w-4 h-4" /> Print / PDF</button>
            <button onClick={onClose} className="p-2 bg-slate-800 rounded"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="p-8 text-xs">
          <div className="text-center border-b border-slate-300 pb-4">
            <div className="text-4xl font-black tracking-[-5px] text-[#b51f2a]">AVA</div>
            <div className="text-sm tracking-[5px] font-semibold">SURFACES</div>
            <h2 className="font-black text-lg uppercase mt-2">AVA SURFACES PVT LIMITED</h2>
            <p>{storeDetails.address}</p>
            <p>GSTIN: {storeDetails.taxRegistrationNumber}</p>
          </div>
          <div className="mt-4 flex justify-between border border-black p-3">
            <div><b>Invoice No:</b> {invoice.invoiceNumber}<br/><b>Date:</b> {formatDateTime(invoice.date)}</div>
            <div><b>Buyer:</b> {invoice.customer?.name || 'Customer Required'}<br/>{invoice.customer?.address || ''}<br/>{invoice.customer?.gstNumber || ''}</div>
          </div>
          <table className="w-full mt-4 border-collapse border border-black">
            <thead><tr><th className="border border-black p-1">S.No</th><th className="border border-black p-1">Description of Goods</th><th className="border border-black p-1">HSN/SAC</th><th className="border border-black p-1">GST %</th><th className="border border-black p-1">Qty</th><th className="border border-black p-1">Disc %</th><th className="border border-black p-1">Amount</th></tr></thead>
            <tbody>{invoice.items.map((item, i) => <tr key={i}><td className="border border-black p-1 text-center">{i + 1}</td><td className="border border-black p-1">{item.product.name}</td><td className="border border-black p-1 text-center">{item.product.hsnCode || '-'}</td><td className="border border-black p-1 text-center">{item.product.taxRate}%</td><td className="border border-black p-1 text-right">{item.quantity}</td><td className="border border-black p-1 text-right">{item.discountPercent ?? 0}%</td><td className="border border-black p-1 text-right">{formatCurrency(item.totalPrice, storeDetails.currencySymbol)}</td></tr>)}</tbody>
          </table>
          <div className="mt-4 ml-auto w-64 border border-black p-3 space-y-1">
            <div className="flex justify-between"><span>Sub Total</span><b>{formatCurrency(invoice.subtotal, storeDetails.currencySymbol)}</b></div>
            <div className="flex justify-between"><span>Promo Discount</span><b>-{formatCurrency(invoice.promoDiscountAmount, storeDetails.currencySymbol)}</b></div>
            <div className="flex justify-between"><span>CGST</span><b>{formatCurrency(invoice.cgstAmount, storeDetails.currencySymbol)}</b></div>
            <div className="flex justify-between"><span>SGST</span><b>{formatCurrency(invoice.sgstAmount, storeDetails.currencySymbol)}</b></div>
            <div className="flex justify-between"><span>Round Off</span><b>{formatCurrency(invoice.roundOffAmount, storeDetails.currencySymbol)}</b></div>
            <div className="flex justify-between border-t border-black pt-2 text-base"><b>Grand Total</b><b>{formatCurrency(invoice.grandTotal, storeDetails.currencySymbol)}</b></div>
          </div>
          <div className="mt-6 border-t border-black pt-4 flex justify-between"><span>E. & O.E</span><b>For AVA SURFACES PVT LIMITED<br/>Authorised Signatory</b></div>
        </div>
      </div>
    </div>
  );
};
