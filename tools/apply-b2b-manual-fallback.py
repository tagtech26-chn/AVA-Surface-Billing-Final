from pathlib import Path

p = Path('src/components/PosBillingView.tsx')
s = p.read_text(encoding='utf-8')

def replace_once(old: str, new: str, label: str):
    global s
    if old not in s:
        raise SystemExit(f'Patch target not found: {label}')
    s = s.replace(old, new, 1)

replace_once(
'''                  ) : (\n                    <p className="text-[11px] text-rose-300">{gstData.message}</p>\n                  )}\n                </div>\n              )}\n            </div>''',
'''                  ) : (\n                    <div className="space-y-2">\n                      <p className="text-[11px] text-rose-300">{gstData.message}</p>\n                      <button\n                        type="button"\n                        onClick={() => {\n                          setNewCustType('LEDGER');\n                          setNewCustTax(gstInput.trim().toUpperCase());\n                          setNewCustName('');\n                          setNewCustPhone('');\n                          setNewCustEmail('');\n                          setNewCustBillingAddress('');\n                          setNewCustShippingAddress('');\n                          setNewCustCity('');\n                          setNewCustState('');\n                          setNewCustStateCode('');\n                          setNewCustPincode('');\n                          setShippingSameAsBilling(true);\n                          setShowAddCustomerModal(true);\n                        }}\n                        className="w-full px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition"\n                      >\n                        Enter B2B Customer Details Manually\n                      </button>\n                    </div>\n                  )}\n                </div>\n              )}\n            </div>''', 'GST failure manual fallback')

replace_once(
'''      gstNumber: gstin || undefined,\n      gstStatus: gstin ? 'ACTIVE' : undefined,\n      taxNumber: gstin || undefined,''',
'''      gstNumber: gstin || undefined,\n      gstStatus: newCustType === 'LEDGER' ? (gstData?.status || 'UNVERIFIED') : undefined,\n      gstLegalName: gstData?.legalName || undefined,\n      gstTradeName: gstData?.tradeName || undefined,\n      taxNumber: gstin || undefined,''', 'manual B2B status')

p.write_text(s, encoding='utf-8')
print('B2B manual fallback applied.')
