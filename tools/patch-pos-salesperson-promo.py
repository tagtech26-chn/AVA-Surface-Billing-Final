from pathlib import Path

path = Path('src/components/PosBillingView.tsx')
s = path.read_text(encoding='utf-8')

replacements = [
    (
        "  currencySymbol: string;\n}\n\nexport const PosBillingView",
        "  currencySymbol: string;\n}\n\ntype SalespersonOption = { id: string; code: string; name: string; mobile: string; };\n\nexport const PosBillingView",
        'add salesperson option type',
    ),
    (
        "  const [manualDiscount, setManualDiscount] = useState<number>(0);\n  const [invoiceNumber, setInvoiceNumber] = useState<string>(() => generateInvoiceNumber(1000));",
        "  const [manualDiscount, setManualDiscount] = useState<number>(0);\n  const [invoiceNumber, setInvoiceNumber] = useState<string>(() => generateInvoiceNumber(1000));\n  const [salespersons, setSalespersons] = useState<SalespersonOption[]>([]);\n  const [selectedSalespersonId, setSelectedSalespersonId] = useState('');\n  const [salespersonsLoading, setSalespersonsLoading] = useState(false);\n  const [promoSuppressed, setPromoSuppressed] = useState(false);",
        'add salesperson and promo state',
    ),
    (
        "  // GST Verification Handler\n  const handleVerifyGst = async",
        "  useEffect(() => {\n    let cancelled = false;\n    setSalespersonsLoading(true);\n    fetch('/api/salespersons')\n      .then(async (response) => {\n        if (!response.ok) throw new Error(`Salesperson API HTTP ${response.status}`);\n        return response.json() as Promise<SalespersonOption[]>;\n      })\n      .then((rows) => {\n        if (cancelled) return;\n        const active = Array.isArray(rows) ? rows.filter((row) => row && row.id && row.name && row.mobile) : [];\n        setSalespersons(active);\n      })\n      .catch((error) => {\n        console.error('Failed to load salesperson master:', error);\n        if (!cancelled) setSalespersons([]);\n      })\n      .finally(() => {\n        if (!cancelled) setSalespersonsLoading(false);\n      });\n    return () => { cancelled = true; };\n  }, []);\n\n  // GST Verification Handler\n  const handleVerifyGst = async",
        'load salesperson master',
    ),
    (
        "  const autoPromo = useMemo(() => {\n    if (appliedPromo) return null;\n    return promos.find(\n      (p) => p.isActive && p.autoApply && subtotal >= p.minOrderValue\n    );\n  }, [promos, subtotal, appliedPromo]);\n\n  const activePromoRule = appliedPromo || autoPromo;",
        "  const eligiblePromos = useMemo(() => {\n    return promos.filter((p) => p.isActive && subtotal >= p.minOrderValue);\n  }, [promos, subtotal]);\n\n  const autoPromo = useMemo(() => {\n    if (appliedPromo || promoSuppressed) return null;\n    return eligiblePromos.find((p) => p.autoApply) || null;\n  }, [eligiblePromos, appliedPromo, promoSuppressed]);\n\n  const activePromoRule = appliedPromo || autoPromo;",
        'make promo removable and selectable',
    ),
    (
        "    setAppliedPromo(promo);\n    setPromoInput('');",
        "    setAppliedPromo(promo);\n    setPromoSuppressed(false);\n    setPromoInput('');",
        'reset promo suppression on apply',
    ),
    (
        "  const handleCreateCustomerSubmit = (e: React.FormEvent) => {",
        "  const handlePromoSelection = (code: string) => {\n    setPromoError('');\n    if (code === '__NONE__') {\n      setAppliedPromo(null);\n      setPromoSuppressed(true);\n      return;\n    }\n    if (!code) {\n      setAppliedPromo(null);\n      setPromoSuppressed(false);\n      return;\n    }\n    const promo = eligiblePromos.find((p) => p.code.toUpperCase() === code.toUpperCase());\n    if (!promo) {\n      setPromoError('Selected promotion is no longer eligible for this bill.');\n      return;\n    }\n    setAppliedPromo(promo);\n    setPromoSuppressed(false);\n  };\n\n  const handleRemovePromo = () => {\n    setAppliedPromo(null);\n    setPromoSuppressed(true);\n    setPromoInput('');\n    setPromoError('');\n  };\n\n  const handleCreateCustomerSubmit = (e: React.FormEvent) => {",
        'add promo selection handlers',
    ),
    (
        "    if (!activeUser.phone?.trim()) {\n      setToastNotification('Salesperson mobile number is required for the invoice.');\n      setTimeout(() => setToastNotification(null), 4000);\n      return;\n    }",
        "    const selectedSalesperson = salespersons.find((row) => row.id === selectedSalespersonId);\n    if (!selectedSalesperson) {\n      setToastNotification('Please select a salesperson before saving the bill.');\n      setTimeout(() => setToastNotification(null), 4000);\n      return;\n    }\n\n    if (!selectedSalesperson.mobile?.trim()) {\n      setToastNotification('Selected salesperson mobile number is required for the invoice.');\n      setTimeout(() => setToastNotification(null), 4000);\n      return;\n    }",
        'validate selected salesperson',
    ),
    (
        "      cashierRole: activeUser.role,\n      salespersonName: activeUser.name,\n      salespersonMobile: activeUser.phone || '',",
        "      cashierRole: activeUser.role,\n      salespersonName: selectedSalesperson.name,\n      salespersonMobile: selectedSalesperson.mobile,",
        'save selected salesperson details',
    ),
    (
        "    setAppliedPromo(null);\n    setManualDiscount(0);",
        "    setAppliedPromo(null);\n    setPromoSuppressed(false);\n    setManualDiscount(0);",
        'reset promo state after checkout',
    ),
    (
        "                  <option value=\"box\">Boxes</option>\n                  <option value=\"pcs\">Nos / Pcs</option>\n                  <option value=\"sqft\">Sq.Ft</option>\n                  <option value=\"sqmt\">Sq.Mt</option>\n                  <option value=\"set\">Set / Pack</option>",
        "                  <option value=\"box\">Boxes</option>\n                  <option value=\"pcs\">Nos</option>",
        'limit billing units to boxes and nos',
    ),
    (
        "            {activePromoRule && (\n              <button\n                onClick={() => setAppliedPromo(null)}\n                className=\"text-[10px] text-rose-400 hover:underline\"\n              >\n                Remove\n              </button>\n            )}\n          </div>\n\n          {activePromoRule ? (\n            <div className=\"p-2 bg-emerald-950/60 border border-emerald-500/40 rounded-xl flex items-center justify-between text-xs text-emerald-300\">\n              <div>\n                <span className=\"font-bold\">{activePromoRule.code}</span> ({activePromoRule.title})\n              </div>\n              <span className=\"font-extrabold text-emerald-400\">\n                -{formatCurrency(promoDiscountAmount, currencySymbol)}\n              </span>\n            </div>\n          ) : (\n            <form onSubmit={handleApplyPromoCode} className=\"flex gap-2\">",
        "            <button\n              type=\"button\"\n              onClick={handleRemovePromo}\n              disabled={!activePromoRule && promoSuppressed}\n              className=\"text-[10px] text-rose-400 hover:underline disabled:text-slate-600 disabled:no-underline\"\n            >\n              Remove\n            </button>\n          </div>\n\n          <div className=\"grid grid-cols-1 sm:grid-cols-2 gap-2\">\n            <select\n              value={activePromoRule?.code || (promoSuppressed ? '__NONE__' : '')}\n              onChange={(e) => handlePromoSelection(e.target.value)}\n              className=\"w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500\"\n            >\n              <option value=\"\">Auto / Select Promotion</option>\n              <option value=\"__NONE__\">No Promotion</option>\n              {eligiblePromos.map((promo) => (\n                <option key={promo.id} value={promo.code}>\n                  {promo.code} - {promo.title} ({promo.discountValue}{promo.discountType === 'PERCENTAGE' ? '%' : ''})\n                </option>\n              ))}\n            </select>\n\n            {activePromoRule ? (\n              <div className=\"p-2 bg-emerald-950/60 border border-emerald-500/40 rounded-xl flex items-center justify-between text-xs text-emerald-300\">\n                <div>\n                  <span className=\"font-bold\">{activePromoRule.code}</span> ({activePromoRule.title})\n                </div>\n                <span className=\"font-extrabold text-emerald-400\">\n                  -{formatCurrency(promoDiscountAmount, currencySymbol)}\n                </span>\n              </div>\n            ) : (\n              <form onSubmit={handleApplyPromoCode} className=\"flex gap-2\">",
        'add promo selector and removable promo',
    ),
    (
        "          <div>\n            <label className=\"block text-[10px] font-bold text-slate-300 mb-1\">Salesperson</label>\n            <div className=\"px-3 py-2 bg-slate-900 border border-slate-600 rounded-xl text-xs text-white font-semibold\">{activeUser.name} · {activeUser.phone || 'Mobile missing'}</div>\n          </div>",
        "          <div>\n            <label className=\"block text-[10px] font-bold text-slate-300 mb-1\">Salesperson *</label>\n            <select\n              value={selectedSalespersonId}\n              onChange={(e) => setSelectedSalespersonId(e.target.value)}\n              disabled={salespersonsLoading}\n              className=\"w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-xl text-xs text-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer disabled:opacity-60\"\n            >\n              <option value=\"\">{salespersonsLoading ? 'Loading salespersons...' : 'Select Salesperson'}</option>\n              {salespersons.map((salesperson) => (\n                <option key={salesperson.id} value={salesperson.id}>\n                  {salesperson.name} · {salesperson.mobile}\n                </option>\n              ))}\n            </select>\n          </div>",
        'replace salesperson display with selector',
    ),
]

for old, new, label in replacements:
    if old not in s:
        raise SystemExit(f'PATCH_MISSING: {label}')
    s = s.replace(old, new, 1)

# Make the auto-generated invoice number display-only for now; final save remains the authority.
s = s.replace(
    'className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-xl text-xs text-white font-mono font-bold" placeholder="Invoice Number" />',
    'readOnly className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-xl text-xs text-white font-mono font-bold opacity-80" placeholder="Invoice Number" />',
    1,
)

path.write_text(s, encoding='utf-8')
print('POS salesperson/promo/unit patch applied successfully.')
