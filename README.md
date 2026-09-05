# Shoplist

Static tool to turn household purchase history into a predictive shopping list.

## Usage

### Development (recommended)

```bash
./shopier.sh dev          # start Vite at http://localhost:5173
./shopier.sh dev --open   # + open browser
./shopier.sh build        # production build → dist/
./shopier.sh preview      # serve production build
```

Requires Node.js 18+ / npm. First `dev`/`build` auto-installs dependencies if `node_modules/` is missing.
Direct npm equivalents: `npm install`, `npm run dev`, `npm run build`, `npm run preview`.

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

- `base/base-datos.txt` → raw history (git-ignored). Run `npm run parse` or `./shopier.sh parse` to regenerate `base/productos.json`.
- `src/types.ts` / `src/App.tsx` → `catalog`, `modes`, `history` (products, aliases, sections, frequencies used for ranking/prediction).

To adapt it to your real purchase history, edit:

- `catalog`: products, brands, aliases, and replenishment cadence.
- `modes`: base lists per lifestyle mode.
- `history`: past purchases used for ranking and prediction.
