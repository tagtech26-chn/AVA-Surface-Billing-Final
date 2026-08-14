from pathlib import Path

p = Path('src/components/PosBillingView.tsx')
s = p.read_text(encoding='utf-8')

def replace_once(old: str, new: str, label: str):
    global s
    if old not in s:
        raise SystemExit(f'Patch target not found: {label}')
    s = s.replace(old, new, 1)

replace_once(
"""      const res = await lookupGstDetails(targetGst);\n      setGstData(res);\n      if (res.isValid && res.status === 'ACTIVE') {\n        if (!ledgerCustName) {\n          setLedgerCustName(res.tradeName || res.legalName);\n        }\n      }""",
"""      const res = await lookupGstDetails(targetGst);\n      setGstData(res);\n      if (res.status === 'ACTIVE' && res.isValid) {\n        setLedgerCustName(res.tradeName || res.legalName);\n        setNewCustName(res.tradeName || res.legalName);\n        setNewCustTax(res.gstin);\n        setNewCustBillingAddress(res.address || '');\n        setNewCustState(res.stateName || '');\n        setNewCustStateCode(res.stateCode || '');\n      }""", 'GST handler')

replace_once(
"""    if (!selectedSalesperson) {\n      setToastNotification('Select a salesperson before saving the bill.');\n      setTimeout(() => setToastNotification(null), 4000);\n      return;\n    }""",
"""    if (!selectedSalesperson) {\n      setToastNotification('Select a salesperson before saving the bill.');\n      setTimeout(() => setToastNotification(null), 4000);\n      return;\n    }\n\n    if (customerType === 'LEDGER') {\n      const verifiedGstin = gstData?.gstin?.trim().toUpperCase();\n      if (!gstInput.trim() || verifiedGstin !== gstInput.trim().toUpperCase() || gstData?.status !== 'ACTIVE' || !gstData?.isValid) {\n        setToastNotification('B2B/Ledger billing requires successful online GSTIN verification with ACTIVE status.');\n        setTimeout(() => setToastNotification(null), 5000);\n        return;\n      }\n    }""", 'checkout GST validation')

replace_once(
"""    if (!finalCustomerObj && customerType === 'LEDGER' && gstInput.trim()) {\n      // Auto-register ledger customer if entered on the fly\n      finalCustomerObj = onAddNewCustomer({\n        name: ledgerCustName || gstData?.tradeName || gstData?.legalName || `Ledger GST (${gstInput})`,\n        phone: ledgerCustPhone || '+91 99000 00000',\n        customerType: 'LEDGER',\n        gstNumber: gstInput.trim(),\n        gstLegalName: gstData?.legalName,\n        gstTradeName: gstData?.tradeName,\n        gstStatus: gstData?.status || 'ACTIVE',\n        gstState: gstData?.stateName,\n        taxNumber: gstInput.trim(),\n        address: gstData?.address || 'Registered Business GST Address'\n      });\n    }""",
"""    if (!finalCustomerObj && customerType === 'LEDGER' && gstInput.trim() && gstData?.status === 'ACTIVE') {\n      finalCustomerObj = onAddNewCustomer({\n        name: gstData.tradeName || gstData.legalName,\n        phone: ledgerCustPhone || '',\n        customerType: 'LEDGER',\n        gstNumber: gstData.gstin,\n        gstLegalName: gstData.legalName,\n        gstTradeName: gstData.tradeName,\n        gstStatus: 'ACTIVE',\n        gstState: gstData.stateName,\n        taxNumber: gstData.gstin,\n        address: gstData.address,\n        billingAddress: gstData.address,\n        city: '',\n        state: gstData.stateName,\n        stateCode: gstData.stateCode,\n        shippingAddress: gstData.address\n      });\n    }""", 'verified ledger auto-create')

# Current expanded customer modal: add an explicit GST verification button and status panel.
replace_once(
"""                  <label className=\"block text-xs font-medium text-slate-300 mb-1\">GSTIN {newCustType === 'LEDGER' ? '*' : '(Optional)'}</label>\n                  <input\n                    type=\"text\"\n                    value={newCustTax}\n                    onChange={(e) => setNewCustTax(e.target.value.toUpperCase())}\n                    placeholder=\"24AAAAA1234A1Z5\"\n                    maxLength={15}\n                    className=\"w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-mono uppercase\"\n                  />""",
"""                  <label className=\"block text-xs font-medium text-emerald-300 mb-1\">GSTIN {newCustType === 'LEDGER' ? '*' : '(Optional)'}</label>\n                  <div className=\"flex gap-2\">\n                    <input\n                      type=\"text\"\n                      value={newCustTax}\n                      onChange={(e) => { setNewCustTax(e.target.value.toUpperCase()); setGstInput(e.target.value.toUpperCase()); setGstData(null); }}\n                      placeholder=\"24AAAAA1234A1Z5\"\n                      maxLength={15}\n                      className=\"flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-mono uppercase\"\n                    />\n                    {newCustType === 'LEDGER' && (\n                      <button type=\"button\" onClick={() => handleVerifyGst(newCustTax)} disabled={isVerifyingGst || !newCustTax.trim()} className=\"px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl\">\n                        {isVerifyingGst ? 'Checking…' : 'Verify'}\n                      </button>\n                    )}\n                  </div>\n                  {newCustType === 'LEDGER' && gstData && (\n                    <div className={`mt-2 p-2 rounded-xl border text-[10px] ${gstData.status === 'ACTIVE' ? 'bg-emerald-950 border-emerald-500/50 text-emerald-200' : 'bg-rose-950 border-rose-500/50 text-rose-200'}`}>\n                      <strong>{gstData.status}</strong> — {gstData.message}\n                    </div>\n                  )}""", 'expanded customer GST verification')

replace_once(
"""                  value={newCustName}\n                  onChange={(e) => setNewCustName(e.target.value)}""",
"""                  value={newCustName}\n                  readOnly={newCustType === 'LEDGER' && gstData?.status === 'ACTIVE'}\n                  onChange={(e) => setNewCustName(e.target.value)}""", 'verified customer name readonly')

# Require online ACTIVE verification before creating a Ledger customer from the modal.
replace_once(
"""    if (newCustType === 'LEDGER' && !gstin) {\n      setToastNotification('GSTIN is mandatory for a Ledger (B2B) customer.');\n      setTimeout(() => setToastNotification(null), 4500);\n      return;\n    }""",
"""    if (newCustType === 'LEDGER' && (!gstin || gstData?.gstin !== gstin || gstData?.status !== 'ACTIVE' || !gstData?.isValid)) {\n      setToastNotification('Verify the GSTIN online and confirm ACTIVE status before saving a B2B/Ledger customer.');\n      setTimeout(() => setToastNotification(null), 5000);\n      return;\n    }""", 'customer modal validation')

p.write_text(s, encoding='utf-8')
print('B2B GST verification flow patched.')
