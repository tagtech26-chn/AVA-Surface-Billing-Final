import React from 'react';
import { Invoice, BusinessStoreDetails } from '../types';
import { formatCurrency, formatDateTime } from '../lib/utils';
import { Printer, X } from 'lucide-react';

interface PrintableReceiptModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  storeDetails: BusinessStoreDetails;
}

const money = (value: number | undefined, symbol: string) =>
  formatCurrency(value ?? 0, symbol);

const amountInWords = (value: number): string => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (n: number) => n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`;
  const underThousand = (n: number) => {
    const parts: string[] = [];
    if (Math.floor(n / 100)) parts.push(`${ones[Math.floor(n / 100)]} Hundred`);
    const remainder = n % 100;
    if (remainder) parts.push(two(remainder));
    return parts.join(' ');
  };
  const whole = Math.floor(Math.abs(value));
  const paise = Math.round((Math.abs(value) - whole) * 100);
  if (!whole && !paise) return 'Zero Rupees Only';
  let n = whole;
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(`${underThousand(crore)} Crore`);
  if (lakh) parts.push(`${underThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${underThousand(thousand)} Thousand`);
  if (n) parts.push(underThousand(n));
  return `${value < 0 ? 'Minus ' : ''}${parts.join(' ')} Rupees${paise ? ` and ${two(paise)} Paise` : ''} Only`;
};

export const PrintableReceiptModal: React.FC<PrintableReceiptModalProps> = ({ invoice, onClose, storeDetails }) => {
  if (!invoice) return null;

  const customer = invoice.customer;
  const itemsPerPage = 12;
  const pages: typeof invoice.items[] = [];
  for (let i = 0; i < invoice.items.length; i += itemsPerPage) pages.push(invoice.items.slice(i, i + itemsPerPage));
  if (!pages.length) pages.push([]);

  const taxRows = new Map<string, { taxable: number; cgst: number; sgst: number; igst: number }>();
  invoice.items.forEach(item => {
    const rate = Number(item.product.taxRate || 0);
    const key = `${item.product.hsnCode || '-'}|${rate}`;
    const taxable = Number(item.totalPrice || 0);
    const cgst = Number(invoice.igstAmount || 0) > 0 ? 0 : taxable * rate / 200;
    const sgst = Number(invoice.igstAmount || 0) > 0 ? 0 : taxable * rate / 200;
    const row = taxRows.get(key) || { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    row.taxable += taxable;
    row.cgst += cgst;
    row.sgst += sgst;
    taxRows.set(key, row);
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4 overflow-y-auto print:static print:bg-white print:p-0">
      <style>{`
        @page { size: A4; margin: 8mm; }
        @media print {
          body { background: white !important; }
          body > * { visibility: hidden; }
          .ava-print-root, .ava-print-root * { visibility: visible; }
          .ava-print-root { position: absolute; inset: 0; width: 100%; background: white; }
          .ava-invoice-page { width: 100%; min-height: 281mm; page-break-after: always; box-shadow: none !important; }
          .ava-invoice-page:last-child { page-break-after: auto; }
          .print-hide { display: none !important; }
        }
      `}</style>

      <div className="ava-print-root w-full max-w-5xl">
        <div className="p-3 bg-slate-900 text-white flex items-center justify-between print-hide rounded-t-lg">
          <span className="font-bold text-sm">AVA Surfaces — Tax Invoice Preview</span>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="px-4 py-2 bg-white text-slate-900 rounded font-bold text-sm flex items-center gap-2"><Printer className="w-4 h-4" /> Print / PDF</button>
            <button onClick={onClose} className="p-2 bg-slate-800 rounded"><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="bg-white text-black shadow-2xl">
          {pages.map((pageItems, pageIndex) => {
            const isLast = pageIndex === pages.length - 1;
            return (
              <section key={pageIndex} className="ava-invoice-page p-5 text-[10px] leading-tight">
                <header className="border border-black">
                  <div className="grid grid-cols-[115px_1fr_170px] min-h-[90px]">
                    <div className="border-r border-black flex items-center justify-center p-2">
                      <div className="text-center">
                        <div className="text-[42px] leading-none font-black tracking-[-6px] text-[#b51f2a]">AVA</div>
                        <div className="text-[12px] tracking-[5px] font-bold">SURFACES</div>
                      </div>
                    </div>
                    <div className="p-3 text-center">
                      <div className="text-[18px] font-black uppercase">AVA SURFACES PVT LIMITED</div>
                      <div className="font-semibold mt-1">{storeDetails.address}</div>
                      <div className="mt-1">Phone: {storeDetails.phone} {storeDetails.email ? ` | Email: ${storeDetails.email}` : ''}</div>
                      <div className="font-bold mt-1">GSTIN: {storeDetails.taxRegistrationNumber}{storeDetails.pan ? ` | PAN: ${storeDetails.pan}` : ''}</div>
                      {storeDetails.cin && <div>CIN: {storeDetails.cin}</div>}
                    </div>
                    <div className="border-l border-black p-2">
                      <div className="font-black text-center border-b border-black pb-1">TAX INVOICE</div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2">
                        <b>Invoice No.</b><span>{invoice.invoiceNumber}</span>
                        <b>Date</b><span>{formatDateTime(invoice.date)}</span>
                        {invoice.dueDate && <><b>Due Date</b><span>{formatDateTime(invoice.dueDate)}</span></>}
                        {invoice.ewayBillNo && <><b>E-Way Bill</b><span>{invoice.ewayBillNo}</span></>}
                        {invoice.irnNo && <><b>IRN</b><span className="break-all">{invoice.irnNo}</span></>}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 border-t border-black">
                    <div className="p-2 border-r border-black min-h-[82px]">
                      <div className="font-black uppercase border-b border-black pb-1 mb-1">Buyer Details</div>
                      <div className="font-bold">{customer?.name || 'Customer Required'}</div>
                      <div>{customer?.address || 'Address required'}</div>
                      {customer?.phone && <div>Mobile: {customer.phone}</div>}
                      {customer?.email && <div>Email: {customer.email}</div>}
                      {customer?.gstNumber && <div className="font-bold">GSTIN: {customer.gstNumber}</div>}
                      {customer?.taxNumber && <div>PAN: {customer.taxNumber}</div>}
                    </div>
                    <div className="p-2 min-h-[82px]">
                      <div className="font-black uppercase border-b border-black pb-1 mb-1">Delivery Details</div>
                      <div className="font-bold">{customer?.name || 'Same as Buyer'}</div>
                      <div>{customer?.address || 'Same as Buyer'}</div>
                      {invoice.deliveryNotes && <div>{invoice.deliveryNotes}</div>}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 border-t border-black">
                    <div className="p-2 border-r border-black"><b>Salesperson</b><br/>{invoice.salespersonName || invoice.cashierName || '-'}</div>
                    <div className="p-2 border-r border-black"><b>Mobile</b><br/>{invoice.salespersonMobile || '-'}</div>
                    <div className="p-2 border-r border-black"><b>Vehicle No.</b><br/>{invoice.vehicleNumber || '-'}</div>
                    <div className="p-2"><b>PO / Reference</b><br/>{invoice.notes || '-'}</div>
                  </div>
                </header>

                <table className="w-full mt-2 border-collapse border border-black table-fixed">
                  <thead>
                    <tr className="font-black text-center">
                      <th className="border border-black p-1 w-[28px]">S.No</th>
                      <th className="border border-black p-1 w-[31%]">Description of Goods</th>
                      <th className="border border-black p-1 w-[70px]">HSN/SAC</th>
                      <th className="border border-black p-1 w-[45px]">GST %</th>
                      <th className="border border-black p-1 w-[55px]">Qty</th>
                      <th className="border border-black p-1 w-[45px]">Unit</th>
                      <th className="border border-black p-1 w-[75px]">Rate</th>
                      <th className="border border-black p-1 w-[50px]">Disc %</th>
                      <th className="border border-black p-1">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((item, index) => (
                      <tr key={`${pageIndex}-${index}`} className="align-top">
                        <td className="border border-black p-1 text-center">{pageIndex * itemsPerPage + index + 1}</td>
                        <td className="border border-black p-1 font-semibold">{item.product.name}</td>
                        <td className="border border-black p-1 text-center">{item.product.hsnCode || '-'}</td>
                        <td className="border border-black p-1 text-center">{item.product.taxRate}%</td>
                        <td className="border border-black p-1 text-right">{item.quantity}</td>
                        <td className="border border-black p-1 text-center">{item.selectedUnit || item.product.unit || '-'}</td>
                        <td className="border border-black p-1 text-right">{money(item.finalUnitPrice || item.product.sellingPrice, storeDetails.currencySymbol)}</td>
                        <td className="border border-black p-1 text-right">{item.discountPercent ?? 0}%</td>
                        <td className="border border-black p-1 text-right">{money(item.totalPrice, storeDetails.currencySymbol)}</td>
                      </tr>
                    ))}
                    {Array.from({ length: Math.max(0, itemsPerPage - pageItems.length) }).map((_, i) => (
                      <tr key={`blank-${pageIndex}-${i}`} className="h-[21px]"><td colSpan={9} className="border-x border-black p-1">&nbsp;</td></tr>
                    ))}
                  </tbody>
                </table>

                {!isLast && <div className="font-bold italic mt-2 text-right">Continued........</div>}

                {isLast && (
                  <>
                    <div className="grid grid-cols-[1fr_260px] gap-2 mt-2">
                      <div className="border border-black p-2">
                        <div className="font-black uppercase mb-1">Discount / Approval Details</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          <span>Line Item Discounts</span><b>{money(invoice.itemDiscountsTotal, storeDetails.currencySymbol)}</b>
                          <span>Promo {invoice.promoCodeApplied ? `(${invoice.promoCodeApplied})` : ''}</span><b>{invoice.promoDiscountPercent ? `${invoice.promoDiscountPercent}% / ` : ''}{money(invoice.promoDiscountAmount, storeDetails.currencySymbol)}</b>
                          <span>Branch Manager Discount</span><b>{invoice.branchManagerDiscountPercent ? `${invoice.branchManagerDiscountPercent}% / ` : ''}{money(invoice.branchManagerDiscountAmount, storeDetails.currencySymbol)}</b>
                        </div>
                        {invoice.branchManagerRemarks && <div className="mt-2 border-t border-black pt-1"><b>Manager Remarks:</b> {invoice.branchManagerRemarks}</div>}
                      </div>
                      <div className="border border-black p-2 space-y-1">
                        <div className="flex justify-between"><span>Sub Total</span><b>{money(invoice.subtotal, storeDetails.currencySymbol)}</b></div>
                        <div className="flex justify-between"><span>Discounts</span><b>-{money(invoice.itemDiscountsTotal + invoice.promoDiscountAmount + (invoice.branchManagerDiscountAmount || 0), storeDetails.currencySymbol)}</b></div>
                        <div className="flex justify-between"><span>Taxable Value</span><b>{money(invoice.subtotal - invoice.itemDiscountsTotal - invoice.promoDiscountAmount - (invoice.branchManagerDiscountAmount || 0), storeDetails.currencySymbol)}</b></div>
                        {invoice.cgstAmount !== undefined && <div className="flex justify-between"><span>CGST</span><b>{money(invoice.cgstAmount, storeDetails.currencySymbol)}</b></div>}
                        {invoice.sgstAmount !== undefined && <div className="flex justify-between"><span>SGST</span><b>{money(invoice.sgstAmount, storeDetails.currencySymbol)}</b></div>}
                        {invoice.igstAmount !== undefined && invoice.igstAmount > 0 && <div className="flex justify-between"><span>IGST</span><b>{money(invoice.igstAmount, storeDetails.currencySymbol)}</b></div>}
                        <div className="flex justify-between"><span>Round Off</span><b>{money(invoice.roundOffAmount, storeDetails.currencySymbol)}</b></div>
                        <div className="flex justify-between border-t border-black pt-1 text-sm"><b>Grand Total</b><b>{money(invoice.grandTotal, storeDetails.currencySymbol)}</b></div>
                      </div>
                    </div>

                    <div className="border border-black mt-2 p-2">
                      <div className="font-black uppercase mb-1">HSN/SAC Tax Summary</div>
                      <table className="w-full border-collapse border border-black text-[9px]">
                        <thead><tr><th className="border border-black p-1">HSN/SAC</th><th className="border border-black p-1">GST %</th><th className="border border-black p-1">Taxable Value</th><th className="border border-black p-1">CGST</th><th className="border border-black p-1">SGST</th><th className="border border-black p-1">IGST</th><th className="border border-black p-1">Total Tax</th></tr></thead>
                        <tbody>
                          {[...taxRows.entries()].map(([key, row]) => {
                            const [hsn, rate] = key.split('|');
                            const totalTax = row.cgst + row.sgst + row.igst;
                            return <tr key={key}><td className="border border-black p-1 text-center">{hsn}</td><td className="border border-black p-1 text-center">{rate}%</td><td className="border border-black p-1 text-right">{money(row.taxable, storeDetails.currencySymbol)}</td><td className="border border-black p-1 text-right">{money(row.cgst, storeDetails.currencySymbol)}</td><td className="border border-black p-1 text-right">{money(row.sgst, storeDetails.currencySymbol)}</td><td className="border border-black p-1 text-right">{money(row.igst, storeDetails.currencySymbol)}</td><td className="border border-black p-1 text-right">{money(totalTax, storeDetails.currencySymbol)}</td></tr>;
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="border border-black p-2 min-h-[65px]"><b>Total Amount in Words:</b><br/>{amountInWords(invoice.grandTotal)}</div>
                      <div className="border border-black p-2 min-h-[65px]"><b>Tax Amount in Words:</b><br/>{amountInWords(invoice.taxTotal)}</div>
                    </div>

                    <div className="border border-black mt-2 p-2 min-h-[65px]">
                      <b>Declaration:</b> Goods once sold are subject to the terms and conditions of sale. E. & O. E.
                      <div className="mt-2">Jurisdiction: Local courts having jurisdiction over the registered place of business.</div>
                    </div>

                    <div className="flex justify-between items-end mt-8 px-2">
                      <div className="font-semibold">Customer Signature</div>
                      <div className="text-right font-bold">For AVA SURFACES PVT LIMITED<br/><br/>Authorised Signatory</div>
                    </div>
                  </>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};
