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
import { endpointKey } from "../src/api.js";
import { clearPreferenceStorage, parseCookieValue, readPreferences, saveExplanations, saveTheme, toggleExplanations, toggleTheme } from "../src/preferences.js";
import { summarizeUptimeRobot } from "../src/uptime.js";
import { blockPageSize, MAX_ROUTE_PAGE, pageCountFor, routePageNumber } from "../src/paging.js";
import { nextSortDirection, nextSortDirectionForKey, sortDirection, sortRows } from "../src/table-sort.js";
import { compactWorkerRows, sortWorkerListRows, sortWorkerRows, trackWalletState, workerDisplayMode, workerGraphColumns, workerListSortMode, workerSortDirection, workerSortMode, workerStatus } from "../src/wallet.js";
import { formatPayoutThresholdInput, normalizePayoutThreshold, payoutFeeEstimate, payoutFeeText, payoutPolicyFromConfig, payoutThresholdFromAtomic, validatePayoutThreshold } from "../src/settings.js";
import { calcProfitRows, fiatForTimezone, formatFiat, hashrateFromInput, hashrateInputFromHashrate } from "../src/calc.js";
import { dismissMotd, normalizeMotd, resetMotdDismissalsForTest, shouldShowMotd } from "../src/motd.js";
import { blockPaymentStage } from "../src/views/blocks.js";
import { walletRouteWithGraph, lastShareAgeSuffix, walletWorkersSection, workerList as walletWorkerList } from "../src/views/wallet.js";
import { chartHtml } from "../src/views/charts.js";
import { referencePortSummary } from "../src/views/help.js";
import { walletTrackButtonLabel } from "../src/views/home.js";

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
  return setupPlanWithPorts(options).r;
}

function assertPackageInstallFirst(command, label) {
  if (!/(?:sudo apt-get install|brew install)/.test(command)) return;
  assert.match(command, /^(?:sudo apt-get install|brew install)/, label);
}

test("route parsing supports expected hash routes", () => {
  assert.deepEqual(parseRoute("#/coins").n, "coins");
  assert.equal(parseRoute("#/blocks/XMR").c, undefined);
  assert.equal(parseRoute("#/blocks/18081").c, "18081");
  assert.equal(parseRoute("#/blocks/12345").c, "12345");
  assert.equal(routeCoinId("18081"), "18081");
  assert.equal(parseRoute("#/payments?p=3").q.p, "3");
  assert.equal(parseRoute("#/calc?h=5&u=mh").n, "calc");
  assert.equal(parseRoute("#/calc?h=5&u=mh").q.u, "mh");
  assert.equal(parseRoute("#/setup?o=windows&p=srb-gpu").q.p, "srb-gpu");
  assert.equal(parseRoute("#/coins?i=1").q.i, "1");
  assert.equal(parseRoute("#/account/abc/payments").n, "home");
  assert.equal(parseRoute("#/wallet/abc").n, "wallet");
  assert.equal(parseRoute("#/wallet/abc").t, "overview");
  assert.equal(parseRoute("#/wallet/abc/payments").n, "home");
  assert.equal(parseRoute("#/wallet/abc/settings").n, "home");
  assert.equal(parseRoute("#/wallet/abc/withdrawals").t, "withdrawals");
  assert.equal(parseRoute("#/wallet/abc/block-rewards").t, "block-rewards");
  assert.equal(parseRoute("#/wallet/abc/payment-threshold").t, "payment-threshold");
  assert.equal(parseRoute("#/wallet/abc/email-alerts").t, "email-alerts");
});

test("profit calc uses XMR coinProfit, hashrate units, and timezone fiat", () => {
  const pool = { coins: { 18081: { port: 18081, symbol: "XMR", profit: 0.00000008 } }, price: { usd: 400, eur: 350 } };
  assert.equal(hashrateFromInput("2.5", "kh"), 2500);
  assert.equal(hashrateFromInput("1", "mh"), 1000000);
  assert.deepEqual(hashrateInputFromHashrate(443000), { value: "443", unit: "kh" });
  assert.deepEqual(hashrateInputFromHashrate(1250000), { value: "1.25", unit: "mh" });
  assert.deepEqual(hashrateInputFromHashrate(875), { value: "875", unit: "h" });
  assert.deepEqual(hashrateInputFromHashrate(0), { value: "1", unit: "kh" });
  assert.deepEqual(fiatForTimezone("Europe/Berlin"), { code: "eur", label: "EUR" });
  assert.deepEqual(fiatForTimezone("America/New_York"), { code: "usd", label: "USD" });
  const rows = calcProfitRows("2", "kh", pool, "America/New_York");
  assert.equal(rows[0].xmr, 0.00016);
  assert.equal(Number(rows[1].xmr.toFixed(8)), 0.00112);
  assert.equal(rows[0].fiat, 0.064);
  assert.equal(rows[0].fc, "USD");
  assert.equal(formatFiat(0.064, "USD"), "$0.064");
});

test("block paging clamps page number and page size choices", () => {
  assert.equal(MAX_ROUTE_PAGE, 999);
  assert.equal(routePageNumber("3"), 3);
  assert.equal(routePageNumber("-1"), 1);
  assert.equal(routePageNumber("999999"), MAX_ROUTE_PAGE);
  assert.equal(blockPageSize("50"), 50);
  assert.equal(blockPageSize("100"), 100);
  assert.equal(blockPageSize("25"), 15);
  assert.equal(pageCountFor(101, 50), 3);
  assert.equal(pageCountFor(999999, 15), MAX_ROUTE_PAGE);
  assert.equal(pageCountFor(0, 50), 1);
  assert.equal(pageCountFor(undefined, 50), 1);
});

test("table sort toggles direction and sorts numeric or text values", () => {
  const rows = [{ name: "b", value: 2 }, { name: "a", value: 10 }];
  assert.equal(sortDirection("bad"), "desc");
  assert.equal(nextSortDirection("value", "desc", "value"), "asc");
  assert.equal(nextSortDirectionForKey("pplns", "desc", "name", { name: "asc" }), "asc");
  assert.equal(nextSortDirectionForKey("pplns", "desc", "notes", { name: "asc", algo: "asc", notes: "asc" }), "asc");
  assert.equal(nextSortDirectionForKey("name", "asc", "name", { name: "asc" }), "desc");
  assert.deepEqual(sortRows(rows, "value", "asc").map((row) => row.name), ["b", "a"]);
  assert.deepEqual(sortRows(rows, "name", "desc").map((row) => row.name), ["b", "a"]);
  assert.deepEqual(sortRows([{ name: "low", pplns: 0.1 }, { name: "high", pplns: 12 }], "pplns").map((row) => row.name), ["high", "low"]);
});

test("XMR validation accepts primary and integrated address lengths", () => {
  assert.equal(isXmrAddress(`4${"A".repeat(94)}`), true);
  assert.equal(isXmrAddress(`8${"B".repeat(105)}`), true);
  assert.equal(isXmrAddress("not-an-address"), false);
});

test("local history consent prompt targets EU and UK while denial blocks persistence", () => {
  const store = new Map();
  const previousDocument = global.document;
  const cookieWrites = [];
  global.document = {
    get cookie() {
      return "";
    },
    set cookie(value) {
      cookieWrites.push(value);
    }
  };
  global.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key)
  };
  try {
    const address = `4${"C".repeat(94)}`;

    assert.equal(shouldAskConsent("de-DE", "Europe/Berlin"), true);
    assert.equal(shouldAskConsent("en-GB", "Europe/London"), true);
    assert.equal(shouldAskConsent("en-US", "America/New_York"), false);
    assert.equal(localHistoryEnabled(), true);
    store.set("mo.accounts.v1", JSON.stringify([{ address, time: Date.now() }]));
    appendWallet(address);
    saveTheme("light");
    saveExplanations("off");
    store.set("mo.motd.dismissed.v1", "old-motd-key");
    assert.equal(store.has("mo.accounts.v1"), false);
    assert.deepEqual(loadWatchlist().map((row) => row.address), [address]);

    assert.equal(setConsent(false), false);
    assert.equal(shouldAskConsent("en-US", "America/New_York"), false);
    assert.equal(localHistoryEnabled(), false);
    assert.deepEqual(loadWatchlist(), []);
    assert.equal(store.has("mo.wallets.v1"), false);
    assert.equal(store.has("mo.accounts.v1"), false);
    assert.equal(store.has("mo.motd.dismissed.v1"), false);
    assert.match(cookieWrites.at(-2), /^mo\.theme=; Max-Age=0;/);
    assert.match(cookieWrites.at(-1), /^mo\.explain=; Max-Age=0;/);

    const writeCount = cookieWrites.length;
    assert.equal(saveTheme("dark", { persist: localHistoryEnabled() }), "dark");
    assert.equal(saveExplanations("on", { persist: localHistoryEnabled() }), "on");
    assert.equal(cookieWrites.length, writeCount);

    assert.deepEqual(appendWallet(address).map((row) => row.address), [address]);
    assert.equal(store.has("mo.wallets.v1"), false);

    assert.equal(setConsent(true), true);
    assert.equal(shouldAskConsent("en-US", "America/New_York"), false);
    assert.equal(localHistoryEnabled(), true);
    assert.equal(walletTrackButtonLabel(), "Track wallet");
    assert.deepEqual(appendWallet(address).map((row) => row.address), [address]);
    assert.equal(store.has("mo.wallets.v1"), true);

    assert.equal(setConsent(false), false);
    assert.equal(walletTrackButtonLabel(), "Temporary track wallet");
  } finally {
    if (previousDocument === undefined) delete global.document;
    else global.document = previousDocument;
  }
});

test("pool MOTD dismissal lasts until the message changes", () => {
  const store = new Map();
  global.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key)
  };
  resetMotdDismissalsForTest();
  const motd = normalizeMotd({ created: "1760280721", subject: "Current status", body: "Exchange migration is underway." });
  const updated = normalizeMotd({ created: "1760280722", subject: "Current status", body: "Exchange migration is underway." });

  assert.deepEqual(normalizeMotd({ subject: "Empty", body: "" }), null);
  assert.equal(motd.subject, "Current status");
  assert.equal(shouldShowMotd(motd), true);
  dismissMotd(motd.key);
  assert.equal(shouldShowMotd(motd), false);
  assert.equal(shouldShowMotd(updated), true);

  resetMotdDismissalsForTest();
  assert.equal(shouldShowMotd(motd, { persist: false }), true);
  dismissMotd(motd.key, { persist: false });
  assert.equal(store.has("mo.motd.dismissed.v1"), false);
  assert.equal(shouldShowMotd(motd, { persist: false }), false);
  assert.equal(shouldShowMotd(updated, { persist: false }), true);
});

test("display preferences read cookies and toggle theme/comments", () => {
  const cookie = "mo.theme=light; mo.explain=off";
  assert.equal(parseCookieValue(cookie, "mo.theme"), "light");
  assert.deepEqual(readPreferences(cookie), { theme: "light", explanations: "off" });
  assert.equal(toggleTheme("light"), "dark");
  assert.equal(toggleExplanations("off"), "on");
  clearPreferenceStorage();
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
  assert.equal(blockCoinPort(pool, "18081"), "18081");
  assert.equal(blockCoinPort(pool, ""), "9998");
  assert.equal(blockCoinPort(pool, "10128"), "10128");
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

test("wallet graph details are opt-in and stale share labels use common age text", () => {
  const address = `4${"A".repeat(94)}`;
  assert.doesNotMatch(walletRouteWithGraph(address, "overview", "12h", "normalized"), /x=1/);
  assert.match(walletRouteWithGraph(address, "overview", "12h", "normalized", "h", "desc", true, 2), /x=1/);
  assert.match(walletRouteWithGraph(address, "overview", "12h", "normalized", "h", "desc", false, 3), /c=3/);
  assert.match(walletRouteWithGraph(address, "overview", "12h", "normalized", "h", "desc", false, "list"), /c=list&s=name&d=asc/);
  assert.match(walletRouteWithGraph(address, "overview", "12h", "normalized", "h", "desc", false, "list", false), /e=0/);
  assert.equal(workerGraphColumns("", 500), 1);
  assert.equal(workerGraphColumns("", 900), 2);
  assert.equal(workerGraphColumns("", 1400), 2);
  assert.equal(workerGraphColumns(3, 1400), 3);
  assert.equal(workerDisplayMode("list"), "list");

  const workers = walletWorkerList({
    alpha: { hash2: 50, lastHash: 1000, totalHash: 1234, validShares: 7, invalidShares: 2 },
    beta: { stats: [{ hsh2: 10, lts: 2000, totalHashes: 400, valid: 3, invalid: 1 }] }
  });
  assert.deepEqual(workers.map((worker) => worker.n), ["alpha", "beta"]);
  assert.equal(workers[0].th, 1234);
  assert.equal(workers[0].vs, 7);
  assert.equal(workers[0].is, 2);
  assert.equal(lastShareAgeSuffix(1000, (1000 + 180) * 1000), "");
  assert.match(lastShareAgeSuffix({ lastHash: 1000 }, (1000 + 240) * 1000), /title="[^"]+">\((4m ago)\)<\/span>/);
  assert.match(chartHtml(chartModel([{ tme: 1, hsh2: 10 }], "hsh2"), "", "", 10, "test", ["Total hashes 1", "Valid shares 2", "Invalid shares 3"]), /<small>Total hashes 1<\/small><small>Valid shares 2<\/small><small>Invalid shares 3<\/small>/);
});

test("worker list model unions current stats and charts with active stale dead status", () => {
  const now = 10_000_000;
  assert.equal(workerStatus(true, 1, 9400, now), "Active");
  assert.equal(workerStatus(true, 1, 9399, now), "Stale");
  assert.equal(workerStatus(false, 1, 9990, now), "Dead");
  assert.equal(workerStatus(true, 0, 9990, now), "Dead");

  const workers = compactWorkerRows({
    active: { hsh2: 20, hsh: 200, lastHash: 9700, totalHash: 1000, validShares: 5, invalidShares: 1 },
    stale: { hsh2: 40, hsh: 400, lastHash: 9300, totalHashes: 2000, valid: 8, invalid: 2 },
    dead: { hsh2: 0, hsh: 0, lastHash: 9950, hashes: 3000, valid: 1, invalid: 3 },
    global: { hsh2: 999 }
  }, {
    active: [{ tme: 9990, hsh2: 10, hsh: 100 }, { tme: 9980, hsh2: 30, hsh: 300 }],
    chartOnly: [{ tme: 9800, hsh2: 15, hsh: 150 }]
  }, now);

  assert.deepEqual(workers.map((worker) => worker.n), ["stale", "active", "chartOnly", "dead"]);
  const byName = Object.fromEntries(workers.map((worker) => [worker.n, worker]));
  assert.equal(byName.active.l, 9990);
  assert.equal(byName.active.st, "Active");
  assert.equal(byName.active.ax, 20);
  assert.equal(byName.stale.st, "Stale");
  assert.equal(byName.dead.st, "Dead");
  assert.equal(byName.chartOnly.st, "Dead");
  assert.equal(byName.chartOnly.l, 9800);
});

test("worker list sorting defaults to name and supports list columns", () => {
  const workers = [
    { n: "active", st: "Active", xmr: 20, raw: 200, ax: 20, ar: 200, l: 9990, vs: 5, is: 1, th: 1000 },
    { n: "stale", st: "Stale", xmr: 40, raw: 400, ax: 0, ar: 0, l: 9300, vs: 8, is: 2, th: 2000 },
    { n: "dead", st: "Dead", xmr: 0, raw: 0, ax: 0, ar: 0, l: 9950, vs: 1, is: 3, th: 3000 },
    { n: "chartOnly", st: "Dead", xmr: 0, raw: 0, ax: 15, ar: 150, l: 9800, vs: 0, is: 0, th: 0 }
  ];

  assert.equal(workerListSortMode("bad"), "name");
  assert.equal(workerListSortMode("status"), "name");
  assert.deepEqual(sortWorkerListRows(workers).map((worker) => worker.n), ["active", "chartOnly", "dead", "stale"]);
  assert.deepEqual(sortWorkerListRows(workers, "name", "asc").map((worker) => worker.n), ["active", "chartOnly", "dead", "stale"]);
  assert.equal(sortWorkerListRows(workers, "xmr")[0].n, "stale");
  assert.equal(sortWorkerListRows(workers, "raw")[0].n, "stale");
  assert.equal(sortWorkerListRows(workers, "avg")[0].n, "active");
  assert.equal(sortWorkerListRows(workers, "avgraw")[0].n, "active");
  assert.equal(sortWorkerListRows(workers, "last")[0].n, "active");
  assert.equal(sortWorkerListRows(workers, "valid")[0].n, "stale");
  assert.equal(sortWorkerListRows(workers, "invalid")[0].n, "dead");
  assert.equal(sortWorkerListRows(workers, "hashes")[0].n, "dead");
});

test("worker list omits status column and renders red stale and dead rows", () => {
  const address = `4${"A".repeat(94)}`;
  const workers = compactWorkerRows({
    active: { hsh2: 20, hsh: 200, lastHash: 9990 },
    stale: { hsh2: 40, hsh: 400, lastHash: 9300 },
    dead: { hsh2: 0, hsh: 0, lastHash: 9950 }
  }, {
    chartOnly: [{ tme: 9800, hsh2: 15, hsh: 150 }]
  }, 10_000_000);
  const html = walletWorkersSection(address, workers, {}, "12h", "normalized", "status", "desc", false, "list");

  for (const key of ["name", "xmr", "raw", "avg", "avgraw", "last", "valid", "invalid", "hashes"]) {
    assert.match(html, new RegExp(`s=${key}`));
  }
  assert.doesNotMatch(html, /s=status/);
  assert.doesNotMatch(html, />Status</);
  assert.doesNotMatch(html, /<span class=red>Stale<\/span>/);
  assert.doesNotMatch(html, /<span class=red>Dead<\/span>/);
  assert.match(html, /<span class=red>stale<\/span>/);
  assert.match(html, /<span class=red>dead<\/span>/);
  assert.match(html, /aria-current=page>Dead<\/a><a class=cp href="[^"]*c=list[^"]*" aria-current=page>List<\/a>/);
  assert.match(html, /c=list/);

  const hiddenHtml = walletWorkersSection(address, workers, {}, "12h", "normalized", "name", "asc", false, "list", false);
  assert.match(hiddenHtml, />Dead<\/a><a class=cp href="[^"]*c=list[^"]*" aria-current=page>List<\/a>/);
  assert.match(hiddenHtml, /<span class=red>stale<\/span>/);
  assert.doesNotMatch(hiddenHtml, /<span class=red>dead<\/span>/);
  assert.doesNotMatch(hiddenHtml, /<span class=red>chartOnly<\/span>/);
  assert.match(hiddenHtml, /e=0/);
});

test("worker graph modes mark stale and dead worker names red", () => {
  const address = `4${"A".repeat(94)}`;
  const workers = compactWorkerRows({
    active: { hsh2: 20, hsh: 200, lastHash: 9990 },
    stale: { hsh2: 40, hsh: 400, lastHash: 9300 },
    dead: { hsh2: 0, hsh: 0, lastHash: 9950 }
  }, {
    active: [{ tme: 9990, hsh2: 20 }],
    stale: [{ tme: 9300, hsh2: 40 }],
    dead: [{ tme: 9950, hsh2: 0 }],
    chartOnly: [{ tme: 9800, hsh2: 15 }]
  }, 10_000_000);
  const charts = {
    active: [{ tme: 9990, hsh2: 20 }],
    stale: [{ tme: 9300, hsh2: 40 }],
    dead: [{ tme: 9950, hsh2: 0 }],
    chartOnly: [{ tme: 9800, hsh2: 15 }]
  };
  const html = walletWorkersSection(address, workers, charts, "12h", "normalized", "h", "desc", false, 2);

  assert.doesNotMatch(html, /Dead\/stale:/);
  assert.match(html, /<h3>active/);
  assert.match(html, /<h3><span class=red title="Stale">stale<\/span>/);
  assert.match(html, /<h3><span class=red title="Dead">dead<\/span>/);
  assert.match(html, /<h3><span class=red title="Dead">chartOnly<\/span>/);
  assert.match(html, /<div class="wch red"><h3><span class=red title="Dead">chartOnly<\/span> <span class=lsa/);
  assert.match(html, /<div class="wch red"><h3><span class=red title="Dead">dead<\/span> <span class=lsa/);
  assert.match(html, /<span class=red title="Dead">0 H\/s<\/span>/);

  const hiddenHtml = walletWorkersSection(address, workers, charts, "12h", "normalized", "h", "desc", false, 2, false);
  assert.match(hiddenHtml, /<h3><span class=red title="Stale">stale<\/span>/);
  assert.doesNotMatch(hiddenHtml, /<h3><span class=red title="Dead">dead<\/span>/);
  assert.doesNotMatch(hiddenHtml, /<h3><span class=red title="Dead">chartOnly<\/span>/);
  assert.match(hiddenHtml, /e=0/);
});

test("block payout stage keeps unlock and pay-stage detail", () => {
  const pool = { coins: { 18081: { blockTime: 120 } } };
  assert.equal(blockPaymentStage({ height: 1000 }, "18081", pool, { 18081: { height: 1015 } }), "30 Mins Left");
  assert.equal(blockPaymentStage({ height: 1000 }, "18081", pool, { 18081: { height: 1035 } }), "Soon");
  assert.equal(blockPaymentStage({ height: 1000 }, "18081", pool, { 18081: { height: 1050 } }), "Delayed");
  assert.equal(blockPaymentStage({ pay_stage: "Pay stage" }, "9998", pool, {}), "Pay stage");
  assert.equal(blockPaymentStage({ payStatus: "Backend stage" }, "18081", pool, {}), "Backend stage");
});

test("refresh scheduler dedupes timing state and can tick manually", async () => {
  let ticks = 0;
  const scheduler = new RefreshScheduler({ interval: 10, jitter: 0, onTick: async () => { ticks += 1; } });
  await scheduler.tick(true);
  scheduler.stop();
  assert.equal(ticks, 1);
});

test("setup output and ports mapping include required miners and ports", () => {
  assert.equal(COIN_EXPLORERS[18081], "https://xmrchain.net");
  assert.equal(COIN_HEIGHT_EXPLORERS[18081].replace("{height}", "123"), "https://xmrchain.net/block/123");
  assert.equal(COIN_HEIGHT_EXPLORERS[12211].replace("{height}", "1142193"), "https://explorer.ryo.tools/search?value=1142193");
  assert.equal(COIN_HEIGHT_EXPLORERS[8766].replace("{height}", "4343926"), "https://ravencoin.atomicwallet.io/block/4343926");
  assert.equal(COIN_HEIGHT_EXPLORERS[8645].replace("{height}", "24458492"), "https://etc.blockscout.com/block/24458492");
  assert.equal(COIN_HEIGHT_EXPLORERS[17767].replace("{height}", "764069"), "https://explorer.zephyrprotocol.com/block/764069");
  for (const brokenPort of [10225, 17750, 19281, 19734, 19950, 25182, 38081, 48782]) {
    assert.equal(COIN_HEIGHT_EXPLORERS[brokenPort], undefined);
  }
  assert.equal(`${BLOCK_SHARE_DUMP_BASE}/abc.cvs.xz`, "https://block-share-dumps.moneroocean.stream/abc.cvs.xz");
  assert.equal(DONATION_XMR, "89TxfrUmqJJcb1V124WsUzA78Xa3UYHt7Bg8RGMhXVeZYPN8cE5CZEk58Y1m23ZMLHN7wYeJ9da5n5MXharEjrm41hSnWHL");
  assert.match(setupCommandWithPorts({ profile: "xmrig-mo", address: "ADDR", worker: "rig" }), /xmrig/);
  assert.doesNotMatch(setupCommandWithPorts({ profile: "xmrig-mo", address: "ADDR", worker: "rig" }), /--coin monero/);
  assert.doesNotMatch(setupCommandWithPorts({ profile: "xmrig-mo", address: "ADDR", worker: "rig" }), / -p rig\b/);
  assert.match(setupPlanWithPorts({ profile: "xmrig-mo", address: "ADDR", worker: "rig" }).rt, /gulf\.moneroocean\.stream:20016 .*--tls/);
  assert.match(setupPlanWithPorts({ profile: "xmrig-mo" }).rtn, /TLS encrypts/);
  assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "linux", address: "ADDR", worker: "rig" }).to, /sudo apt-get install tor && sudo systemctl enable --now tor/);
  assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "macos", address: "ADDR", worker: "rig" }).to, /brew install tor && brew services start tor/);
  assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "linux" }).ton, /onion host.*selected non-TLS setup port.*127\.0\.0\.1:9050.*127\.0\.0\.1:9150.*TLS does not improve security over Tor/);
  assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "linux", address: "ADDR", worker: "rig" }).to, /\.\/xmrig -o mo2tor2amawhphlrgyaqlrqx7o27jaj7yldnx3t6jip3ow4bujlwz6id\.onion:10016 .* -u ADDR --rig-id rig --keepalive/);
  assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "macos", address: "ADDR", worker: "rig" }).to, /\.\/xmrig -o mo2tor2amawhphlrgyaqlrqx7o27jaj7yldnx3t6jip3ow4bujlwz6id\.onion:10016 .* -u ADDR --rig-id rig --keepalive/);
  assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-mo", os: "linux" }).to, /--coin monero| -p tor|YOUR_XMR_WALLET|9150|do not add --tls|First run may benchmark|ss -ltn|Use 127\.0\.0\.1:9050|:20128|--tls/);
  assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "linux" }).nt, /first run may benchmark for several minutes before pool jobs appear/);
  assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "linux" }).d, /sudo apt-get install curl/);
  assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "linux" }).d, /tar xf xmrig\.tar\.gz && chmod \+x xmrig/);
  assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-mo", os: "linux" }).d, /strip-components/);
  assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "windows" }).dn, /Open Windows PowerShell first/);
  assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-mo", os: "windows" }).d, /Open Windows PowerShell first/);
  assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-mo", os: "windows" }).r, /Open Windows PowerShell first|\.\\xmrig\.exe/);
  assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "windows" }).r, /^xmrig\.exe/m);
  assert.doesNotMatch(setupPlanWithPorts({ profile: "meta-miner", os: "windows" }).r || "", /Open Windows PowerShell first/);
  assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "macos" }).d, /grep 'mac64\\\.tar\\\.gz'/);
  assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-mo", os: "macos" }).d, /mac-intel|\$asset|uname -m/);
  assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-mo", os: "macos" }).d, /macOS release assets are currently arm64 only/);
  assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "macos" }).d, /xattr -d com\.apple\.quarantine xmrig/);
  assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "macos" }).dn, /MoneroOcean XMRig macOS release assets are currently arm64 only.*build XMRig from source on Intel macOS/);
  assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "macos" }).nt, /Intel macOS is not supported/);
  assert.equal(setupPlanWithPorts({ profile: "srb-gpu", os: "macos" }).s.pr, "xmrig-mo");
  assert.equal(setupPlanWithPorts({ profile: "xmr-node-proxy", os: "windows" }).s.pr, "xmrig-mo");
  assert.equal(setupPlanWithPorts({ profile: "xmrig-fixed", algo: "etchash" }).s.pr, "xmrig-mo");
  assert.equal(setupPlanWithPorts({ profile: "xmrig-fixed", algo: "etchash" }).s.al, "auto");
  assert.equal(setupHashrateToHps(4, "kh"), 4000);
  const configuredPorts = setupConfiguredPorts({
    configured: [
      { port: null, tlsPort: 9000, difficulty: 1000, targetHashrate: 1000 / 30, description: "TLS only" },
      { port: 10002, tlsPort: 20002, difficulty: 20_000, targetHashrate: 700, description: "Small CPU" },
      { port: 10016, tlsPort: 20016, difficulty: 160_000, targetHashrate: 5000, description: "Fast CPU" }
    ]
  });
  assert.deepEqual(configuredPorts.map((row) => row[0]), [10002, 10016]);
  assert.equal(setupPlan({ profile: "xmrig-mo", hashrate: 4, hashrateUnit: "kh", ports: configuredPorts }).s.p, 10016);
  assert.match(setupPlan({ profile: "xmrig-mo", hashrate: 4, hashrateUnit: "kh", ports: configuredPorts }).sm, /Fast CPU/);
  assert.equal(setupPlan().s.p, 0);
  assert.equal(setupPlanWithPorts({ profile: "xmrig-mo" }).s.p, 10016);
  assert.equal(setupPlanWithPorts({ profile: "srb-gpu", os: "windows", address: "ADDR" }).s.a, "ADDR");
  assert.equal(setupPlanWithPorts({ profile: "xmrig-mo", hashrate: 250, hashrateUnit: "h" }).s.p, 10002);
  assert.equal(setupPlanWithPorts({ profile: "xmrig-proxy" }).s.p, 18192);
  assert.deepEqual(setupHashrateDefaults("xmrig-proxy"), { value: 64, unit: "kh" });
  assert.deepEqual(setupHashrateDefaults("xmr-node-proxy"), { value: 128, unit: "kh" });
  assert.deepEqual(setupHashrateDefaults("srb-gpu", "intel"), { value: 128, unit: "kh" });
  assert.match(setupPlanWithPorts({ profile: "srb-gpu", gpu: "intel", algo: "cn/gpu" }).r, /--algorithm cryptonight_gpu/);
  assert.match(setupPlanWithPorts({ profile: "srb-gpu", gpu: "intel", algo: "cn/gpu" }).rt, /--pool gulf\.moneroocean\.stream:28192 .*--tls true/);
  assert.match(setupPlanWithPorts({ profile: "srb-gpu", gpu: "intel", algo: "cn/gpu" }).rtn, /Use --list-devices first/);
  assert.doesNotMatch(setupPlanWithPorts({ profile: "srb-gpu", gpu: "intel", algo: "cn/gpu" }).nt, /Use --list-devices first/);
  assert.match(setupPlanWithPorts({ profile: "srb-gpu", gpu: "intel", algo: "etchash" }).r, /--esm 2 --nicehash true/);
  assert.match(setupPlanWithPorts({ profile: "srb-gpu", gpu: "amd", algo: "kawpow" }).r, /--disable-gpu-nvidia --disable-gpu-intel/);
  assert.doesNotMatch(setupPlanWithPorts({ profile: "meta-miner", gpu: "nvidia" }).rt, /mm\.json/);
  assert.match(setupPlanWithPorts({ profile: "meta-miner", gpu: "nvidia" }).d, /sudo apt-get install nodejs curl/);
  assert.match(setupPlanWithPorts({ profile: "meta-miner", gpu: "nvidia" }).rt, /--no-config-save/);
  assert.match(setupPlanWithPorts({ profile: "meta-miner", gpu: "nvidia" }).rt, /--pool="\$POOL"/);
  assert.match(setupPlanWithPorts({ profile: "meta-miner", gpu: "nvidia" }).rt, /POOL='gulf\.moneroocean\.stream:ssl28192'/);
  assert.match(setupPlanWithPorts({ profile: "meta-miner", gpu: "nvidia" }).rt, /--algo_min_time=60/);
  assert.doesNotMatch(setupPlanWithPorts({ profile: "meta-miner", gpu: "nvidia" }).rt, /--watchdog=600/);
  assert.match(setupPlanWithPorts({ profile: "meta-miner", gpu: "nvidia" }).nt, /First run benchmarks\/autotunes configured algorithms/);
  assert.match(setupPlanWithPorts({ profile: "meta-miner", gpu: "nvidia" }).rt, /WALLET=/);
  assert.match(setupPlanWithPorts({ profile: "meta-miner", gpu: "nvidia" }).rt, /COMMON="\$SRB --disable-cpu \$GPU_FLAGS/);
  assert.match(setupPlanWithPorts({ profile: "meta-miner", gpu: "nvidia" }).rt, /--kawpow="\$COMMON --algorithm kawpow --password \$WORKER~kawpow"/);
  assert.match(setupPlanWithPorts({ profile: "meta-miner", os: "windows", gpu: "amd" }).rt, /\$Common="\$Srb --disable-cpu \$GpuFlags/);
  assert.match(setupPlanWithPorts({ profile: "xmrig-proxy" }).rt, /xmrig-proxy/);
  assert.match(setupPlanWithPorts({ profile: "xmrig-proxy" }).rt, /--bind 0\.0\.0\.0:3333/);
  assert.match(setupPlanWithPorts({ profile: "xmrig-proxy" }).rt, /--mode nicehash/);
  assert.match(setupPlanWithPorts({ profile: "xmrig-proxy" }).rt, /gulf\.moneroocean\.stream:28192 .*--tls/);
  assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-proxy", worker: "rig" }).rt, / -p rig\b/);
  assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-proxy", worker: "rig" }).l, / -p x\b/);
  assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-proxy" }).rt, /--coin monero/);
  assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-proxy" }).rt, /--donate-level 1/);
  assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-proxy" }).rt, /config\.json/);
  assert.match(setupPlanWithPorts({ profile: "xmrig-proxy" }).d, /MoneroOcean\/xmrig-proxy/);
  assert.match(setupPlanWithPorts({ profile: "xmrig-proxy" }).d, /tar xf xmrig-proxy\.tar\.gz && chmod \+x xmrig-proxy/);
  assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-proxy" }).d, /xmrig-proxy\.tar\.gz --strip-components=1/);
  assert.match(setupPlanWithPorts({ profile: "xmrig-proxy", os: "windows" }).d, /win64/);
  assert.match(setupPlanWithPorts({ profile: "xmrig-proxy" }).l, /--nicehash/);
  assert.match(setupPlanWithPorts({ profile: "xmrig-proxy" }).ln, /Replace PROXY_HOST/);
  assert.match(setupPlanWithPorts({ profile: "xmrig-proxy" }).nt, /For small proxy setups, start with 64-128 KH\/s/);
  assert.equal(setupPlanWithPorts({ profile: "xmrig-proxy", algo: "etchash" }).s.al, "auto");
  assert.match(setupPlanWithPorts({ profile: "xmr-node-proxy" }).rt, /node proxy\.js --config config\.json/);
  assert.equal(setupPlanWithPorts({ profile: "xmr-node-proxy", algo: "etchash" }).s.al, "auto");
  assert.match(setupPlanWithPorts({ profile: "xmr-node-proxy" }).rt, /"ssl": true/);
  assert.match(setupPlanWithPorts({ profile: "xmr-node-proxy" }).rt, /"allowSelfSignedSSL": true/);
  assert.match(setupPlanWithPorts({ profile: "xmr-node-proxy" }).rt, /"port": 28192/);
  assert.doesNotMatch(setupPlanWithPorts({ profile: "xmr-node-proxy" }).rt, /"password"|algo_perf|blob_type|developerShare|bindAddress|Optional production service|pm2|rx\/0 starter config/);
  assert.match(setupPlanWithPorts({ profile: "xmr-node-proxy" }).nt, /rx\/0 starter config/);
  assert.doesNotMatch(setupPlanWithPorts({ profile: "xmr-node-proxy", os: "macos" }).d, /Node\.js 18\+ is required/);
  assert.match(setupPlanWithPorts({ profile: "xmr-node-proxy", os: "linux" }).d, /sudo apt-get install git/);
  assert.doesNotMatch(setupPlanWithPorts({ profile: "xmr-node-proxy" }).l, /--coin monero/);
  assert.match(setupPlanWithPorts({ profile: "xmr-node-proxy" }).ln, /Replace PROXY_HOST/);
  assert.deepEqual(setupAlgoOptions("xmrig-mo"), [["auto", "Auto switch"]]);
  assert.deepEqual(setupAlgoOptions("xmrig-fixed"), [["auto", "Auto switch"]]);
  assert.equal(setupAlgoOptions("srb-gpu").some(([id]) => id === "rx/0"), false);
  assert.deepEqual(setupProfileOptions("macos").map((row) => row[0]), ["xmrig-mo", "xmrig-proxy", "xmr-node-proxy"]);
  assert.equal(setupProfileOptions("windows").some((row) => row[0] === "xmr-node-proxy"), false);
  assert.equal(setupPlanWithPorts({ profile: "xmrig-proxy", os: "macos" }).s.pr, "xmrig-proxy");
  assert.match(setupPlanWithPorts({ profile: "xmrig-proxy", os: "macos" }).d, /xmrig-proxy macOS release assets are currently arm64 only/);
  assert.match(setupPlanWithPorts({ profile: "xmrig-proxy", os: "macos" }).d, /mac64\\.tar\\.gz/);
  assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-proxy", os: "macos" }).d, /mac-intel/);
  assert.match(setupPlanWithPorts({ profile: "xmrig-proxy", os: "macos" }).dn, /MoneroOcean xmrig-proxy macOS release assets are currently arm64 only.*build xmrig-proxy from source on Intel macOS/);
  assert.match(setupPlanWithPorts({ profile: "xmrig-proxy", os: "macos" }).nt, /Intel macOS is not supported/);
  assert.match(setupPlanWithPorts({ profile: "xmr-node-proxy", os: "macos" }).d, /brew install node git/);
  assert.equal(setupAddress({ queryAddress: "query", activeAddress: "active", watchlist: [{ address: "tracked" }] }), "query");
  assert.equal(setupAddress({ activeAddress: "active", watchlist: [{ address: "tracked" }] }), "active");
  assert.equal(setupAddress({ watchlist: [{ address: "tracked" }] }), "tracked");
  assert.equal(setupAddress(), "YOUR_XMR_ADDRESS");
});

test("setup package install commands come first in command cards", () => {
  for (const os of ["linux", "macos", "windows"]) {
    for (const profile of ["xmrig-mo", "srb-gpu", "meta-miner", "xmrig-proxy", "xmr-node-proxy"]) {
      const plan = setupPlanWithPorts({ os, profile });
      for (const field of ["d", "rt", "r", "to", "l"]) {
        assertPackageInstallFirst(plan[field] || "", `${os}/${profile}/${field}`);
      }
    }
  }
});

test("help reference ports match current port stats", () => {
  assert.equal(referencePortSummary(), "80/443 TLS for 1 KH/s; 10001/20001 TLS for 1 KH/s; 10002/20002 TLS for 2 KH/s; 10004/20004 TLS for 4 KH/s; 10008/20008 TLS for 8 KH/s; 10016/20016 TLS for 16 KH/s; 10032/20032 TLS for 32 KH/s; 10064/20064 TLS for 64 KH/s; 10128/20128 TLS for 128 KH/s; 10256/20256 TLS for 256 KH/s; 10512/20512 TLS for 512 KH/s; 11024/21024 TLS for 1 MH/s; 12048/22048 TLS for 2 MH/s; 14096/24096 TLS for 4 MH/s; 18192/28192 TLS for 8 MH/s");
});

test("wallet chart endpoint uses backend hashrate chart path", () => {
  const address = `4${"A".repeat(94)}`;
  assert.equal(endpointKey(`miner/${address}/chart/hashrate`), `miner/${address}/chart/hashrate`);
  assert.equal(endpointKey("pool/chart/hashrate"), "pool/chart/hashrate");
  assert.equal(endpointKey("pool/motd"), "pool/motd");
  assert.equal(endpointKey("pool/ports"), "pool/ports");
  assert.equal(endpointKey("config"), "config");
  assert.equal(endpointKey("pool/blocks?page=0&limit=15"), "pool/blocks?page=0&limit=15");
  assert.equal(endpointKey("user/updateThreshold"), "user/updateThreshold");
});

test("wallet settings normalize threshold and estimate payout fee", () => {
  assert.equal(payoutThresholdFromAtomic(300000000000, TEST_POLICY), 0.3);
  assert.equal(payoutThresholdFromAtomic(0, TEST_POLICY), 0.3);
  assert.equal(normalizePayoutThreshold("0.001"), 0.001);
  assert.equal(normalizePayoutThreshold("0.05"), 0.05);
  assert.equal(validatePayoutThreshold("0.001", TEST_POLICY).valid, false);
  assert.match(validatePayoutThreshold("0.001", TEST_POLICY).message, /at least 0\.003 XMR/);
  assert.equal(validatePayoutThreshold("0.05", TEST_POLICY).valid, true);
  assert.equal(validatePayoutThreshold("0.05").message, "Payout policy unavailable from API.");
  assert.equal(formatPayoutThresholdInput(0.3, TEST_POLICY), "0.3");
  assert.equal(formatPayoutThresholdInput(0.003, TEST_POLICY), "0.003");
  assert.equal(payoutFeeText(0.003, TEST_POLICY), "+0.0004 (13.33%) XMR tx fee");
  assert.equal(payoutFeeText(4, TEST_POLICY), "+0 (0%) XMR tx fee");
  assert.equal(payoutFeeEstimate(4, TEST_POLICY).fee, 0);

  const policy = payoutPolicyFromConfig({
    payout_policy: {
      minimumThreshold: 0.1,
      defaultThreshold: 0.5,
      denomination: 0.01,
      feeFormula: { maxFee: 0.001, zeroFeeThreshold: 2 }
    }
  });
  assert.equal(payoutThresholdFromAtomic(0, policy), 0.5);
  assert.equal(formatPayoutThresholdInput(0.1234, policy), "0.12");
  assert.equal(validatePayoutThreshold("0.05", policy).valid, false);
  assert.match(validatePayoutThreshold("0.05", policy).message, /at least 0\.1 XMR/);
  assert.equal(validatePayoutThreshold("0.5", policy).valid, true);
  assert.equal(payoutFeeText(0.1, policy), "+0.001 (1%) XMR tx fee");
  assert.equal(payoutFeeEstimate(2, policy).fee, 0);
});

test("uptimerobot status makes core outages red and coin node outages yellow", () => {
  assert.equal(summarizeUptimeRobot({ data: [{ name: "Backend: API server", statusClass: "success" }, { name: "Backend: Node XMR", statusClass: "paused" }] }).tone, "green");
  assert.equal(summarizeUptimeRobot({ data: [{ name: "Backend: Node WOWNERO", statusClass: "danger" }] }).tone, "yellow");
  assert.equal(summarizeUptimeRobot({ data: [{ name: "Backend: Node XMR", statusClass: "danger" }] }).tone, "red");
  assert.equal(summarizeUptimeRobot({ data: [{ name: "Backend: API server", statusClass: "danger" }] }).tone, "red");
});

test("tracking a wallet stays on dashboard and clears input", () => {
  const address = `4${"A".repeat(94)}`;
  const existing = `8${"B".repeat(105)}`;
  const result = trackWalletState([{ address: existing, time: 1 }], address, 123);
  assert.equal(result.nextHash, "#/?tracked=123");
  assert.equal(result.clearInput, true);
  assert.deepEqual(result.watchlist.map((row) => row.address), [existing, address]);
});

test("worker controls sort by name or hashrate", () => {
  const workers = [{ name: "zeta", rate: 10 }, { name: "alpha", rate: 50 }, { name: "beta", rate: 50 }];
  assert.equal(workerSortMode("name"), "name");
  assert.equal(workerSortMode("other"), "h");
  assert.equal(workerSortDirection("asc"), "asc");
  assert.deepEqual(sortWorkerRows(workers, "name", "asc").map((row) => row.name), ["alpha", "beta", "zeta"]);
  assert.deepEqual(sortWorkerRows(workers, "hashrate").map((row) => row.name), ["alpha", "beta", "zeta"]);
  assert.deepEqual(sortWorkerRows(workers, "hashrate", "asc").map((row) => row.name), ["zeta", "alpha", "beta"]);
});

test("explainer copy covers required terms", () => {
  assert.match(EXPLANATIONS.n, /XMR-normalized/);
  assert.match(EXPLANATIONS.c, /10-minute/);
  assert.match(EXPLANATIONS.c, /XMR-normalized/);
  assert.match(EXPLANATIONS.h, /profit per hash/);
  assert.match(EXPLANATIONS.r, /Raw hashrate/);
  assert.match(EXPLANATIONS.x, /XTM\/Tari/);
  assert.match(EXPLANATIONS.py, /threshold/);
});
