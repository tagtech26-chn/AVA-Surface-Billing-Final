from pathlib import Path

path = Path('src/components/ModernPosBillingView.tsx')
text = path.read_text(encoding='utf-8')

old = "</style></div>};"
new = "</style></div></div>};"

if old not in text:
    if new in text:
        print('Modern POS JSX root container is already repaired.')
    else:
        raise SystemExit('PATCH_MISSING: expected Modern POS JSX ending not found')
else:
    text = text.replace(old, new, 1)
    path.write_text(text, encoding='utf-8')
    print('Modern POS JSX root container repaired successfully.')
