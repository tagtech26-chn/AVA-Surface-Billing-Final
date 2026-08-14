from pathlib import Path

# Invoice list must use the selected salesperson, not cashier.
p = Path('src/components/InvoicesView.tsx')
s = p.read_text(encoding='utf-8')
repls = [
    ("if (inv.cashierName) set.add(inv.cashierName);", "if (inv.salespersonName) set.add(inv.salespersonName);") ,
    ("const sp = inv.cashierName || 'Unassigned';", "const sp = inv.salespersonName || 'Unassigned';"),
    ("list = list.filter((inv) => inv.cashierName === selectedSalesperson);", "list = list.filter((inv) => inv.salespersonName === selectedSalesperson);"),
    ("const matchSalesperson = inv.cashierName.toLowerCase().includes(searchLower);", "const matchSalesperson = (inv.salespersonName || '').toLowerCase().includes(searchLower);"),
    ("<span className=\"font-extrabold text-xs text-indigo-200\">{inv.cashierName || 'Cashier'}</span>", "<span className=\"font-extrabold text-xs text-indigo-200\">{inv.salespersonName || 'Unassigned'}</span>"),
]
for old, new in repls:
    if old not in s:
        raise SystemExit(f'InvoicesView target not found: {old}')
    s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# Customer model: optional pincode for B2C/B2B.
p = Path('server-dotnet/Domain/Entities.cs')
s = p.read_text(encoding='utf-8')
old = '    public string? StateCode { get; set; }\n    public string CustomerType { get; set; } = "B2C";'
new = '    public string? StateCode { get; set; }\n    public string? Pincode { get; set; }\n    public string CustomerType { get; set; } = "B2C";'
if old not in s:
    raise SystemExit('Entities customer pincode target not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# API: state code is required only for B2B; B2C pincode is optional.
p = Path('server-dotnet/Controllers/InvoicesController.cs')
s = p.read_text(encoding='utf-8')
old = '''            if (string.IsNullOrWhiteSpace(customer.City) ||\n                string.IsNullOrWhiteSpace(customer.State) ||\n                string.IsNullOrWhiteSpace(customer.StateCode))\n                return BadRequest("Customer city, state and state code are required before saving the invoice.");\n\n            if (customer.CustomerType.Equals("B2B", StringComparison.OrdinalIgnoreCase) &&\n                !IsValidGstin(customer.Gstin))\n                return BadRequest("A valid GSTIN is required for B2B customers.");'''
new = '''            if (string.IsNullOrWhiteSpace(customer.City) ||\n                string.IsNullOrWhiteSpace(customer.State))\n                return BadRequest("Customer city and state are required before saving the invoice.");\n\n            if (customer.CustomerType.Equals("B2B", StringComparison.OrdinalIgnoreCase))\n            {\n                if (string.IsNullOrWhiteSpace(customer.StateCode))\n                    return BadRequest("State code is required for B2B customers.");\n\n                if (!IsValidGstin(customer.Gstin))\n                    return BadRequest("A valid GSTIN is required for B2B customers.");\n            }'''
if old not in s:
    raise SystemExit('InvoicesController B2C validation target not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# POS customer form: add optional pincode and do not require state code for B2C.
p = Path('src/components/PosBillingView.tsx')
s = p.read_text(encoding='utf-8')
old = "  const [newCustStateCode, setNewCustStateCode] = useState('');\n  const [shippingSameAsBilling, setShippingSameAsBilling] = useState(true);"
new = "  const [newCustStateCode, setNewCustStateCode] = useState('');\n  const [newCustPincode, setNewCustPincode] = useState('');\n  const [shippingSameAsBilling, setShippingSameAsBilling] = useState(true);"
if old not in s:
    raise SystemExit('POS pincode state target not found')
s = s.replace(old, new, 1)
old = """    if (!name || !phone || !billingAddress || !city || !state || !stateCode) {\n      setToastNotification('Customer name, mobile, billing address, city, state and state code are required.');"""
new = """    if (!name || !phone || !billingAddress || !city || !state) {\n      setToastNotification('Customer name, mobile, billing address, city and state are required.');"""
if old not in s:
    raise SystemExit('POS customer validation target not found')
s = s.replace(old, new, 1)
old = """    if (newCustType === 'LEDGER' && !gstin) {\n      setToastNotification('GSTIN is mandatory for a Ledger (B2B) customer.');"""
# Keep existing detailed online verification behavior if present; this only guards empty GSTIN where the patch has not yet replaced it.
# State code requirement is handled below.
if old in s:
    s = s.replace(old, old, 1)
old = """      stateCode,\n      gstState: state,\n      gstAddress: billingAddress\n    });"""
new = """      stateCode: newCustType === 'LEDGER' ? stateCode : undefined,\n      pincode: newCustPincode.trim() || undefined,\n      gstState: state,\n      gstAddress: billingAddress\n    });"""
if old not in s:
    raise SystemExit('POS customer payload target not found')
s = s.replace(old, new, 1)
old = """    setNewCustState('');\n    setNewCustStateCode('');\n    setShippingSameAsBilling(true);"""
new = """    setNewCustState('');\n    setNewCustStateCode('');\n    setNewCustPincode('');\n    setShippingSameAsBilling(true);"""
if old not in s:
    raise SystemExit('POS customer reset target not found')
s = s.replace(old, new, 1)
# Add optional pincode input beside city/state/state code row and only show state code for B2B.
old = """                  <input\n                    required\n                    type=\"text\"\n                    value={newCustStateCode}\n                    onChange={(e) => setNewCustStateCode(e.target.value.toUpperCase())}\n                    placeholder=\"State Code *\"\n                    maxLength={3}\n                    className=\"px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs uppercase\"\n                  />"""
new = """                  {newCustType === 'LEDGER' && (\n                    <input\n                      required\n                      type=\"text\"\n                      value={newCustStateCode}\n                      onChange={(e) => setNewCustStateCode(e.target.value.toUpperCase())}\n                      placeholder=\"State Code *\"\n                      maxLength={3}\n                      className=\"px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs uppercase\"\n                    />\n                  )}\n                  <input\n                    type=\"text\"\n                    value={newCustPincode}\n                    onChange={(e) => setNewCustPincode(e.target.value.replace(/\\D/g, '').slice(0, 6))}\n                    placeholder=\"Pincode (Optional)\"\n                    maxLength={6}\n                    className=\"px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs\"\n                  />"""
if old not in s:
    raise SystemExit('POS address fields target not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

print('Salesperson display and B2C customer fixes applied.')
