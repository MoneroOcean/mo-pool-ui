# MoneroOcean Pool UI

MoneroOcean Pool UI is a static dashboard for the MoneroOcean mining pool. It talks directly to the public MoneroOcean pool API, lets miners inspect pool and wallet state, and keeps the deployed surface to three files: `index.html`, `script.js`, and `style.css`.

This branch refactors the old single-file dashboard into small ES modules under `src/`, with `script.js` kept as the stable browser and build entry point. The production build bundles the modules back into `build/script.js`, minifies CSS, and adds a git-based cache key to the generated HTML.

## Current Features

- Pool overview, coin list, blocks, payments, uptime, and profit calculator views.
- Wallet dashboard with workers, hashrate charts, block rewards, payout history, and wallet settings helpers.
- Miner setup command generation for MoneroOcean XMRig, SRBMiner-Multi, meta-miner, xmrig-proxy, and xmr-node-proxy.
- Hash-route navigation with SEO metadata and canonical URL updates.
- Local display preferences for theme and explanatory text.
- Focused Node.js tests for routing, formatting, wallet behavior, setup output, scheduler behavior, build invariants, and pool-specific calculations.

## Project Layout

- `index.html` - static shell and crawler-visible metadata.
- `style.css` - full UI styling, bundled and minified during build.
- `script.js` - browser/build entry point that starts the app.
- `src/` - application modules for API calls, routing, views, formatting, charting, state, preferences, setup helpers, and wallet logic.
- `test/` - Node.js test suite.
- `build.sh` - production build and deploy script.

## Development

Install dependencies:

```sh
npm install
```

Run tests:

```sh
npm test
```

Build and deploy to `/var/www/mo-pool-ui`:

```sh
npm run build
```

The build script removes and recreates `build/`, bundles `script.js` with esbuild, bundles `style.css`, rewrites cache-busted asset URLs in `build/index.html`, runs the test suite, and copies the result to `/var/www/mo-pool-ui`.

## Compatibility

The source now uses modern JavaScript modules during development and esbuild produces an ES2019 IIFE for deployment. The runtime UI has no third-party browser framework dependency.

## Contributors

- [MoneroOcean](https://github.com/MoneroOcean) - MoneroOcean-specific maintenance and current dashboard refactor.
- [Thunderosa](https://github.com/Thunderosa) - main early author in the SupportXMR GUI lineage.
- [M5M400](https://github.com/M5M400) - SupportXMR GUI owner and contributor.
- [tevador](https://github.com/tevador) - legacy GUI contribution.
- [mesh0000](https://github.com/mesh0000) - main author of the older `poolui` / XMRPoolUI frontend.
- Snipa22 / Alexander Blair - `nodejs-pool` backend author/maintainer and minor `poolui` contributor.

## Lineage

This UI is based on MoneroOcean's legacy `moneroocean-gui`, which was forked from `M5M400/supportxmr-gui`. It is designed for MoneroOcean's `nodejs-pool` API, whose history traces through Snipa22's `nodejs-pool`, Mesh00's AngularJS `poolui` / XMRPoolUI frontend, and Zone117x's original `node-cryptonote-pool`.

Based on work of [Thunderosa](https://github.com/Thunderosa) and [mesh0000](https://github.com/mesh0000).
