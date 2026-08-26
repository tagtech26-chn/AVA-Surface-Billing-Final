from pathlib import Path

path = Path("src/components/ModernPosBillingView.tsx")
text = path.read_text(encoding="utf-8")

old_grid = 'className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 items-end"'
new_grid = 'className="grid gap-3 p-4 items-end" style={{gridTemplateColumns:"minmax(0,6fr) minmax(90px,0.9fr) minmax(120px,1.15fr) minmax(150px,1.35fr) 78px"}}'
old_search = 'className="md:col-span-6 relative"'
new_search = 'className="relative min-w-0"'

if text.count(old_grid) != 1:
    raise SystemExit(f"Expected exactly one item-entry grid, found {text.count(old_grid)}")
if text.count(old_search) != 1:
    raise SystemExit(f"Expected exactly one item-entry search column, found {text.count(old_search)}")

text = text.replace(old_grid, new_grid, 1)
text = text.replace(old_search, new_search, 1)
path.write_text(text, encoding="utf-8")
print("Modern POS item-entry layout repaired: compact five-column desktop row restored.")
