from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Patch target not found: {label}")
    return text.replace(old, new, 1)


# POS billing UI
pos_path = Path("src/components/PosBillingView.tsx")
pos = pos_path.read_text(encoding="utf-8")

pos = replace_once(
    pos,
    "  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);\n  const [promoInput, setPromoInput] = useState('');",
    "  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);\n  const [salespersons, setSalespersons] = useState<Array<{ id: string; code: string; name: string; mobile: string; isActive: boolean }>>([]);\n  const [selectedSalespersonId, setSelectedSalespersonId] = useState('');\n  const [promoInput, setPromoInput] = useState('');",
    "salesperson state"
)

pos = replace_once(
    pos,
    "  const [newCustTax, setNewCustTax] = useState('');\n\n  // Draft Bill Handler",
    "  const [newCustTax, setNewCustTax] = useState('');\n\n  const selectedSalesperson = useMemo(\n    () => salespersons.find((person) => person.id === selectedSalespersonId) || null,\n    [salespersons, selectedSalespersonId]\n  );\n\n  useEffect(() => {\n    let cancelled = false;\n    fetch('/api/salespersons')\n      .then(async (response) => {\n        if (!response.ok) throw new Error(`Salesperson API HTTP ${response.status}`);\n        return response.json();\n      })\n      .then((data) => {\n        if (!cancelled) setSalespersons(Array.isArray(data) ? data : []);\n      })\n      .catch((error) => {\n        console.error('Unable to load salesperson master:', error);\n        if (!cancelled) setSalespersons([]);\n      });\n    return () => { cancelled = true; };\n  }, []);\n\n  // Draft Bill Handler",
    "salesperson master load"
)

pos = re.sub(
    r"\n  const \[invoiceNumber, setInvoiceNumber\] = useState<string>\(\(\) => generateInvoiceNumber\(1000\)\);",
    "",
    pos,
    count=1,
)

# Only Box and Nos are exposed to the user. Existing internal 'pcs' is displayed as Nos.
unit_pattern = re.compile(r"(<select\s*\n\s*value=\{quickUnit\}[\s\S]*?</select>)")
match = unit_pattern.search(pos)
if not match:
    raise SystemExit("Patch target not found: quick unit selector")
pos = pos[:match.start()] + """<select
                  value={quickUnit}
                  onChange={(e) => setQuickUnit(e.target.value as TileQtyUnit)}
                  className=\"w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer\"
                >
                  <option value=\"box\">Box</option>
                  <option value=\"pcs\">Nos</option>
                </select>""" + pos[match.end():]

identity_pattern = re.compile(
    r"        /\* Invoice Identity & Salesperson \*/[\s\S]*?        /\* Payment Method Selector \*/"
)
identity_replacement = """        {/* Salesperson Selection */}
        <div className=\"bg-slate-800/80 p-3 rounded-2xl border border-slate-700\">
          <div className=\"flex items-center justify-between mb-1\">
            <label className=\"block text-[10px] font-bold text-slate-300\">Salesperson *</label>
            <span className=\"text-[10px] text-slate-500\">Cashier: {activeUser.name}</span>
          </div>
          <select
            value={selectedSalespersonId}
            onChange={(e) => setSelectedSalespersonId(e.target.value)}
            className=\"w-full px-3 py-2 bg-slate-900 border border-indigo-500/40 rounded-xl text-xs text-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500\"
          >
            <option value=\"\">Select salesperson for this bill</option>
            {salespersons.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name} ({person.mobile})
              </option>
            ))}
          </select>
          {!selectedSalespersonId && <p className=\"text-[10px] text-amber-400 mt-1\">Select a salesperson before checkout.</p>}
        </div>

        {/* Payment Method Selector */}"""
pos, count = identity_pattern.subn(identity_replacement, pos, count=1)
if count != 1:
    raise SystemExit("Patch target not found: invoice identity block")

checkout_pattern = re.compile(r"  const handleCheckoutSubmit = \(\) => \{[\s\S]*?    const paidAmount =")
checkout_replacement = """  const handleCheckoutSubmit = async () => {
    if (cartItems.length === 0) {
      setToastNotification('Add at least one item before saving the bill.');
      setTimeout(() => setToastNotification(null), 4000);
      return;
    }

    if (!selectedCustomer || !selectedCustomer.name.trim()) {
      setToastNotification('Customer name is required before saving the bill.');
      setTimeout(() => setToastNotification(null), 4000);
      return;
    }

    if (!selectedCustomer.phone?.trim()) {
      setToastNotification('Customer mobile number is required before saving the bill.');
      setTimeout(() => setToastNotification(null), 4000);
      return;
    }

    if (!selectedCustomer.address?.trim() && !selectedCustomer.gstAddress?.trim()) {
      setToastNotification('Customer address is required before saving the bill.');
      setTimeout(() => setToastNotification(null), 4000);
      return;
    }

    if (!selectedSalesperson) {
      setToastNotification('Select a salesperson before saving the bill.');
      setTimeout(() => setToastNotification(null), 4000);
      return;
    }

    let finalInvoiceNumber = '';
    try {
      const response = await fetch('/api/invoice-number', { method: 'POST' });
      if (!response.ok) throw new Error(`Invoice numbering API HTTP ${response.status}`);
      const payload = await response.json();
      finalInvoiceNumber = String(payload?.invoiceNumber || '').trim();
      if (!finalInvoiceNumber) throw new Error('Invoice numbering API returned an empty number.');
    } catch (error) {
      console.error('Invoice number allocation failed:', error);
      setToastNotification('Unable to generate the invoice number. The bill was not saved.');
      setTimeout(() => setToastNotification(null), 5000);
      return;
    }

    const paidAmount ="""
pos, count = checkout_pattern.subn(checkout_replacement, pos, count=1)
if count != 1:
    raise SystemExit("Patch target not found: checkout handler")

pos = pos.replace(
    "      invoiceNumber: invoiceNumber.trim(),",
    "      invoiceNumber: finalInvoiceNumber,",
    1,
)
pos = pos.replace(
    "      salespersonName: activeUser.name,\n      salespersonMobile: activeUser.phone || '',",
    "      salespersonName: selectedSalesperson.name,\n      salespersonMobile: selectedSalesperson.mobile,",
    1,
)
pos = pos.replace(
    "    setSelectedCustomer(null);\n    setAppliedPromo(null);",
    "    setSelectedCustomer(null);\n    setSelectedSalespersonId('');\n    setAppliedPromo(null);",
    1,
)
pos_path.write_text(pos, encoding="utf-8")

# Express UI host: salesperson proxy and FIFO save-time invoice number allocation.
server_path = Path("server.ts")
server = server_path.read_text(encoding="utf-8")

proxy_marker = 'app.use("/api/products", async (req, res, next) => {'
proxy_block = '''app.use("/api/salespersons", async (req, res, next) => {
  try {
    const query = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";
    const targetUrl = `${DOTNET_API_URL}/api/salespersons${query}`;
    const upstream = await fetch(targetUrl, { method: req.method });
    const responseText = await upstream.text();
    res.status(upstream.status);
    const upstreamContentType = upstream.headers.get("content-type");
    if (upstreamContentType) res.set("content-type", upstreamContentType);
    return res.send(responseText);
  } catch (error) {
    console.error("ASP.NET salesperson API proxy failed:", error);
    return next(error);
  }
});

'''
server = replace_once(server, proxy_marker, proxy_block + proxy_marker, "salesperson API proxy")

health_marker = 'app.get("/api/health", async (_req, res) => {'
number_block = '''let invoiceNumberQueue = Promise.resolve();

app.post("/api/invoice-number", async (_req, res, next) => {
  const task = invoiceNumberQueue.then(async () => {
    const year = new Date().getFullYear();
    const current = await getEntity("invoiceSequence", { year, nextNumber: 1 });
    const nextNumber = current?.year === year && Number(current?.nextNumber) > 0
      ? Number(current.nextNumber)
      : 1;

    await saveEntity("invoiceSequence", {
      year,
      nextNumber: nextNumber + 1,
      updatedAt: new Date().toISOString()
    });

    return `INV-${year}-${String(nextNumber).padStart(6, "0")}`;
  });

  invoiceNumberQueue = task.then(() => undefined, () => undefined);

  try {
    const invoiceNumber = await task;
    return res.json({ invoiceNumber });
  } catch (error) {
    console.error("Invoice number allocation failed:", error);
    return next(error);
  }
});

'''
server = replace_once(server, health_marker, number_block + health_marker, "invoice number endpoint")
server_path.write_text(server, encoding="utf-8")

# ASP.NET API: final invoice number is generated inside the SQL transaction.
inv_path = Path("server-dotnet/Controllers/InvoicesController.cs")
inv = inv_path.read_text(encoding="utf-8")

inv = replace_once(
    inv,
    "        var duplicateInvoice = await db.Invoices.AnyAsync(\n            x => x.CompanyId == request.CompanyId &&\n                 x.InvoiceNumber == request.InvoiceNumber.Trim(),\n            cancellationToken);\n\n        if (duplicateInvoice)\n            return Conflict(\"Invoice number already exists for this company.\");\n\n",
    "",
    "remove client invoice number duplicate check",
)

inv = replace_once(
    inv,
    "        if (string.IsNullOrWhiteSpace(request.InvoiceNumber))\n            return \"Invoice number is required.\";\n\n        if (request.InvoiceNumber.Trim().Length > 50)\n            return \"Invoice number cannot exceed 50 characters.\";\n\n",
    "",
    "remove client invoice number validation",
)

transaction_marker = "        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);\n        try\n        {\n            var invoiceId = Guid.NewGuid();"
transaction_replacement = """        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var invoiceYear = (request.InvoiceDate == default ? DateTime.UtcNow : request.InvoiceDate).Year;
            var lockResource = $\"AVASurface.InvoiceSeries.{request.CompanyId}.{invoiceYear}\";

            await db.Database.ExecuteSqlInterpolatedAsync(
                $\"EXEC sp_getapplock @Resource = {lockResource}, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000\",
                cancellationToken);

            var invoicePrefix = $\"INV-{invoiceYear}-\";
            var existingNumbers = await db.Invoices
                .Where(x => x.CompanyId == request.CompanyId && x.InvoiceNumber.StartsWith(invoicePrefix))
                .Select(x => x.InvoiceNumber)
                .ToListAsync(cancellationToken);

            var nextInvoiceNumber = 1;
            foreach (var existingNumber in existingNumbers)
            {
                var suffix = existingNumber[invoicePrefix.Length..];
                if (int.TryParse(suffix, out var parsed) && parsed >= nextInvoiceNumber)
                    nextInvoiceNumber = parsed + 1;
            }

            var generatedInvoiceNumber = $\"{invoicePrefix}{nextInvoiceNumber:000000}\";
            var invoiceId = Guid.NewGuid();"""
inv = replace_once(inv, transaction_marker, transaction_replacement, "invoice series transaction")

inv = replace_once(
    inv,
    "                InvoiceNumber = request.InvoiceNumber.Trim(),",
    "                InvoiceNumber = generatedInvoiceNumber,",
    "server generated invoice number",
)

inv = replace_once(
    inv,
    "        string InvoiceNumber,\n        DateTime InvoiceDate,",
    "        string? InvoiceNumber,\n        DateTime InvoiceDate,",
    "optional client invoice number",
)
inv_path.write_text(inv, encoding="utf-8")

print("Salesperson selection and invoice series patch applied.")
