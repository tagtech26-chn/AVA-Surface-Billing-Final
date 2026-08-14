from pathlib import Path

p = Path('src/components/PosBillingView.tsx')
s = p.read_text(encoding='utf-8')

def replace_once(old: str, new: str, label: str):
    global s
    if old not in s:
        raise SystemExit(f'Patch target not found: {label}')
    s = s.replace(old, new, 1)

replace_once(
"  const [gstData, setGstData] = useState<GstLookupResult | null>(null);",
"  const [gstData, setGstData] = useState<GstLookupResult | null>(null);\n  const [gstManualMode, setGstManualMode] = useState(false);",
"GST manual state")

replace_once(
"""      const res = await lookupGstDetails(targetGst);
      setGstData(res);
      if (res.status === 'ACTIVE' && res.isValid) {
        setLedgerCustName(res.tradeName || res.legalName);
        setNewCustName(res.tradeName || res.legalName);
        setNewCustTax(res.gstin);
        setNewCustBillingAddress(res.address || '');
        setNewCustState(res.stateName || '');
        setNewCustStateCode(res.stateCode || '');
      }""",
"""      const res = await lookupGstDetails(targetGst);
      setGstData(res);
      setGstManualMode(false);
      if (res.status === 'ACTIVE' && res.isValid) {
        setLedgerCustName(res.tradeName || res.legalName);
        setNewCustName(res.tradeName || res.legalName);
        setNewCustTax(res.gstin);
        setNewCustBillingAddress(res.address || '');
        setNewCustState(res.stateName || '');
        setNewCustStateCode(res.stateCode || '');
      }""",
"GST verification handler")

replace_once(
"""    if (customerType === 'LEDGER') {
      const verifiedGstin = gstData?.gstin?.trim().toUpperCase();
      if (!gstInput.trim() || verifiedGstin !== gstInput.trim().toUpperCase() || gstData?.status !== 'ACTIVE' || !gstData?.isValid) {
        setToastNotification('B2B/Ledger billing requires successful online GSTIN verification with ACTIVE status.');
        setTimeout(() => setToastNotification(null), 5000);
        return;
      }
    }""",
"""    if (customerType === 'LEDGER') {
      const verifiedGstin = gstData?.gstin?.trim().toUpperCase();
      const verifiedActive = !!gstInput.trim() && verifiedGstin === gstInput.trim().toUpperCase() && gstData?.status === 'ACTIVE' && !!gstData?.isValid;
      const manualB2B = gstManualMode && !!gstInput.trim();
      if (!verifiedActive && !manualB2B) {
        setToastNotification('Verify the GSTIN first. If verification fails, choose Manual B2B Entry and enter the customer details.');
        setTimeout(() => setToastNotification(null), 5000);
        return;
      }
    }""",
"checkout B2B validation")

replace_once(
"""    if (!finalCustomerObj && customerType === 'LEDGER' && gstInput.trim() && gstData?.status === 'ACTIVE') {
      finalCustomerObj = onAddNewCustomer({
        name: gstData.tradeName || gstData.legalName,
        phone: ledgerCustPhone || '',
        customerType: 'LEDGER',
        gstNumber: gstData.gstin,
        gstLegalName: gstData.legalName,
        gstTradeName: gstData.tradeName,
        gstStatus: 'ACTIVE',
        gstState: gstData.stateName,
        taxNumber: gstData.gstin,
        address: gstData.address,
        billingAddress: gstData.address,
        city: '',
        state: gstData.stateName,
        stateCode: gstData.stateCode,
        shippingAddress: gstData.address
      });
    }""",
"""    if (!finalCustomerObj && customerType === 'LEDGER' && gstInput.trim()) {
      const verifiedActive = gstData?.status === 'ACTIVE' && gstData?.isValid && gstData?.gstin?.toUpperCase() === gstInput.trim().toUpperCase();
      if (verifiedActive) {
        finalCustomerObj = onAddNewCustomer({
          name: gstData.tradeName || gstData.legalName,
          phone: ledgerCustPhone || '',
          customerType: 'LEDGER',
          gstNumber: gstData.gstin,
          gstLegalName: gstData.legalName,
          gstTradeName: gstData.tradeName,
          gstStatus: 'ACTIVE',
          gstState: gstData.stateName,
          taxNumber: gstData.gstin,
          address: gstData.address,
          billingAddress: gstData.address,
          city: '',
          state: gstData.stateName,
          stateCode: gstData.stateCode,
          shippingAddress: gstData.address
        });
      } else if (gstManualMode) {
        finalCustomerObj = onAddNewCustomer({
          name: newCustName.trim(),
          phone: newCustPhone.trim(),
          email: newCustEmail.trim() || undefined,
          customerType: 'LEDGER',
          gstNumber: gstInput.trim().toUpperCase(),
          gstLegalName: newCustName.trim(),
          gstTradeName: newCustName.trim(),
          gstStatus: 'UNVERIFIED',
          gstState: newCustState.trim(),
          taxNumber: gstInput.trim().toUpperCase(),
          address: newCustBillingAddress.trim(),
          billingAddress: newCustBillingAddress.trim(),
          city: newCustCity.trim(),
          state: newCustState.trim(),
          stateCode: newCustStateCode.trim(),
          shippingAddress: (shippingSameAsBilling ? newCustBillingAddress : newCustShippingAddress).trim()
        });
      }
    }""",
"manual B2B customer fallback")

replace_once(
"""    if (newCustType === 'LEDGER' && (!gstin || gstData?.gstin !== gstin || gstData?.status !== 'ACTIVE' || !gstData?.isValid)) {
      setToastNotification('Verify the GSTIN online and confirm ACTIVE status before saving a B2B/Ledger customer.');
      setTimeout(() => setToastNotification(null), 5000);
      return;
    }""",
"""    if (newCustType === 'LEDGER') {
      const verifiedActive = !!gstin && gstData?.gstin?.toUpperCase() === gstin && gstData?.status === 'ACTIVE' && !!gstData?.isValid;
      if (!verifiedActive && !gstManualMode) {
        setToastNotification('GSTIN verification failed or is unavailable. Choose Manual B2B Entry to enter the customer details manually.');
        setTimeout(() => setToastNotification(null), 5000);
        return;
      }
    }""",
"customer modal B2B fallback validation")

# Add manual-entry button after the GST status panel.
replace_once(
"""                  {newCustType === 'LEDGER' && gstData && (
                    <div className={`mt-2 p-2 rounded-xl border text-[10px] ${gstData.status === 'ACTIVE' ? 'bg-emerald-950 border-emerald-500/50 text-emerald-200' : 'bg-rose-950 border-rose-500/50 text-rose-200'}`}>
                      <strong>{gstData.status}</strong> — {gstData.message}
                    </div>
                  )}""",
"""                  {newCustType === 'LEDGER' && gstData && (
                    <div className={`mt-2 p-2 rounded-xl border text-[10px] ${gstData.status === 'ACTIVE' ? 'bg-emerald-950 border-emerald-500/50 text-emerald-200' : 'bg-rose-950 border-rose-500/50 text-rose-200'}`}>
                      <strong>{gstData.status}</strong> — {gstData.message}
                      {gstData.status !== 'ACTIVE' && (
                        <button type=\"button\" onClick={() => setGstManualMode(true)} className=\"ml-2 px-2 py-1 rounded-lg bg-amber-600 text-white font-bold\">Manual B2B Entry</button>
                      )}
                    </div>
                  )}
                  {newCustType === 'LEDGER' && gstManualMode && (
                    <div className=\"mt-2 p-2 rounded-xl bg-amber-950/40 border border-amber-500/40 text-[10px] text-amber-200\">
                      GST verification was unavailable. You may enter B2B customer details manually. The customer will be stored as <strong>UNVERIFIED</strong> and should be re-verified later.
                    </div>
                  )}""",
"manual B2B UI")

# Do not make business fields read-only in manual mode.
s = s.replace("readOnly={newCustType === 'LEDGER' && gstData?.status === 'ACTIVE'}", "readOnly={newCustType === 'LEDGER' && gstData?.status === 'ACTIVE' && !gstManualMode}")

p.write_text(s, encoding='utf-8')
print('Manual B2B fallback patch applied.')