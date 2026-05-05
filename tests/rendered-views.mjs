import test from "node:test";
import assert from "node:assert/strict";
import { BLOCK_SHARE_DUMP_BASE, COIN_EXPLORERS, COIN_HEIGHT_EXPLORERS, DONATION_XMR, GRAPH_WINDOWS, EXPLANATIONS } from "../src/constants.js";
import { averageVisible, chartModel, filterWindow, graphWindow, isWithinPplnsWindow, pplnsWindowRect, svgLine } from "../src/charts.js";
import { atomicXmr, formatAge, formatHashrate, formatTinyPercent, normalizeTimestampSeconds } from "../src/format.js";
import { averageBlockEffort, blockCoinPort, blockEffortPercent, coinAtomicUnits, coinBlockCount, coinHashScalar, coinName, coinProfitValue, coinStatsRows, effortTone, topCoinPort, currentEffort, effortPercent, hasBlockHistory, worldHashrateForPort } from "../src/pool.js";
import { appendWallet, loadWatchlist, localHistoryEnabled, setConsent, shouldAskConsent } from "../src/privacy.js";
import { isXmrAddress, parseRoute, routeCoinId } from "../src/routes.js";
import { RefreshScheduler } from "../src/scheduler.js";
import { setupAddress, setupAlgoOptions, setupConfiguredPorts, setupHashrateDefaults, setupHashrateToHps, setupPlan, setupProfileOptions } from "../src/setup.js";
import { api, endpointKey, minerEndpoint, POOL_CHART, WALLET_CHART, WALLET_WORKER_CHARTS } from "../src/api.js";
import { state } from "../src/state.js";
import { hasColdGraphLoad, isSameViewNavigation, isStaticRoute, shouldScrollToTop, shouldShowLoading } from "../src/render-policy.js";
import { clearPreferenceStorage, parseCookieValue, readPreferences, saveExplanations, saveTheme, toggleExplanations, toggleTheme } from "../src/preferences.js";
import { summarizeUptimeRobot } from "../src/uptime.js";
import { blockPageSize, MAX_ROUTE_PAGE, pageCountFor, routePageNumber } from "../src/paging.js";
import { nextSortDirection, nextSortDirectionForKey, sortDirection, sortRows } from "../src/table-sort.js";
import { compactWorkerRows, sortWorkerListRows, sortWorkerRows, trackWalletState, workerDisplayMode, workerGraphColumns, workerListSortMode, workerSortDirection, workerSortMode, workerStatus } from "../src/wallet.js";
import { formatPayoutThresholdInput, normalizePayoutThreshold, payoutFeeEstimate, payoutFeeText, payoutPolicyFromConfig, payoutThresholdFromAtomic, validatePayoutThreshold } from "../src/settings.js";
import { calcProfitRows, fiatForTimezone, formatFiat, hashrateFromInput, hashrateInputFromHashrate } from "../src/calc.js";
import { dismissMotd, normalizeMotd, resetMotdDismissalsForTest, shouldShowMotd } from "../src/motd.js";
import { blockPaymentStage, blockRoute, blocksView } from "../src/views/blocks.js";
import { walletRouteWithGraph, lastShareAgeSuffix, walletWorkersSection, workerList as walletWorkerList } from "../src/views/wallet.js";
import { chartHtml, normalizeGraph } from "../src/views/charts.js";
import { skel } from "../src/views/common.js";
import { referencePortSummary } from "../src/views/help.js";
import { homeView, walletTrackButtonLabel } from "../src/views/home.js";
import { poolDashboard } from "../src/views/pool-dashboard.js";
import { coinsView } from "../src/views/coins.js";
import { paymentsView, paymentRoute } from "../src/views/payments.js";
import { calcView } from "../src/views/calc.js";

const TEST_POLICY = payoutPolicyFromConfig({
  payout_policy: {
    minimumThreshold: 0.003,
    defaultThreshold: 0.3,
    denomination: 0.0001,
    feeFormula: { maxFee: 0.0004, zeroFeeThreshold: 4 }
  }
});

const TEST_PORTS = setupConfiguredPorts({
  configured: [
    { port: 10002, tlsPort: 20002, difficulty: 20_000, targetHashrate: 700, description: "Small CPU" },
    { port: 10008, tlsPort: 20008, difficulty: 80_000, targetHashrate: 2500, description: "Desktop CPU" },
    { port: 10016, tlsPort: 20016, difficulty: 160_000, targetHashrate: 5000, description: "Fast CPU" },
    { port: 18192, tlsPort: 28192, difficulty: 81_920_000, targetHashrate: 1_000_000, description: "Proxy/farm" }
  ]
});

function setupPlanWithPorts(options = {}) {
  return setupPlan({ ...options, ports: options.ports || TEST_PORTS });
}

function setupCommandWithPorts(options = {}) {
  return setupPlanWithPorts(options).plainRunCommand;
}

function assertPackageInstallFirst(command, label) {
  if (!/(?:sudo apt-get install|brew install)/.test(command)) return;
  assert.match(command, /^(?:sudo apt-get install|brew install)/, label);
}

function internalHrefs(html) {
  return [...String(html).matchAll(/\bhref="(#[^"]+)"/g)].map((match) => match[1]);
}

function assertInternalLinksResolve(html, label, { allowHome = false } = {}) {
  const hrefs = internalHrefs(html);
  assert.ok(hrefs.length > 0, `${label} should expose internal links`);
  for (const href of hrefs) {
    const route = parseRoute(href);
    if (!allowHome && href !== "#/") assert.notEqual(route.n, "home", `${label} generated unresolved route ${href}`);
    assert.equal(route.p.startsWith("#/"), true, `${label} route ${href} must have canonical hash`);
  }
}

async function withApiStubs(stubs, callback) {
  const originals = new Map();
  for (const [name, value] of Object.entries(stubs)) {
    originals.set(name, api[name]);
    api[name] = value;
  }
  try {
    return await callback();
  } finally {
    for (const [name, value] of originals) api[name] = value;
  }
}

const LINK_TEST_POOL = {
  miners: 4,
  hashRate: 220000,
  totalPayments: 42,
  totalBlocksFound: 3,
  pplnsWindowTime: 7200,
  currentEfforts: { 18081: 72, 9998: 125 },
  minBlockRewards: { 18081: 600000000000, 9998: 200000000 },
  coins: {
    18081: { port: 18081, symbol: "XMR", displayName: "XMR", algo: "rx/0", profit: 1, pplnsShare: 0.7, active: true, exchangeConfigured: true, hashrate: 200000, miners: 3, blockTime: 120, atomicUnits: 1000000000000 },
    9998: { port: 9998, symbol: "RTM", displayName: "Raptoreum", algo: "ghostrider", profit: 0.5, pplnsShare: 0.3, active: false, exchangeConfigured: false, disabledReason: "no exchange", hashrate: 20000, miners: 1, blockTime: 60, atomicUnits: 100000000, altBlocksFound: 2 }
  }
};

const LINK_TEST_NETWORK = {
  18081: { difficulty: 240000, time: 120, height: 3000 },
  9998: { difficulty: 120000, time: 60, height: 9000 }
};

test.describe("rendered views, links, charts, and coins", { concurrency: false }, () => {
  test("pool KPI help text is present when comments are enabled", () => {
    const pool = {
      miners: 4664,
      hashRate: 221_000_000,
      totalPayments: 95402,
      pplnsWindowTime: 4.14 * 3600,
      currentEfforts: { 18081: 18.04 },
      coins: {
        18081: { port: 18081, symbol: "XMR", displayName: "XMR", pplnsShare: 1, blockTime: 120 }
      }
    };
    const network = { 18081: { difficulty: 676_800_000_000, time: 120 } };
    const html = poolDashboard(pool, network, { tone: "green", detail: "Operational" });

    assert.equal([...html.matchAll(/<p class="explanation comments-controlled">/g)].length, 6);
    for (const label of ["Wallets", "Pool hashrate", "XMR world", "XMR last effort", "Payments made", "PPLNS window"]) {
      assert.match(html, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    for (const help of [
      "Connected pool wallets.",
      EXPLANATIONS.normalizedHashrate,
      "Network estimate for the current top coin.",
      EXPLANATIONS.luck,
      "Historical payout batches.",
      EXPLANATIONS.pplns
    ]) {
      assert.match(html, new RegExp(help.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  test("glyph skeleton loader renders accessible animated scan lines", () => {
    const html = skel("Loading dashboard");
    assert.match(html, /<div class=skeleton role=status aria-label="Loading dashboard">/);
    assert.match(html, /<span class=skeleton-text aria-hidden=true>/);
    assert.equal([...html.matchAll(/<span>[A-Z0-9]{2}\/[A-Z0-9]{4} :: [A-Z0-9]{6}-[A-Z0-9]{4} [A-Z0-9]{4}<\/span>/g)].length, 4);
    assert.doesNotMatch(html, /undefined|NaN/);
  });

  test("dashboard, table, pager, graph, and wallet controls emit resolvable internal links", async () => {
    const address = `4${"A".repeat(94)}`;
    await withApiStubs({
      poolStats: async () => ({ ...LINK_TEST_POOL, totalBlocksFound: 40, totalPayments: 40 }),
      networkStats: async () => LINK_TEST_NETWORK,
      blocks: async () => Array.from({ length: 15 }, (_, index) => ({ ts: 1700000000 - index, shares: 50 + index, diff: 100, value: 600000000000, height: 2990 - index, hash: `hash${index}` })),
      coinBlocks: async () => Array.from({ length: 15 }, (_, index) => ({ ts: 1700000000 - index, shares: 50 + index, diff: 100, value: 200000000, pay_value: 300000000000, height: 8980 - index, hash: `althash${index}` })),
      payments: async () => Array.from({ length: 15 }, (_, index) => ({ ts: 1700000000 - index, payees: 2, value: 100000000000, fee: 1000000000, hash: `tx${index}` }))
    }, async () => {
      assertInternalLinksResolve(poolDashboard(LINK_TEST_POOL, LINK_TEST_NETWORK, { tone: "green", detail: "Operational" }), "pool dashboard");

      state.r = { n: "coins", p: "#/coins?issues=1&inactive=0", q: { issues: "1", inactive: "0", sort: "name", dir: "asc" } };
      assertInternalLinksResolve(await coinsView(), "coins view");

      assertInternalLinksResolve(await blocksView({ n: "blocks", c: "XMR", q: { page: "1", limit: "15" } }), "blocks view");
      assertInternalLinksResolve(await paymentsView({ n: "payments", q: { page: "1", limit: "15" } }), "payments view");

      state.r = { n: "home", p: "#/?window=6h&mode=raw", q: { window: "6h", mode: "raw" } };
      state.w = [];
      state.c = new Map();
      assertInternalLinksResolve(await homeView(state.r), "home graph controls", { allowHome: true });

      const walletHtml = walletWorkersSection(address, [{ n: "rig", status: "Active", xmr: 10, raw: 20, ax: 10, ar: 20, l: 1000, vs: 1, is: 0, totalHashes: 100 }], {}, "12h", "xmr", "name", "asc", false, "list");
      assertInternalLinksResolve(walletHtml, "wallet worker controls");
    });
  });

  test("coin table sort controls cover every column and preserve filter state", async () => {
    await withApiStubs({
      poolStats: async () => LINK_TEST_POOL,
      networkStats: async () => LINK_TEST_NETWORK
    }, async () => {
      state.r = { n: "coins", p: "#/coins?issues=1&inactive=0&sort=name&dir=asc", q: { issues: "1", inactive: "0", sort: "name", dir: "asc" } };
      const html = await coinsView();
      const sortableHrefs = [...html.matchAll(/<a class="sortable" href="([^"]+)"/g)].map((match) => match[1]);
      assert.equal(sortableHrefs.length, 11);
      for (const key of ["name", "algo", "profit", "effort", "reward", "wallets", "pool", "world", "height", "pplns", "notes"]) {
        assert.ok(sortableHrefs.some((href) => href.includes(`sort=${key}`)), `missing sort link for ${key}`);
      }
      assert.ok(sortableHrefs.every((href) => href.includes("issues=1") && href.includes("inactive=0")), "sort links must preserve active filters");
      assert.ok(sortableHrefs.some((href) => href.includes("sort=name&dir=desc")), "active text column should toggle descending");
      assert.ok(sortableHrefs.some((href) => href.includes("sort=algo&dir=asc")), "inactive text column should default ascending");
      assert.ok(sortableHrefs.some((href) => href.includes("sort=profit&dir=desc")), "inactive numeric column should default descending");
      assert.match(html, /Coin ↑/);
    });
  });

  test("effort colors render consistently on coins and blocks pages", async () => {
    const pool = { ...LINK_TEST_POOL, totalBlocksFound: 40, currentEfforts: { 18081: 50, 9998: 150 } };
    const network = {
      18081: { ...LINK_TEST_NETWORK[18081], difficulty: 100 },
      9998: { ...LINK_TEST_NETWORK[9998], difficulty: 100 }
    };
    await withApiStubs({
      poolStats: async () => pool,
      networkStats: async () => network,
      blocks: async () => [
        { ts: 1700000000, shares: 50, diff: 100, value: 600000000000, height: 2990, hash: "lucky" },
        { ts: 1699999900, shares: 150, diff: 100, value: 600000000000, height: 2989, hash: "unlucky" }
      ],
      coinBlocks: async () => []
    }, async () => {
      state.r = { n: "coins", p: "#/coins?issues=1", q: { issues: "1", sort: "effort", dir: "asc" } };
      const coinsHtml = await coinsView();
      assert.match(coinsHtml, /<span class="green">50\.00%<\/span>/);
      assert.match(coinsHtml, /<span class=inactive-coin title="Coin is not active for mining"><span class="red">150\.00%<\/span><\/span>/);

      const blocksHtml = await blocksView({ n: "blocks", c: "XMR", q: { page: "1", limit: "15" } });
      assert.match(blocksHtml, /<span class="green" title="50 \/ 100">50\.00%<\/span>/);
      assert.match(blocksHtml, /<span class="red" title="150 \/ 100">150\.00%<\/span>/);
    });
  });

  test("top coin is selected by largest PPLNS share and effort uses that port", () => {
    const pool = {
      currentEfforts: { 10128: 82.5 },
      coins: {
        18081: { port: 18081, symbol: "XMR", displayName: "Monero", profit: 4, pplnsShare: 0.1, active: true, exchangeConfigured: false, blockTime: 120, atomicUnits: 1_000_000_000_000 },
        9998: { port: 9998, symbol: "RTM", displayName: "Raptoreum", profit: 8, pplnsShare: 0.7, active: false, exchangeConfigured: false, disabledReason: "no exchange configured", hashrate: 123, miners: 7, blockTime: 60, atomicUnits: 100_000_000, altBlocksFound: 3 },
        2086: { port: 2086, symbol: "BLOC", displayName: "Bloc", profit: 6, pplnsShare: 0.2, active: true, exchangeConfigured: true, altBlocksFound: 5 }
      },
      totalBlocksFound: 9
    };
    assert.equal(topCoinPort(pool), "9998");
    assert.equal(blockCoinPort(pool, "XMR"), "18081");
    assert.equal(blockCoinPort(pool, "RTM"), "9998");
    assert.equal(blockCoinPort(pool, "Raptoreum"), "");
    assert.equal(blockCoinPort(pool, ""), "9998");
    assert.equal(blockCoinPort(pool, "18081"), "");
    assert.equal(hasBlockHistory(pool, "18081"), true);
    assert.equal(hasBlockHistory(pool, "12345"), false);
    assert.equal(hasBlockHistory(pool, "9998"), true);
    assert.equal(currentEffort(pool, "10128"), 82.5);
    assert.equal(effortPercent(pool, { 10128: { difficulty: 165 } }, "10128"), 50);
    assert.equal(blockEffortPercent({ shares: 120, diff: 100 }), 120);
    assert.equal(averageBlockEffort([{ shares: 50, diff: 100 }, { shares: 150, diff: 100 }]), 100);
    assert.equal(effortTone(100), "green");
    assert.equal(effortTone(100.01), "red");
    assert.equal(worldHashrateForPort({ 18081: { difficulty: 240 } }, "18081", pool), 2);
    assert.equal(worldHashrateForPort({ 18081: { difficulty: 240 } }, "18081"), 0);
    assert.equal(coinHashScalar(pool, "9998"), 200);
    assert.equal(coinHashScalar({ coinProfit: { 18081: 8e-8, 8645: 1.4e-12 } }, "8645"), 0);
    assert.equal(coinName({}, "18144"), "18144");
    assert.equal(coinName({}, "12345"), "12345");
    assert.equal(coinName(pool, "18081"), "Monero");
    assert.equal(coinProfitValue(pool, "18081"), 4);
    assert.equal(coinAtomicUnits(pool, "9998"), 100_000_000);
    assert.equal(coinBlockCount(pool, "9998"), 3);
    assert.equal(coinBlockCount(pool, "18081"), 9);
    assert.equal(worldHashrateForPort({ difficulty: 6000 }, "9998", pool), 100);
    assert.deepEqual(coinStatsRows({ coinProfit: { 18081: 1 } }), []);
    assert.deepEqual(coinStatsRows(pool).find((coin) => coin.p === "9998"), {
      p: "9998",
      n: "Raptoreum",
      s: "RTM",
      a: "--",
      ac: false,
      c: "",
      dr: "no exchange configured",
      ec: false,
      h: 123,
      m: 7,
      ps: 0.7
    });
  });

  test("formatting handles hashrates and compact percentages", () => {
    assert.equal(formatHashrate(1520000), "1.52 MH/s");
    assert.equal(atomicXmr(736665259666), 0.736665259666);
    assert.equal(normalizeTimestampSeconds(1777348100000), 1777348100);
    assert.equal(formatTinyPercent(0.000001386, 2, 8), "0.00000139%");
    assert.equal(formatTinyPercent(0, 2, 8), "0.00%");
    assert.equal(formatAge(1000, (1000 + 370 * 24 * 60 * 60) * 1000), "1y ago");
  });

  test("graph windows and chart bounds handle visible points", () => {
    assert.equal(graphWindow("12h").seconds, 43200);
    assert.deepEqual(GRAPH_WINDOWS.map((win) => win[0]), ["6h", "12h", "24h", "all"]);
    assert.equal(GRAPH_WINDOWS.some((win) => win[0] === "all"), true);
    const points = [{ tme: 100, hsh2: 5 }, { tme: 220, hsh2: 0 }, { tme: 2000, hsh2: 4 }];
    assert.equal(filterWindow(points, "6h", 1901).length, 3);
    assert.equal(averageVisible(points, "hsh2"), 3);
    assert.match(svgLine(points, "hsh2", 700, 220, true), / C/);
    assert.notEqual(svgLine(points, "hsh2", 700, 220, true), svgLine(points, "hsh2"));
    assert.doesNotMatch(svgLine(points, "hsh2", 700, 220, true), /NaN|undefined/);
    assert.doesNotMatch(svgLine(points, "hsh2"), / C/);
    assert.equal(chartModel([{ tme: 1, hsh2: 90 }, { tme: 2, hsh2: 100 }], "hsh2").n, 90);
    assert.deepEqual(pplnsWindowRect({ s: 0, e: 100, w: 700, h: 220 }, 25), { x: 525, y: 0, width: 175, height: 220 });
    assert.deepEqual(pplnsWindowRect({ s: 0, e: 100, w: 700, h: 220 }, 200), { x: 0, y: 0, width: 700, height: 220 });
    assert.equal(isWithinPplnsWindow(75, 100, 25), true);
    assert.equal(isWithinPplnsWindow(74, 100, 25), false);
  });

  test("rendered hashrate chart includes raw, smoothed, hover, and PPLNS SVG layers", () => {
    state.p = 120;
    const rows = normalizeGraph([
      { time: 3000, hash2: 30 },
      { time: 1000, hash2: 10 },
      { time: 2000, hash2: 20 },
      { time: 0, hash2: 999 }
    ]);
    assert.deepEqual(rows.map((row) => row.tme), [1000, 2000, 3000]);
    const model = chartModel(rows, "hsh2");
    const html = chartHtml(model, svgLine(rows, "hsh2", 700, 220, true), svgLine(rows, "hsh2"), averageVisible(rows, "hsh2"), "Pool-wide hashrate chart");

    assert.match(html, /<svg class="chart-svg hashrate-chart"[^>]+role="img" aria-label="Pool-wide hashrate chart"/);
    assert.match(html, /<rect class="pplns-window" x="/);
    assert.match(html, /<path class="raw-line" d="M/);
    assert.match(html, /<path class="smoothed-line" d="M[^"]* C/);
    assert.match(html, /<line class="cursor-line cursor-vertical"/);
    assert.match(html, /<line class="cursor-line cursor-horizontal"/);
    assert.match(html, /data-chart-points="\[/);
    assert.doesNotMatch(html, /NaN|undefined/);
  });

  test("calculator explains the XMR fiat price source", async () => {
    await withApiStubs({
      poolStats: async () => ({ coins: { 18081: { port: 18081, symbol: "XMR", profit: 0.00000008 } }, price: { usd: 400 } })
    }, async () => {
      const html = await calcView({ n: "calc", p: "#/calc?rate=2&unit=kh", q: { rate: "2", unit: "kh" } });

      assert.match(html, /XMR USD price \$400\.00\./);
      assert.match(html, /Price comes from CoinMarketCap\./);
    });
  });

  test("wallet graph details are opt-in and stale share labels use common age text", () => {
    const address = `4${"A".repeat(94)}`;
    assert.doesNotMatch(walletRouteWithGraph(address, "overview", "12h", "xmr"), /stats=1/);
    assert.match(walletRouteWithGraph(address, "overview", "12h", "xmr", "h", "desc", true, 2), /stats=1/);
    assert.match(walletRouteWithGraph(address, "overview", "12h", "xmr", "h", "desc", false, 3), /view=3/);
    assert.match(walletRouteWithGraph(address, "overview", "12h", "xmr", "h", "desc", false, 5), /view=5/);
    assert.match(walletRouteWithGraph(address, "overview", "12h", "xmr", "h", "desc", false, "list"), /view=list&sort=name&dir=asc/);
    assert.match(walletRouteWithGraph(address, "overview", "12h", "xmr", "h", "desc", false, "list", false), /dead=0/);
    assert.equal(workerGraphColumns("", 500), 1);
    assert.equal(workerGraphColumns("", 900), 2);
    assert.equal(workerGraphColumns("", 1400), 2);
    assert.equal(workerGraphColumns(3, 1400), 3);
    assert.equal(workerGraphColumns(4, 1400), 4);
    assert.equal(workerGraphColumns(5, 1400), 5);
    assert.equal(workerGraphColumns(6, 1400), 2);
    assert.equal(workerDisplayMode("list"), "list");

    const workers = walletWorkerList({
      alpha: { hash2: 50, lastHash: 1000, totalHash: 1234, validShares: 7, invalidShares: 2, lastShareAlgo: "rx/0" },
      beta: { stats: [{ hsh2: 10, lts: 2000, totalHashes: 400, valid: 3, invalid: 1 }] }
    });
    assert.deepEqual(workers.map((worker) => worker.n), ["alpha", "beta"]);
    assert.equal(workers[0].totalHashes, 1234);
    assert.equal(workers[0].la, "rx/0");
    assert.equal(workers[0].vs, 7);
    assert.equal(workers[0].is, 2);
    assert.equal(lastShareAgeSuffix(1000, (1000 + 180) * 1000), "");
    assert.match(lastShareAgeSuffix({ lastHash: 1000 }, (1000 + 240) * 1000), /title="[^"]+">\((4m ago)\)<\/span>/);
    assert.match(chartHtml(chartModel([{ tme: 1, hsh2: 10 }], "hsh2"), "", "", 10, "test", ["Total hashes 1", "Valid shares 2", "Invalid shares 3"]), /<small>Total hashes 1<\/small><small>Valid shares 2<\/small><small>Invalid shares 3<\/small>/);
  });
});
