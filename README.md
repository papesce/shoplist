# Shoplist

Static tool to turn household purchase history into a predictive shopping list.

## Usage

### Development (recommended)

```bash
npm run dev          # start Vite at http://localhost:5173
npm run dev -- --open   # + open browser
npm run build        # production build → dist/
npm run preview      # serve production build (DB at base/shoplist.db)
npm run server       # API + static on :4173
```

Requires Node.js 18+ / npm.

### Static (legacy)

Open `dist/index.html` after `npm run build`, or the old `base/` static version directly — no server required.

## Features

- Fast natural-language input.
- Shopping modes: auto, normal, grill, healthy, and snack.
- List organized by supermarket sections.
- Depletion prediction based on estimated frequency.
- Ranking of most-purchased products.
- Anchor products for associated suggestions.
- Simple habit metrics.

## Data

- `base/base-datos.txt` → raw history (git-ignored). Run `npm run parse` to regenerate `base/productos.json`.
- `src/types.ts` / `src/App.tsx` → `catalog`, `modes`, `history` (products, aliases, sections, frequencies used for ranking/prediction).

To adapt it to your real purchase history, edit:

- `catalog`: products, brands, aliases, and replenishment cadence.
- `modes`: base lists per lifestyle mode.
- `history`: past purchases used for ranking and prediction.
