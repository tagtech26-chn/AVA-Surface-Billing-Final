from pathlib import Path

path = Path('src/components/ModernPosBillingView.tsx')
text = path.read_text(encoding='utf-8')

replacements = [
(
"  const [salespersons, setSalespersons] = useState<Salesperson[]>([]); const [salespersonId, setSalespersonId] = useState(''); const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');",
"  const [salespersons, setSalespersons] = useState<Salesperson[]>([]); const [salespersonId, setSalespersonId] = useState(''); const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH'); const [salespersonDiscountSettings, setSalespersonDiscountSettings] = useState({ defaultPercent: 0, maxPercent: 0 });"
),
(
"  useEffect(() => { let cancelled=false; fetch('/api/salespersons').then(async r=>{if(!r.ok)throw new Error();return r.json();}).then(d=>{if(!cancelled)setSalespersons(Array.isArray(d)?d:[])}).catch(()=>{if(!cancelled)setSalespersons([])}); return()=>{cancelled=true}; }, []);",
"  useEffect(() => { let cancelled=false; fetch('/api/salespersons').then(async r=>{if(!r.ok)throw new Error();return r.json();}).then(d=>{if(!cancelled)setSalespersons(Array.isArray(d)?d:[])}).catch(()=>{if(!cancelled)setSalespersons([])}); return()=>{cancelled=true}; }, []); useEffect(() => { let cancelled=false; fetch('/api/settings/billing-discounts').then(async r=>{if(!r.ok)throw new Error();return r.json();}).then(d=>{if(!cancelled)setSalespersonDiscountSettings({defaultPercent:Number(d.defaultSalespersonDiscountPercent??0),maxPercent:Number(d.maxSalespersonDiscountPercent??0)})}).catch(()=>{if(!cancelled)setSalespersonDiscountSettings({defaultPercent:0,maxPercent:0})}); return()=>{cancelled=true}; }, []);"
),
(
"discountAmount:0,discountPercent:0,finalUnitPrice:price,totalPrice:q*price",
"discountAmount:0,discountPercent:Math.min(salespersonDiscountSettings.defaultPercent,salespersonDiscountSettings.maxPercent),finalUnitPrice:price,totalPrice:q*price"
),
(
"const d=Math.max(0,Number(patch.discountPercent??l.discountPercent??0));return {...l,...patch,quantity:q,inputQuantity:q,discountPercent:d,",
"const d=Math.min(salespersonDiscountSettings.maxPercent,Math.max(0,Number(patch.discountPercent??l.discountPercent??salespersonDiscountSettings.defaultPercent)));return {...l,...patch,quantity:q,inputQuantity:q,discountPercent:d,"
),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Expected POS code block was not found:\n{old[:180]}')
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8', newline='\n')
print('Global salesperson discount POS integration applied.')
