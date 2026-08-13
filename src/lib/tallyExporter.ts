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

/**
 * Formats YYYY-MM-DD string into Tally XML YYYYMMDD format
 */
function formatTallyDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  } catch {
    return '20260101';
  }
}

/**
 * Escapes XML special characters
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates Tally ERP XML string for Sales Invoices
 */
export function generateTallySalesXml(
  invoices: Invoice[],
  mapping: TallyLedgerMapping = DEFAULT_TALLY_MAPPING
): string {
  const company = escapeXml(mapping.companyName || 'BizFlow Store');

  const tallyMessages = invoices.map((inv) => {
    const dateFormatted = formatTallyDate(inv.date);
    const partyName = escapeXml(inv.customer?.name || 'Cash Customer');
    const invNumber = escapeXml(inv.invoiceNumber);
    const totalAmount = inv.grandTotal;
    const subtotal = inv.subtotal - inv.promoDiscountAmount - inv.manualDiscountAmount;
    const taxTotal = inv.taxTotal;

    // Party entry (Debit for sales) -> In Tally XML, Debit amounts are negative in ALLLEDGERENTRIES
    const partyLedgerXml = `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${partyName}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>YES</ISDEEMEDPOSITIVE>
              <LEDGERFROMITEM>NO</LEDGERFROMITEM>
              <REMOVEZEROENTRIES>NO</REMOVEZEROENTRIES>
              <AMOUNT>-${totalAmount.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;

    // Sales ledger entry (Credit)
    const salesLedgerXml = `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(mapping.salesLedger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
              <LEDGERFROMITEM>NO</LEDGERFROMITEM>
              <REMOVEZEROENTRIES>NO</REMOVEZEROENTRIES>
              <AMOUNT>${subtotal.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`;

    // Tax ledger entry (Credit)
    const taxLedgerXml = taxTotal > 0 ? `
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${escapeXml(mapping.cgstLedger)}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
              <LEDGERFROMITEM>NO</LEDGERFROMITEM>
              <REMOVEZEROENTRIES>NO</REMOVEZEROENTRIES>
              <AMOUNT>${taxTotal.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>` : '';

    // Inventory Entries XML
    const inventoryXml = inv.items.map((item) => `
            <ALLINVENTORYENTRIES.LIST>
              <STOCKITEMNAME>${escapeXml(item.product.name)}</STOCKITEMNAME>
              <ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
              <RATE>${item.finalUnitPrice.toFixed(2)}/${item.product.unit || 'pcs'}</RATE>
              <AMOUNT>${item.totalPrice.toFixed(2)}</AMOUNT>
              <ACTUALQTY>${item.quantity} ${item.product.unit || 'pcs'}</ACTUALQTY>
              <BILLEDQTY>${item.quantity} ${item.product.unit || 'pcs'}</BILLEDQTY>
            </ALLINVENTORYENTRIES.LIST>`).join('');

    return `
          <TALLYMESSAGE xmlns:UDF="TallyUDF">
            <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Accounting Voucher View">
              <DATE>${dateFormatted}</DATE>
              <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
              <VOUCHERNUMBER>${invNumber}</VOUCHERNUMBER>
              <PARTYLEDGERNAME>${partyName}</PARTYLEDGERNAME>
              <NARRATION>POS Invoice ${invNumber} generated via BizFlow. Payment method: ${inv.paymentMethod}</NARRATION>
              <FBTPAYMENTTYPE>Default</FBTPAYMENTTYPE>
              <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
              ${partyLedgerXml}
              ${salesLedgerXml}
              ${taxLedgerXml}
              ${inventoryXml}
            </VOUCHER>
          </TALLYMESSAGE>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        ${tallyMessages}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

/**
 * Generates Tally ERP XML string for Expense / Purchase Vouchers
 */
export function generateTallyExpenseXml(
  expenses: Expense[],
  mapping: TallyLedgerMapping = DEFAULT_TALLY_MAPPING
): string {
  const company = escapeXml(mapping.companyName || 'BizFlow Store');

  const messages = expenses.map((exp) => {
    const dateFormatted = formatTallyDate(exp.date);
    const expTitle = escapeXml(exp.title);
    const paidTo = escapeXml(exp.paidTo || 'Cash Expense Vendor');
    const amount = exp.amount;
    const recNo = escapeXml(exp.receiptNumber || `EXP-${exp.id}`);

    return `
          <TALLYMESSAGE xmlns:UDF="TallyUDF">
            <VOUCHER VCHTYPE="Payment" ACTION="Create">
              <DATE>${dateFormatted}</DATE>
              <VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>
              <VOUCHERNUMBER>${recNo}</VOUCHERNUMBER>
              <PARTYLEDGERNAME>${paidTo}</PARTYLEDGERNAME>
              <NARRATION>Expense Payment: ${expTitle}. Category: ${exp.category}. Recorded by: ${escapeXml(exp.recordedBy)}</NARRATION>
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>${expTitle}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>YES</ISDEEMEDPOSITIVE>
                <AMOUNT>-${amount.toFixed(2)}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>
              <ALLLEDGERENTRIES.LIST>
                <LEDGERNAME>${exp.paymentMethod === 'BANK_TRANSFER' ? escapeXml(mapping.bankLedger) : escapeXml(mapping.cashLedger)}</LEDGERNAME>
                <ISDEEMEDPOSITIVE>NO</ISDEEMEDPOSITIVE>
                <AMOUNT>${amount.toFixed(2)}</AMOUNT>
              </ALLLEDGERENTRIES.LIST>
            </VOUCHER>
          </TALLYMESSAGE>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${company}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        ${messages}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

/**
 * Generates Tally Prime JSON export payload
 */
export function generateTallyJsonExport(
  invoices: Invoice[],
  expenses: Expense[],
  products: Product[],
  customers: Customer[],
  mapping: TallyLedgerMapping = DEFAULT_TALLY_MAPPING
): object {
  return {
    tallyMetadata: {
      generatedAt: new Date().toISOString(),
      sourceSystem: 'BizFlow Suite',
      companyName: mapping.companyName,
      compatibleWith: 'TallyPrime 3.0+ / Tally ERP 9 API Connector',
      totalSalesVouchers: invoices.length,
      totalExpenseVouchers: expenses.length,
      totalStockMasters: products.length
    },
    ledgerMappings: mapping,
    salesVouchers: invoices.map((inv) => ({
      voucherType: 'Sales',
      voucherNumber: inv.invoiceNumber,
      date: inv.date.split('T')[0],
      partyLedgerName: inv.customer?.name || 'Cash Sales Customer',
      customerTaxId: inv.customer?.taxNumber || '',
      grossTotal: inv.grandTotal,
      subtotal: inv.subtotal,
      taxTotal: inv.taxTotal,
      discountTotal: inv.promoDiscountAmount + inv.manualDiscountAmount + inv.itemDiscountsTotal,
      paymentStatus: inv.status,
      paymentMethod: inv.paymentMethod,
      narration: `BizFlow Sales Invoice ${inv.invoiceNumber} rendered by ${inv.cashierName}`,
      ewayBillNo: inv.ewayBillNo || null,
      irnNo: inv.irnNo || null,
      ledgerEntries: [
        {
          ledgerName: inv.customer?.name || 'Cash Sales Customer',
          ledgerGroup: mapping.debtorsGroup,
          amount: inv.grandTotal,
          type: 'DEBIT'
        },
        {
          ledgerName: mapping.salesLedger,
          amount: inv.subtotal - (inv.promoDiscountAmount + inv.manualDiscountAmount),
          type: 'CREDIT'
        },
        {
          ledgerName: mapping.cgstLedger,
          amount: inv.taxTotal,
          type: 'CREDIT'
        }
      ],
      inventoryEntries: inv.items.map((item) => ({
        stockItemName: item.product.name,
        sku: item.product.sku,
        hsnCode: '8523', // default electronics HSN
        quantity: item.quantity,
        rate: item.finalUnitPrice,
        unit: item.product.unit || 'pcs',
        amount: item.totalPrice,
        taxRate: item.product.taxRate
      }))
    })),
    expenseVouchers: expenses.map((exp) => ({
      voucherType: 'Payment',
      voucherNumber: exp.receiptNumber || `EXP-${exp.id}`,
      date: exp.date,
      paidTo: exp.paidTo,
      category: exp.category,
      amount: exp.amount,
      paymentMethod: exp.paymentMethod,
      narration: exp.title,
      ledgerEntries: [
        {
          ledgerName: exp.title,
          amount: exp.amount,
          type: 'DEBIT'
        },
        {
          ledgerName: exp.paymentMethod === 'BANK_TRANSFER' ? mapping.bankLedger : mapping.cashLedger,
          amount: exp.amount,
          type: 'CREDIT'
        }
      ]
    })),
    stockMasters: products.map((prod) => ({
      itemName: prod.name,
      sku: prod.sku,
      barcode: prod.barcode,
      category: prod.category,
      baseUnit: prod.unit,
      costPrice: prod.costPrice,
      sellingPrice: prod.sellingPrice,
      currentStock: prod.stock,
      taxRate: prod.taxRate
    })),
    debtorMasters: customers.map((cust) => ({
      customerName: cust.name,
      parentGroup: mapping.debtorsGroup,
      phone: cust.phone,
      email: cust.email,
      address: cust.address,
      gstin: cust.taxNumber || '',
      outstandingBalance: cust.outstandingBalance
    }))
  };
}

/**
 * Triggers browser file download for text/XML or JSON files
 */
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
