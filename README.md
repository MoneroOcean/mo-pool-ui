<div align="center">

# mo-pool-ui

Static, framework-free web dashboard for the MoneroOcean mining pool.

<p>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/node-%E2%89%A522.9-brightgreen.svg" alt="Node >=22.9">
  <img src="https://img.shields.io/badge/platform-browser-lightgrey.svg" alt="Platform: browser">
  <img src="https://img.shields.io/badge/focus-frontend-d29922.svg" alt="Focus: frontend">
  <a href="https://github.com/MoneroOcean"><img src="https://img.shields.io/badge/MoneroOcean-ecosystem-6f42c1.svg" alt="MoneroOcean ecosystem"></a>
</p>

</div>

## Overview

mo-pool-ui is a static dashboard for the MoneroOcean mining pool. It talks directly to the public MoneroOcean pool API, lets miners inspect pool and wallet state, and keeps the deployed surface to three files: `index.html`, `script.js`, and `style.css`.

Internally the dashboard is split into small ES modules under `src/`, with `script.js` kept as the stable browser and build entry point. The production build bundles those modules back into `build/script.js`, minifies CSS, and adds a git-based cache key to the generated HTML.

The UI is the frontend companion to [nodejs-pool](https://github.com/MoneroOcean/nodejs-pool), the pool backend whose API it consumes. It has no third-party browser framework dependency.

## Features

- Pool overview, coin list, blocks, payments, uptime, and profit calculator views.
- Wallet dashboard with workers, hashrate charts, block rewards, payout history, and wallet settings helpers.
- Miner and proxy setup generation for direct mining and managed algorithm switching.
- Hash-route navigation with SEO metadata and canonical URL updates.
- Local display preferences for theme and explanatory text.
- Focused Node.js tests for routing, formatting, wallet behavior, setup output, scheduler behavior, build invariants, and pool-specific calculations.

GPU recommendations reflect tested cards, not universal vendor support.

## Architecture

| Path | Role |
| --- | --- |
| `index.html` | Static shell and crawler-visible metadata. |
| `style.css` | Full UI styling, bundled and minified during build. |
| `script.js` | Browser/build entry point that starts the app (`startApp` from `src/main.js`). |
| `src/` | Application modules: API calls, routing, views, formatting, charting, state, preferences, setup helpers, and wallet logic. |
| `src/views/` | Rendered page views. |
| `src/styles/` | Style sources used by the build. |
| `tests/` | Node.js test suite plus Playwright end-to-end tests. |
| `scripts/build-static.sh` | Static bundling helper. |
| `build.sh` | Production build and deploy script. |

The source uses modern JavaScript modules during development, and esbuild produces an ES2022 IIFE for deployment.

## Install

```sh
npm install
```

Requires Node.js `>=22.9.0` and npm `>=11.10.0` (see `engines` in `package.json`).

## Usage

Build and deploy to the web root configured in `build.sh`:

```sh
npm run build
```

The build script removes and recreates `build/`, bundles `script.js` with esbuild, bundles `style.css`, rewrites cache-busted asset URLs in `build/index.html`, runs the test suite, and copies the checked result to the deployment web root.

To produce only the static bundle without deploying:

```sh
npm run build:static
```

## Testing

```sh
npm test
```

Runs the Node.js unit and integration suite plus the browser checks registered by `tests/all.mjs` using the built-in `node --test` runner with a single-concurrency spec reporter.

Linux/macOS shell tests require Bash and `jq` (`sudo apt-get install jq` or `brew install jq`).

Additional targets:

```sh
npm run test:unit   # focused Node.js unit suite
npm run test:e2e    # browser-only target: builds the static bundle, then runs Playwright e2e tests
```

Both `npm test` and `npm run test:e2e` require the Playwright browser binaries (`npx playwright install`). `npm run test:unit` remains the focused Node.js-only suite.

### Memory safeguards

On Linux, build, lint, and test entry points run in a systemd cgroup with a
2 GiB total memory limit, no swap, and a 512 MiB Node.js heap limit per process.
The total limit includes Chromium and other child processes. Exceeding it stops
the whole group and fails the command. Deployment starts only after tests pass.

Linux requires cgroup v2, `systemd-run`, `flock`, and a working systemd user
manager (or the system manager when running as root). Commands verify the
enforced limits before starting work and fail if protection is unavailable.
A repository lock rejects overlapping runs; nested build/test commands share
the same lock and memory budget. `npm test` holds both throughout linting,
bundling, and testing. Direct `build.sh` and `scripts/build-static.sh` invocations
use the same safeguards.

Playwright runs desktop and mobile checks sequentially with one worker, no
retries, no trace recording, and a ten-minute suite timeout. Failed tests still
capture screenshots. Run browser tests through `npm test` or `npm run test:e2e`
to include the process memory limit; raw `npx playwright test` bypasses the
wrapper. On other operating systems the wrapper runs without a hard memory
limit and reports that limitation.

To check an extracted MoM GitHub release without mining, set `MOM_TEST_RELEASE_ROOT`
(optionally `MOM_TEST_RELEASE_VERSION`) and run `node --test tests/mom-release.mjs`.
Windows archive-staging checks run when PowerShell is available.

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

## MoneroOcean ecosystem

| Component | Role |
| --- | --- |
| [nodejs-pool](https://github.com/MoneroOcean/nodejs-pool) | Pool backend — stratum, share storage, payments |
| [mo-pool-ui](https://github.com/MoneroOcean/mo-pool-ui) | Static web frontend for the pool |
| [xmr-node-proxy](https://github.com/MoneroOcean/xmr-node-proxy) | Stratum proxy / share aggregator |
| [mo-miner](https://github.com/MoneroOcean/mo-miner) | MoneroOcean end-user CPU/GPU mining client (multi-algo) |
| [multi-miner](https://github.com/MoneroOcean/multi-miner) | Multi-algo miner manager |
| [node-powhash](https://github.com/MoneroOcean/node-powhash) | Native multi-algo PoW hashing addon |
| [node-randomx](https://github.com/MoneroOcean/node-randomx) | Native RandomX hashing addon |
| [node-blocktemplate](https://github.com/MoneroOcean/node-blocktemplate) | Native block-template & serialization addon |
| [grpc-json-proxy](https://github.com/MoneroOcean/grpc-json-proxy) | gRPC ↔ JSON-RPC proxy (Tari base node) |

## License

MIT — see [LICENSE](LICENSE).
