from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Patch target not found: {label}")
    return text.replace(old, new, 1)

# Frontend customer model: keep the SQL customer fields available in the POS model.
types_path = Path("src/types.ts")
types = types_path.read_text(encoding="utf-8")
types = replace_once(
    types,
    "  gstAddress?: string;\n  taxNumber?: string;\n  address?: string;",
    "  gstAddress?: string;\n  taxNumber?: string;\n  address?: string;\n  billingAddress?: string;\n  shippingAddress?: string;\n  city?: string;\n  state?: string;\n  stateCode?: string;",
    "customer address fields"
)
types_path.write_text(types, encoding="utf-8")

# POS customer creation flow.
pos_path = Path("src/components/PosBillingView.tsx")
pos = pos_path.read_text(encoding="utf-8")
pos = replace_once(
    pos,
    "  const [newCustEmail, setNewCustEmail] = useState('');\n  const [newCustTax, setNewCustTax] = useState('');",
    "  const [newCustEmail, setNewCustEmail] = useState('');\n  const [newCustTax, setNewCustTax] = useState('');\n  const [newCustBillingAddress, setNewCustBillingAddress] = useState('');\n  const [newCustShippingAddress, setNewCustShippingAddress] = useState('');\n  const [newCustCity, setNewCustCity] = useState('');\n  const [newCustState, setNewCustState] = useState('');\n  const [newCustStateCode, setNewCustStateCode] = useState('');\n  const [shippingSameAsBilling, setShippingSameAsBilling] = useState(true);",
    "customer form state"
)

# Replace submit handler validation and payload/reset.
pos = replace_once(
    pos,
    "  const handleCreateCustomerSubmit = (e: React.FormEvent) => {\n    e.preventDefault();\n    if (!newCustName.trim() || !newCustPhone.trim()) return;\n\n    const created = onAddNewCustomer({\n      name: newCustName,\n      phone: newCustPhone,\n      email: newCustEmail,\n      customerType: newCustType,\n      gstNumber: newCustType === 'LEDGER' ? newCustTax : undefined,\n      gstStatus: newCustType === 'LEDGER' ? 'ACTIVE' : undefined,\n      taxNumber: newCustTax\n    });\n\n    setSelectedCustomer(created);\n    setShowAddCustomerModal(false);\n    setNewCustName('');\n    setNewCustPhone('');\n    setNewCustEmail('');\n    setNewCustTax('');\n  };",
    """  const handleCreateCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCustName.trim();
    const phone = newCustPhone.trim();
    const billingAddress = newCustBillingAddress.trim();
    const shippingAddress = (shippingSameAsBilling ? newCustBillingAddress : newCustShippingAddress).trim();
    const city = newCustCity.trim();
    const state = newCustState.trim();
    const stateCode = newCustStateCode.trim();
    const gstin = newCustTax.trim().toUpperCase();

    if (!name || !phone || !billingAddress || !city || !state || !stateCode) {
      setToastNotification('Customer name, mobile, billing address, city, state and state code are required.');
      setTimeout(() => setToastNotification(null), 4500);
      return;
    }

    if (newCustType === 'LEDGER' && !gstin) {
      setToastNotification('GSTIN is mandatory for a Ledger (B2B) customer.');
      setTimeout(() => setToastNotification(null), 4500);
      return;
    }

    const created = onAddNewCustomer({
      name,
      phone,
      email: newCustEmail.trim() || undefined,
      customerType: newCustType,
      gstNumber: gstin || undefined,
      gstStatus: gstin ? 'ACTIVE' : undefined,
      taxNumber: gstin || undefined,
      address: billingAddress,
      billingAddress,
      shippingAddress: shippingAddress || billingAddress,
      city,
      state,
      stateCode,
      gstState: state,
      gstAddress: billingAddress
    });

    setSelectedCustomer(created);
    setShowAddCustomerModal(false);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustEmail('');
    setNewCustTax('');
    setNewCustBillingAddress('');
    setNewCustShippingAddress('');
    setNewCustCity('');
    setNewCustState('');
    setNewCustStateCode('');
    setShippingSameAsBilling(true);
  };""",
    "customer create handler"
)

# Replace the compact modal body with a complete customer details form.
modal_start = """            <form onSubmit={handleCreateCustomerSubmit} className=\"space-y-3\">"""
modal_end = """            </form>\n          </div>\n        </div>\n      )}"""
start = pos.find(modal_start)
if start < 0:
    raise SystemExit("Patch target not found: customer modal form start")
end = pos.find(modal_end, start)
if end < 0:
    raise SystemExit("Patch target not found: customer modal form end")
old_form = pos[start:end + len("            </form>")]
new_form = r'''            <form onSubmit={handleCreateCustomerSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {newCustType === 'LEDGER' ? 'Business / Firm Name' : 'Customer Name'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    placeholder={newCustType === 'LEDGER' ? 'e.g. Royal BuildCon Pvt Ltd' : 'e.g. John Doe'}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={newCustEmail}
                    onChange={(e) => setNewCustEmail(e.target.value)}
                    placeholder="accounts@business.com"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">GSTIN {newCustType === 'LEDGER' ? '*' : '(Optional)'}</label>
                  <input
                    type="text"
                    value={newCustTax}
                    onChange={(e) => setNewCustTax(e.target.value.toUpperCase())}
                    placeholder="24AAAAA1234A1Z5"
                    maxLength={15}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-mono uppercase"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 mb-2">Billing Address</h4>
                <textarea
                  required
                  value={newCustBillingAddress}
                  onChange={(e) => setNewCustBillingAddress(e.target.value)}
                  rows={2}
                  placeholder="Door / Flat, Street, Area, Locality"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs resize-none"
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                  <input
                    required
                    type="text"
                    value={newCustCity}
                    onChange={(e) => setNewCustCity(e.target.value)}
                    placeholder="City *"
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                  />
                  <input
                    required
                    type="text"
                    value={newCustState}
                    onChange={(e) => setNewCustState(e.target.value)}
                    placeholder="State *"
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                  />
                  <input
                    required
                    type="text"
                    value={newCustStateCode}
                    onChange={(e) => setNewCustStateCode(e.target.value.toUpperCase())}
                    placeholder="State Code *"
                    maxLength={3}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs uppercase"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300">Shipping Address</h4>
                  <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shippingSameAsBilling}
                      onChange={(e) => setShippingSameAsBilling(e.target.checked)}
                      className="accent-indigo-500"
                    />
                    Same as billing
                  </label>
                </div>
                {!shippingSameAsBilling && (
                  <textarea
                    required
                    value={newCustShippingAddress}
                    onChange={(e) => setNewCustShippingAddress(e.target.value)}
                    rows={2}
                    placeholder="Shipping / delivery address"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs resize-none"
                  />
                )}
              </div>

              {newCustType === 'LEDGER' && (
                <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-[11px] text-emerald-200">
                  Ledger customers require a valid GSTIN and complete billing details before they can be used on an invoice.
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800 sticky bottom-0 bg-slate-900">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow"
                >
                  Save Customer
                </button>
              </div>
            </form>'''
pos = pos[:start] + new_form + pos[end + len("            </form>"):]
pos_path.write_text(pos, encoding="utf-8")

print("Customer details patch applied.")
