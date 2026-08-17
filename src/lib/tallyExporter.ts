import { Invoice, Expense, Product, Customer, TallyLedgerMapping } from '../types';

export const DEFAULT_TALLY_MAPPING: TallyLedgerMapping = {
  salesLedger: 'Sales Accounts',
  cashLedger: 'Cash-in-hand',
  bankLedger: 'HDFC Bank',
  cgstLedger: 'Output CGST',
  sgstLedger: 'Output SGST',
  igstLedger: 'Output IGST',
  debtorsGroup: 'Sundry Debtors',
  companyName: 'BizFlow Store'
};

interface TaxBreakdown { cgst: number; sgst: number; igst: number; }

function formatTallyDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid invoice date: ${dateStr}`);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function roundMoney(value: number): number { return Math.round((value + Number.EPSILON) * 100) / 100; }

function getTaxBreakdown(invoice: Invoice): TaxBreakdown {
  const taxTotal = roundMoney(invoice.taxTotal || 0);
  if (taxTotal === 0) return { cgst: 0, sgst: 0, igst: 0 };

  const cgst = roundMoney(invoice.cgstAmount || 0);
  const sgst = roundMoney(invoice.sgstAmount || 0);
  const igst = roundMoney(invoice.igstAmount || 0);
  const breakdownTotal = roundMoney(cgst + sgst + igst);

  if (breakdownTotal === taxTotal) return { cgst, sgst, igst };

  // Legacy local invoices may have taxTotal but no persisted split. In the absence
  // of an explicit IGST amount, preserve the tax total as an intra-state split.
  // New backend-created invoices persist the exact CGST/SGST/IGST values.
  if (igst === 0) {
    const fallbackCgst = roundMoney(taxTotal / 2);
    return { cgst: fallbackCgst, sgst: roundMoney(taxTotal - fallbackCgst), igst: 0 };
  }

  if (breakdownTotal === 0) return { cgst: 0, sgst: 0, igst: taxTotal };

  throw new Error(`Invoice ${invoice.invoiceNumber}: tax breakdown (${breakdownTotal.toFixed(2)}) does not equal taxTotal (${taxTotal.toFixed(2)}).`);
}

function buildTaxLedgerXml(tax: TaxBreakdown, mapping: TallyLedgerMapping): string {
  const entries: string[] = [];
  const addEntry = (ledgerName: string, amount: number) => {
    if (amount <= 0) return;
    entries.push(`
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(ledgerName)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
              <LEDGERFROMITEM>NO</LEDGERFROMITEM>
              <REMOVEZEROENTRIES>NO</REMOVEZEROENTRIES>
              <AMOUNT>${amount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`);
  };
  addEntry(mapping.cgstLedger, tax.cgst);
  addEntry(mapping.sgstLedger, tax.sgst);
  addEntry(mapping.igstLedger, tax.igst);
  return entries.join('');
}

export function generateTallySalesXml(invoices: Invoice[], mapping: TallyLedgerMapping = DEFAULT_TALLY_MAPPING): string {
  const company = escapeXml(mapping.companyName || 'BizFlow Store');
  const tallyMessages = invoices.map((inv) => {
    const dateFormatted = formatTallyDate(inv.date);
    const partyName = escapeXml(inv.customer?.name || 'Cash Customer');
    const invNumber = escapeXml(inv.invoiceNumber);
    const narration = escapeXml(`POS Invoice ${inv.invoiceNumber} generated via BizFlow. Payment method: ${inv.paymentMethod}`);
    const totalAmount = roundMoney(inv.grandTotal);
    const subtotal = roundMoney(inv.subtotal - inv.promoDiscountAmount - inv.manualDiscountAmount);
    const tax = getTaxBreakdown(inv);
    const partyLedgerXml = `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${partyName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>YES</ISDEEMEDPOSITIVE>
              <LEDGERFROMITEM>NO</LEDGERFROMITEM>
              <REMOVEZEROENTRIES>NO</REMOVEZEROENTRIES>
              <AMOUNT>-${totalAmount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
    const salesLedgerXml = `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(mapping.salesLedger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
              <LEDGERFROMITEM>NO</LEDGERFROMITEM>
              <REMOVEZEROENTRIES>NO</REMOVEZEROENTRIES>
              <AMOUNT>${subtotal.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;
    const inventoryXml = inv.items.map((item) => `
            <ALLINVENTORYENTRIES.LIST>
              <STOCKITEMNAME>${escapeXml(item.product.name)}</STOCKITEMNAME>
              <ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
              <RATE>${item.finalUnitPrice.toFixed(2)}/${escapeXml(item.product.unit || 'pcs')}</RATE>
              <AMOUNT>${item.totalPrice.toFixed(2)}</AMOUNT>
              <ACTUALQTY>${item.quantity} ${escapeXml(item.product.unit || 'pcs')}</ACTUALQTY>
              <BILLEDQTY>${item.quantity} ${escapeXml(item.product.unit || 'pcs')}</BILLEDQTY>
            </ALLINVENTORYENTRIES.LIST>`).join('');
    return `
          <TALLYMESSAGE xmlns:UDF="TallyUDF">
            <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Accounting Voucher View">
              <DATE>${dateFormatted}</DATE>
              <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
              <VOUCHERNUMBER>${invNumber}</VOUCHERNUMBER>
              <PARTYLEDGERNAME>${partyName}</PARTYLEDGERNAME>
              <NARRATION>${narration}</NARRATION>
              <FBTPAYMENTTYPE>Default</FBTPAYMENTTYPE>
              <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
              ${partyLedgerXml}
              ${salesLedgerXml}
              ${buildTaxLedgerXml(tax, mapping)}
              ${inventoryXml}
            </VOUCHER>
          </TALLYMESSAGE>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC><REQUESTDATA>${tallyMessages}</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
}

export function generateTallyExpenseXml(expenses: Expense[], mapping: TallyLedgerMapping = DEFAULT_TALLY_MAPPING): string {
  const company = escapeXml(mapping.companyName || 'BizFlow Store');
  const messages = expenses.map((exp) => {
    const dateFormatted = formatTallyDate(exp.date);
    const expTitle = escapeXml(exp.title);
    const paidTo = escapeXml(exp.paidTo || 'Cash Expense Vendor');
    const amount = roundMoney(exp.amount);
    const recNo = escapeXml(exp.receiptNumber || `EXP-${exp.id}`);
    const narration = escapeXml(`Expense Payment: ${exp.title}. Category: ${exp.category}. Recorded by: ${exp.recordedBy}`);
    return `
          <TALLYMESSAGE xmlns:UDF="TallyUDF">
            <VOUCHER VCHTYPE="Payment" ACTION="Create"><DATE>${dateFormatted}</DATE><VOUCHERTYPENAME>Payment</VOUCHERTYPENAME><VOUCHERNUMBER>${recNo}</VOUCHERNUMBER><PARTYLEDGERNAME>${paidTo}</PARTYLEDGERNAME><NARRATION>${narration}</NARRATION>
              <ALLLEDGERENTRIES.LIST><LEDGERNAME>${expTitle}</LEDGERNAME><ISDEEMEDPOSITIVE>YES</ISDEEMEDPOSITIVE><AMOUNT>-${amount.toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST>
              <ALLLEDGERENTRIES.LIST><LEDGERNAME>${exp.paymentMethod === 'BANK_TRANSFER' ? escapeXml(mapping.bankLedger) : escapeXml(mapping.cashLedger)}</LEDGERNAME><ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE><AMOUNT>${amount.toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST>
            </VOUCHER>
          </TALLYMESSAGE>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC><REQUESTDATA>${messages}</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
}

export function generateTallyJsonExport(invoices: Invoice[], expenses: Expense[], products: Product[], customers: Customer[], mapping: TallyLedgerMapping = DEFAULT_TALLY_MAPPING): object {
  return {
    tallyMetadata: { generatedAt: new Date().toISOString(), sourceSystem: 'BizFlow Suite', companyName: mapping.companyName, compatibleWith: 'TallyPrime 3.0+ / Tally ERP 9 API Connector', totalSalesVouchers: invoices.length, totalExpenseVouchers: expenses.length, totalStockMasters: products.length },
    ledgerMappings: mapping,
    salesVouchers: invoices.map((inv) => {
      const tax = getTaxBreakdown(inv);
      return {
        voucherType: 'Sales', voucherNumber: inv.invoiceNumber, date: inv.date.split('T')[0], partyLedgerName: inv.customer?.name || 'Cash Sales Customer', customerTaxId: inv.customer?.taxNumber || '', grossTotal: inv.grandTotal, subtotal: inv.subtotal, taxTotal: inv.taxTotal, taxBreakdown: tax, discountTotal: inv.promoDiscountAmount + inv.manualDiscountAmount + inv.itemDiscountsTotal, paymentStatus: inv.status, paymentMethod: inv.paymentMethod, narration: `BizFlow Sales Invoice ${inv.invoiceNumber} rendered by ${inv.cashierName}`, ewayBillNo: inv.ewayBillNo || null, irnNo: inv.irnNo || null,
        ledgerEntries: [
          { ledgerName: inv.customer?.name || 'Cash Sales Customer', ledgerGroup: mapping.debtorsGroup, amount: inv.grandTotal, type: 'DEBIT' },
          { ledgerName: mapping.salesLedger, amount: inv.subtotal - (inv.promoDiscountAmount + inv.manualDiscountAmount), type: 'CREDIT' },
          ...(tax.cgst > 0 ? [{ ledgerName: mapping.cgstLedger, amount: tax.cgst, type: 'CREDIT' }] : []),
          ...(tax.sgst > 0 ? [{ ledgerName: mapping.sgstLedger, amount: tax.sgst, type: 'CREDIT' }] : []),
          ...(tax.igst > 0 ? [{ ledgerName: mapping.igstLedger, amount: tax.igst, type: 'CREDIT' }] : [])
        ],
        inventoryEntries: inv.items.map((item) => ({ stockItemName: item.product.name, sku: item.product.sku, hsnCode: item.product.hsnCode || '', quantity: item.quantity, rate: item.finalUnitPrice, unit: item.product.unit || 'pcs', amount: item.totalPrice, taxRate: item.product.taxRate }))
      };
    }),
    expenseVouchers: expenses.map((exp) => ({ voucherType: 'Payment', voucherNumber: exp.receiptNumber || `EXP-${exp.id}`, date: exp.date, paidTo: exp.paidTo, category: exp.category, amount: exp.amount, paymentMethod: exp.paymentMethod, narration: exp.title, ledgerEntries: [{ ledgerName: exp.title, amount: exp.amount, type: 'DEBIT' }, { ledgerName: exp.paymentMethod === 'BANK_TRANSFER' ? mapping.bankLedger : mapping.cashLedger, amount: exp.amount, type: 'CREDIT' }] })),
    stockMasters: products.map((prod) => ({ itemName: prod.name, sku: prod.sku, barcode: prod.barcode, category: prod.category, baseUnit: prod.unit, hsnCode: prod.hsnCode || '', costPrice: prod.costPrice, sellingPrice: prod.sellingPrice, currentStock: prod.stock, taxRate: prod.taxRate })),
    debtorMasters: customers.map((cust) => ({ customerName: cust.name, parentGroup: mapping.debtorsGroup, phone: cust.phone, email: cust.email, address: cust.address, gstin: cust.taxNumber || '', outstandingBalance: cust.outstandingBalance }))
  };
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
