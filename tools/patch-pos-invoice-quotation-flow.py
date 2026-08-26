from pathlib import Path

APP = Path('src/App.tsx')
MODERN = Path('src/components/ModernPosBillingView.tsx')

app = APP.read_text(encoding='utf-8')
old = "const persisted = await invoiceResponse.json() as { id: string; invoiceNumber: string; grandTotal: number };\n      const invoiceWithDelivery: Invoice = { ...newInvoice, id: persisted.id || newInvoice.id, invoiceNumber: persisted.invoiceNumber, customer, status: 'UNPAID', amountPaid: 0, paymentsHistory: [], deliveryStatus: 'PENDING_DISPATCH' };"
new = "const persisted = await invoiceResponse.json() as { id: string; invoiceNumber?: string | null; quotationNumber?: string | null; grandTotal: number };\n      const documentNumber = persisted.invoiceNumber?.trim() || persisted.quotationNumber?.trim() || newInvoice.invoiceNumber;\n      const invoiceWithDelivery: Invoice = { ...newInvoice, id: persisted.id || newInvoice.id, invoiceNumber: documentNumber, quotationNumber: persisted.quotationNumber?.trim() || newInvoice.quotationNumber, customer, status: 'UNPAID', amountPaid: 0, paymentsHistory: [], deliveryStatus: 'PENDING_DISPATCH' };"
if old not in app:
    raise SystemExit('PATCH_MISSING: App invoice persistence mapping')
app = app.replace(old, new, 1)
old = "logAudit('INVOICE', 'MEDIUM', 'POS Bill Created', `Issued POS Invoice #${invoiceWithDelivery.invoiceNumber} for ${invoiceWithDelivery.customer?.name} (Total: ${storeDetails.currencySymbol}${invoiceWithDelivery.grandTotal.toFixed(2)}). Payment method ${newInvoice.paymentMethod} remains pending Accounts confirmation.`, invoiceWithDelivery.invoiceNumber, invoiceWithDelivery.id, 'Draft Bill', `PAYMENT_PENDING / ${newInvoice.paymentMethod}`);"
new = "const documentLabel = persisted.invoiceNumber?.trim() ? 'Invoice' : 'Quotation';\n      logAudit('INVOICE', 'MEDIUM', 'POS Bill Created', `Issued POS ${documentLabel} #${documentNumber} for ${invoiceWithDelivery.customer?.name} (Total: ${storeDetails.currencySymbol}${invoiceWithDelivery.grandTotal.toFixed(2)}). Payment method ${newInvoice.paymentMethod} remains pending Accounts confirmation.`, documentNumber, invoiceWithDelivery.id, 'Draft Bill', `PAYMENT_PENDING / ${newInvoice.paymentMethod}`);"
if old not in app:
    raise SystemExit('PATCH_MISSING: App audit document label')
app = app.replace(old, new, 1)
APP.write_text(app, encoding='utf-8')

modern = MODERN.read_text(encoding='utf-8')
old = "if(!persisted){setMessage('Bill was not saved. Please correct the highlighted/required information and try again. Your entered data has been kept.');return}clearBill();setMessage(`Invoice ${persisted.invoiceNumber||invoice.invoiceNumber} created successfully.`)"
new = "if(!persisted){setMessage('Bill was not saved. Please correct the highlighted/required information and try again. Your entered data has been kept.');return}clearBill();const documentNumber=persisted.invoiceNumber||persisted.quotationNumber||invoice.quotationNumber||invoice.invoiceNumber;setMessage(`${persisted.invoiceNumber?'Invoice':'Quotation'} ${documentNumber} created successfully. It is currently awaiting Accounts payment confirmation.`)"
if old not in modern:
    raise SystemExit('PATCH_MISSING: Modern POS success message')
modern = modern.replace(old, new, 1)
MODERN.write_text(modern, encoding='utf-8')

print('POS invoice/quotation document-number patch applied successfully.')
