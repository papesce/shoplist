# Shoplist

Static tool to turn household purchase history into a predictive shopping list.

## Usage

Open `index.html` in your browser. No installation or server required.

## Features

- Fast natural-language input.
- Shopping modes: auto, normal, grill, healthy, and snack.
- List organized by supermarket sections.
- Depletion prediction based on estimated frequency.
- Ranking of most-purchased products.
- Anchor products for associated suggestions.
- Simple habit metrics.

## Data

Products, aliases, sections, frequencies, and purchase history are in `app.js`.
To adapt it to your real purchase history, edit:

- `catalog`: products, brands, aliases, and replenishment cadence.
- `modes`: base lists per lifestyle mode.
- `history`: past purchases used for ranking and prediction.
