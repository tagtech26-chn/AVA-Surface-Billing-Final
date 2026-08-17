from pathlib import Path

p = Path('src/components/PosBillingView.tsx')
s = p.read_text(encoding='utf-8')


def replace_once(old: str, new: str, label: str):
    global s
    if old not in s:
        raise SystemExit(f'Patch target not found: {label}')
    s = s.replace(old, new, 1)


# The POS component has evolved since the original one-time patch was authored.
# Patch the current GST state/handler instead of relying on the old handler body.
replace_once(
    "  const [gstData, setGstData] = useState<GstLookupResult | null>(null);",
    "  const [gstData, setGstData] = useState<GstLookupResult | null>(null);\n  const [gstManualMode, setGstManualMode] = useState(false);",
    "GST manual state",
)

replace_once(
    """      const res = await lookupGstDetails(targetGst);\n      setGstData(res);\n      if (res.isValid && res.status === 'ACTIVE') {""",
    """      const res = await lookupGstDetails(targetGst);\n      setGstData(res);\n      setGstManualMode(false);\n      if (res.isValid && res.status === 'ACTIVE') {""",
    "GST verification handler",
)

# The current UI already exposes the manual B2B button. Make that button explicitly
# enter manual mode so checkout/customer validation can distinguish it from verified GST.
replace_once(
    """                        onClick={() => {\n                          setNewCustType('LEDGER');""",
    """                        onClick={() => {\n                          setGstManualMode(true);\n                          setNewCustType('LEDGER');""",
    "manual B2B button state",
)

# Require ACTIVE online verification for normal B2B checkout, while allowing the
# explicit manual fallback. This is inserted into the current checkout flow.
replace_once(
    """    if (!selectedSalesperson) {\n      setToastNotification('Select a salesperson before saving the bill.');\n      setTimeout(() => setToastNotification(null), 4000);\n      return;\n    }\n\n    let finalInvoiceNumber = '';""",
    """    if (!selectedSalesperson) {\n      setToastNotification('Select a salesperson before saving the bill.');\n      setTimeout(() => setToastNotification(null), 4000);\n      return;\n    }\n\n    if (customerType === 'LEDGER') {\n      const inputGstin = gstInput.trim().toUpperCase();\n      const customerGstin = selectedCustomer?.gstNumber?.trim().toUpperCase() || selectedCustomer?.taxNumber?.trim().toUpperCase();\n      const verifiedActive = !!inputGstin && customerGstin === inputGstin && gstData?.gstin?.trim().toUpperCase() === inputGstin && gstData?.status === 'ACTIVE' && !!gstData?.isValid;\n      const manualB2B = gstManualMode && !!inputGstin;\n      if (!verifiedActive && !manualB2B && selectedCustomer?.gstStatus !== 'ACTIVE') {\n        setToastNotification('Verify the GSTIN first. If online verification is unavailable, choose Enter B2B Customer Details Manually.');\n        setTimeout(() => setToastNotification(null), 5000);\n        return;\n      }\n    }\n\n    let finalInvoiceNumber = '';""",
    "checkout B2B validation",
)

# Mark manually entered B2B customers as UNVERIFIED. Verified customers keep ACTIVE status.
replace_once(
    """      gstStatus: newCustType === 'LEDGER' ? (gstData?.status || 'UNVERIFIED') : undefined,""",
    """      gstStatus: newCustType === 'LEDGER' ? (gstManualMode ? 'UNVERIFIED' : (gstData?.status || 'UNVERIFIED')) : undefined,""",
    "manual B2B customer status",
)

# The current modal already allows complete manual business details, so only enforce
# online verification when the user did not explicitly choose the manual fallback.
replace_once(
    """    if (newCustType === 'LEDGER' && !gstin) {\n      setToastNotification('GSTIN is mandatory for a Ledger (B2B) customer.');\n      setTimeout(() => setToastNotification(null), 4500);\n      return;\n    }""",
    """    if (newCustType === 'LEDGER' && !gstin) {\n      setToastNotification('GSTIN is mandatory for a Ledger (B2B) customer.');\n      setTimeout(() => setToastNotification(null), 4500);\n      return;\n    }\n\n    if (newCustType === 'LEDGER' && !gstManualMode) {\n      const verifiedActive = gstData?.gstin?.trim().toUpperCase() === gstin && gstData?.status === 'ACTIVE' && !!gstData?.isValid;\n      if (!verifiedActive) {\n        setToastNotification('Verify the GSTIN online first, or use Enter B2B Customer Details Manually.');\n        setTimeout(() => setToastNotification(null), 5000);\n        return;\n      }\n    }""",
    "customer modal B2B validation",
)

# Clear manual mode whenever the POS session is reset after checkout.
replace_once(
    """    setGstInput('');\n    setGstData(null);\n  };""",
    """    setGstInput('');\n    setGstData(null);\n    setGstManualMode(false);\n  };""",
    "checkout GST reset",
)

p.write_text(s, encoding='utf-8')
print('Manual B2B fallback patch applied to current PosBillingView.tsx.')
