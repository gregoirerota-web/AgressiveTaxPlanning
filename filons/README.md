# FILONS — v4.1

React adaptation of the mining-fiscal negotiation serious game, imported from the user's uploaded `filons_v4_1.jsx`. This is a **different game** from the TaxShift tax-planning simulator in the repository root. The applications are intentionally kept separate.

## Run locally

Requires Node.js 18 or later.

```sh
cd filons
npm install
npm run dev
```

Use `npm run build` to produce a deployable `dist/` directory.

## Structure
- `src/Filons.jsx`: original uploaded game logic, imported without deliberate gameplay changes.
- `src/main.jsx`: React entry point.
- `index.html`: browser shell.

Tailwind CSS is loaded from its CDN for this prototype. Production deployment should use a pinned local CSS build for reproducibility and offline delivery.

## Scope of this integration
The original FILONS rules, mining licences, exploration, investment, mineral-price shocks and strategic moves remain separate from the one-period TaxShift model. This avoids conflating different payoff structures. FILONS gameplay logic still requires a full browser playthrough and balancing review before release.
