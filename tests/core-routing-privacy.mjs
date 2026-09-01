import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, formatHashrate, formatNumber, formatPercent, shortAddress, trimFixed } from "../src/format.js";
import { setTitle, updateCanonical } from "../src/seo.js";
import { appendWallet, loadWatchlist, localHistoryEnabled, rmWallet, saveWallet, setConsent, shouldAskConsent } from "../src/privacy.js";
import { isXmrAddress, parseRoute, routeCoinId, walletRoute } from "../src/routes.js";
import { clearPreferenceStorage, parseCookieValue, readPreferences, saveExplanations, saveTheme, toggleExplanations, toggleTheme } from "../src/preferences.js";
import { blockPageSize, MAX_ROUTE_PAGE, pageBounds, pageCountFor, pageQuery, routePageNumber } from "../src/paging.js";
import { compareValues, nextSortDirection, nextSortDirectionForKey, sortDirection, sortRows } from "../src/table-sort.js";
import { calcProfitRows, fiatForTimezone, formatFiat, hashrateFromInput, hashrateInputFromHashrate } from "../src/calc.js";
import { dismissMotd, normalizeMotd, resetMotdDismissalsForTest, shouldShowMotd } from "../src/motd.js";
import { walletTrackButtonLabel } from "../src/views/home.js";

function routePublicShape(route) {
  const shape = { n: route.n, p: route.p, q: route.q };
  if (route.a !== undefined) shape.a = route.a;
  if (route.t !== undefined) shape.t = route.t;
  if (route.c !== undefined) shape.c = route.c;
  return shape;
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
    18144: { port: 18144, symbol: "XTM", displayName: "XTM", algo: "rx/0", profit: 0.8, pplnsShare: 0.05, active: false, exchangeConfigured: true, hashrate: 0, miners: 0, blockTime: 120, atomicUnits: 1000000, altBlocksFound: 4 },
    18146: { port: 18146, symbol: "XTM", displayName: "XTM-T", algo: "rx/0", profit: 0.7, pplnsShare: 0.05, active: true, exchangeConfigured: true, hashrate: 0, miners: 0, blockTime: 120, atomicUnits: 1000000, altBlocksFound: 3 },
    18148: { port: 18148, symbol: "XTM", displayName: "XTM-C", algo: "c29", profit: 0.6, pplnsShare: 0.05, active: true, exchangeConfigured: true, hashrate: 100, miners: 1, blockTime: 120, atomicUnits: 1000000, altBlocksFound: 2 },
    9998: { port: 9998, symbol: "RTM", displayName: "Raptoreum", algo: "ghostrider", profit: 0.5, pplnsShare: 0.3, active: false, exchangeConfigured: false, disabledReason: "no exchange", hashrate: 20000, miners: 1, blockTime: 60, atomicUnits: 100000000, altBlocksFound: 2 }
  }
};

test.describe("core routing, privacy, and preferences", { concurrency: false }, () => {
  test("route parsing supports expected hash routes", () => {
    assert.deepEqual(parseRoute("#/coins").n, "coins");
    assert.equal(parseRoute("#/blocks/XMR").c, "XMR");
    assert.equal(parseRoute("#/blocks/RTM").c, "RTM");
    assert.equal(parseRoute("#/blocks/XTM-C").c, "XTM-C");
    assert.equal(parseRoute("#/blocks/XTM-T").c, "XTM-T");
    assert.equal(parseRoute("#/blocks?coin=XMR").q.coin, "XMR");
    assert.equal(parseRoute("#/blocks?coin=RTM").q.coin, "RTM");
    assert.equal(parseRoute("#/blocks/18081").c, undefined);
    assert.equal(parseRoute("#/blocks/12345").c, undefined);
    assert.equal(routeCoinId("18081", LINK_TEST_POOL), "XMR");
    assert.equal(routeCoinId("18144", LINK_TEST_POOL), "XTM");
    assert.equal(routeCoinId("18146", LINK_TEST_POOL), "XTM-T");
    assert.equal(routeCoinId("18148", LINK_TEST_POOL), "XTM-C");
    assert.equal(routeCoinId("9998", LINK_TEST_POOL), "RTM");
    assert.equal(routeCoinId("12345", {}), "12345");
    assert.equal(parseRoute("#/payments?page=3").q.page, "3");
    assert.equal(parseRoute("#/calc?rate=5&unit=mh").n, "calc");
    assert.equal(parseRoute("#/calc?rate=5&unit=mh").q.unit, "mh");
    assert.equal(parseRoute("#/setup?os=windows&profile=srb-gpu").q.profile, "srb-gpu");
    assert.equal(parseRoute("#/coins?issues=1").q.issues, "1");
    assert.equal(parseRoute("#/account/abc/payments").n, "home");
    assert.equal(parseRoute("#/wallet/abc").n, "wallet");
    assert.equal(parseRoute("#/wallet/abc").t, "overview");
    assert.equal(parseRoute("#/wallet/abc/payments").n, "home");
    assert.equal(parseRoute("#/wallet/abc/settings").n, "home");
    assert.equal(parseRoute("#/wallet/abc/withdrawls").n, "home");
    assert.equal(parseRoute("#/wallet/abc/rewards").t, "rewards");
    assert.equal(parseRoute("#/wallet/abc/payout").t, "payout");
    assert.equal(parseRoute("#/wallet/abc/alerts").t, "alerts");
    assert.equal(parseRoute("#/wallet/abc/withdrawals").t, "withdrawals");
    assert.equal(parseRoute("#/wallet/abc/block-rewards").n, "home");
    assert.equal(parseRoute("#/wallet/abc/payment-threshold").n, "home");
    assert.equal(parseRoute("#/wallet/abc/email-alerts").n, "home");
    assert.equal(parseRoute("#/wallet/abc/settings").n, "home");
  });

  test("public URI path names remain stable for miner-facing links", () => {
    const address = `4${"A".repeat(94)}`;
    const stableRoutes = [
      ["#/", { n: "home", p: "#/" }],
      ["#/coins", { n: "coins", p: "#/coins" }],
      ["#/blocks", { n: "blocks", p: "#/blocks" }],
      ["#/blocks/XMR", { n: "blocks", c: "XMR", p: "#/blocks/XMR" }],
      ["#/blocks/RTM", { n: "blocks", c: "RTM", p: "#/blocks/RTM" }],
      ["#/blocks/XTM-C", { n: "blocks", c: "XTM-C", p: "#/blocks/XTM-C" }],
      ["#/blocks/XTM-T", { n: "blocks", c: "XTM-T", p: "#/blocks/XTM-T" }],
      ["#/blocks?coin=XMR", { n: "blocks", p: "#/blocks", q: { coin: "XMR" } }],
      ["#/blocks?coin=RTM", { n: "blocks", p: "#/blocks", q: { coin: "RTM" } }],
      ["#/payments", { n: "payments", p: "#/payments" }],
      ["#/calc", { n: "calc", p: "#/calc" }],
      ["#/setup", { n: "setup", p: "#/setup" }],
      ["#/help", { n: "help", p: "#/help" }],
      [`#/wallet/${address}`, { n: "wallet", a: address, t: "overview", p: `#/wallet/${address}/overview` }],
      [`#/wallet/${address}/overview`, { n: "wallet", a: address, t: "overview", p: `#/wallet/${address}/overview` }],
      [`#/wallet/${address}/withdrawals`, { n: "wallet", a: address, t: "withdrawals", p: `#/wallet/${address}/withdrawals` }],
      [`#/wallet/${address}/rewards`, { n: "wallet", a: address, t: "rewards", p: `#/wallet/${address}/rewards` }],
      [`#/wallet/${address}/payout`, { n: "wallet", a: address, t: "payout", p: `#/wallet/${address}/payout` }],
      [`#/wallet/${address}/alerts`, { n: "wallet", a: address, t: "alerts", p: `#/wallet/${address}/alerts` }]
    ];

    for (const [hash, expected] of stableRoutes) {
      assert.deepEqual(routePublicShape(parseRoute(hash)), { q: {}, ...expected }, hash);
    }

    assert.equal(walletRoute(address), `#/wallet/${address}/overview`);
    assert.equal(walletRoute(address, "withdrawals"), `#/wallet/${address}/withdrawals`);
    assert.equal(walletRoute(address, "rewards"), `#/wallet/${address}/rewards`);
    assert.equal(walletRoute(address, "payout"), `#/wallet/${address}/payout`);
    assert.equal(walletRoute(address, "alerts"), `#/wallet/${address}/alerts`);

    for (const oldOrAmbiguous of [
      "#/blocks/18081",
      "#/blocks/9998",
      "#/blocks/Raptoreum",
      `#/account/${address}`,
      `#/wallet/${address}/withdrawls`,
      `#/wallet/${address}/block-rewards`,
      `#/wallet/${address}/payment-threshold`,
      `#/wallet/${address}/email-alerts`,
      `#/wallet/${address}/payments`,
      `#/wallet/${address}/settings`
    ]) {
      assert.equal(parseRoute(oldOrAmbiguous).n, "home", oldOrAmbiguous);
    }
  });

  test("route optional query contracts remain stable", () => {
    const address = `4${"A".repeat(94)}`;
    const cases = [
      ["#/?window=6h&mode=raw", { n: "home", p: "#/", q: { window: "6h", mode: "raw" } }],
      ["#/?tracked=1700000000000", { n: "home", p: "#/", q: { tracked: "1700000000000" } }],
      ["#/coins?issues=1&inactive=0&sort=profit&dir=desc", { n: "coins", p: "#/coins", q: { issues: "1", inactive: "0", sort: "profit", dir: "desc" } }],
      ["#/blocks/XMR?page=2&limit=50", { n: "blocks", c: "XMR", p: "#/blocks/XMR", q: { page: "2", limit: "50" } }],
      ["#/blocks/RTM?page=3&limit=100", { n: "blocks", c: "RTM", p: "#/blocks/RTM", q: { page: "3", limit: "100" } }],
      ["#/blocks/XTM-C?page=4&limit=50", { n: "blocks", c: "XTM-C", p: "#/blocks/XTM-C", q: { page: "4", limit: "50" } }],
      ["#/blocks/XTM-T?page=5&limit=100", { n: "blocks", c: "XTM-T", p: "#/blocks/XTM-T", q: { page: "5", limit: "100" } }],
      ["#/blocks?coin=XMR&page=2&limit=50", { n: "blocks", p: "#/blocks", q: { coin: "XMR", page: "2", limit: "50" } }],
      ["#/blocks?coin=RTM&page=3&limit=100", { n: "blocks", p: "#/blocks", q: { coin: "RTM", page: "3", limit: "100" } }],
      ["#/payments?page=4&limit=100", { n: "payments", p: "#/payments", q: { page: "4", limit: "100" } }],
      ["#/calc?rate=1.25&unit=mh", { n: "calc", p: "#/calc", q: { rate: "1.25", unit: "mh" } }],
      [`#/setup?addr=${address}&os=linux&profile=xmrig-mo&rate=4&unit=kh`, { n: "setup", p: "#/setup", q: { addr: address, os: "linux", profile: "xmrig-mo", rate: "4", unit: "kh" } }],
      ["#/setup?os=windows&profile=srb-gpu&gpu=amd&algo=kawpow&rate=128&unit=mh", { n: "setup", p: "#/setup", q: { os: "windows", profile: "srb-gpu", gpu: "amd", algo: "kawpow", rate: "128", unit: "mh" } }],
      [`#/wallet/${address}/overview?window=12h&mode=xmr&view=list&sort=name&dir=asc&dead=0&stats=1`, { n: "wallet", a: address, t: "overview", p: `#/wallet/${address}/overview`, q: { window: "12h", mode: "xmr", view: "list", sort: "name", dir: "asc", dead: "0", stats: "1" } }],
      [`#/wallet/${address}/withdrawals?window=12h&mode=raw&view=list&sort=name&dir=asc&wpage=2&wlimit=50&rpage=3&rlimit=100`, { n: "wallet", a: address, t: "withdrawals", p: `#/wallet/${address}/withdrawals`, q: { window: "12h", mode: "raw", view: "list", sort: "name", dir: "asc", wpage: "2", wlimit: "50", rpage: "3", rlimit: "100" } }],
      [`#/wallet/${address}/rewards?window=24h&mode=xmr&view=3&sort=h&dir=desc&wpage=2&wlimit=50&rpage=4&rlimit=100&dead=0&stats=1`, { n: "wallet", a: address, t: "rewards", p: `#/wallet/${address}/rewards`, q: { window: "24h", mode: "xmr", view: "3", sort: "h", dir: "desc", wpage: "2", wlimit: "50", rpage: "4", rlimit: "100", dead: "0", stats: "1" } }]
    ];

    for (const [hash, expected] of cases) {
      assert.deepEqual(routePublicShape(parseRoute(hash)), expected, hash);
    }

    for (const sort of ["name", "algo", "profit", "effort", "reward", "wallets", "pool", "world", "height", "pplns", "notes"]) {
      assert.deepEqual(parseRoute(`#/coins?sort=${sort}&dir=asc&issues=1&inactive=0`).q, { sort, dir: "asc", issues: "1", inactive: "0" }, `coin sort ${sort}`);
    }
    for (const unit of ["h", "kh", "mh"]) {
      assert.deepEqual(parseRoute(`#/calc?rate=5&unit=${unit}`).q, { rate: "5", unit }, `calc unit ${unit}`);
    }
    for (const window of ["6h", "12h", "24h", "all"]) {
      assert.deepEqual(parseRoute(`#/wallet/${address}/overview?window=${window}&mode=raw`).q, { window, mode: "raw" }, `wallet graph window ${window}`);
    }
    for (const mode of ["1", "2", "3", "4", "5", "list"]) {
      assert.deepEqual(parseRoute(`#/wallet/${address}/overview?view=${mode}&sort=name&dir=asc`).q, { view: mode, sort: "name", dir: "asc" }, `worker display mode ${mode}`);
    }
    for (const sort of ["name", "algo", "xmr", "raw", "avg", "avgraw", "last", "valid", "invalid", "hashes"]) {
      assert.deepEqual(parseRoute(`#/wallet/${address}/overview?view=list&sort=${sort}&dir=desc`).q, { view: "list", sort, dir: "desc" }, `worker list sort ${sort}`);
    }
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
    assert.equal(rows[0].fiatLabel, "USD");
    assert.equal(formatFiat(0.064, "USD"), "$0.064");
    // Missing API price -> fiat is NaN and renders "--", not "$0.00".
    const noPrice = calcProfitRows("2", "kh", { coins: { 18081: { port: 18081, symbol: "XMR", profit: 0.00000008 } } }, "America/New_York");
    assert.ok(Number.isNaN(noPrice[0].fiat));
    assert.equal(formatFiat(noPrice[0].fiat, noPrice[0].fiatLabel), "--");
  });

  test("block paging clamps page number and page size choices", () => {
    assert.equal(MAX_ROUTE_PAGE, 999);
    assert.equal(routePageNumber("3"), 3);
    assert.equal(routePageNumber("-1"), 1);
    assert.equal(routePageNumber("999999"), MAX_ROUTE_PAGE);
    assert.equal(routePageNumber("0.5"), 1);
    assert.equal(routePageNumber("0.9"), 1);
    assert.equal(blockPageSize("50"), 50);
    assert.equal(blockPageSize("100"), 100);
    assert.equal(blockPageSize("25"), 15);
    assert.equal(pageCountFor(101, 50), 3);
    assert.equal(pageCountFor(999999, 15), MAX_ROUTE_PAGE);
    assert.equal(pageCountFor(0, 50), 1);
    assert.equal(pageCountFor(undefined, 50), 1);
  });

  test("table sortable toggles direction and sorts numeric or text values", () => {
    const rows = [{ name: "b", value: 2 }, { name: "a", value: 10 }];
    assert.equal(sortDirection("bad"), "desc");
    assert.equal(nextSortDirection("value", "desc", "value"), "asc");
    assert.equal(nextSortDirectionForKey("pplns", "desc", "name", { name: "asc" }), "asc");
    assert.equal(nextSortDirectionForKey("pplns", "desc", "notes", { name: "asc", algo: "asc", notes: "asc" }), "asc");
    assert.equal(nextSortDirectionForKey("name", "asc", "name", { name: "asc" }), "desc");
    assert.deepEqual(sortRows(rows, "value", "asc").map((row) => row.name), ["b", "a"]);
    assert.deepEqual(sortRows(rows, "name", "desc").map((row) => row.name), ["b", "a"]);
    assert.deepEqual(sortRows([{ name: "low", pplns: 0.1 }, { name: "high", pplns: 12 }], "pplns").map((row) => row.name), ["high", "low"]);
    // Tie-break on name is direction-independent (always ascending) so ordering stays stable.
    const tied = [{ name: "z", v: 5 }, { name: "a", v: 5 }, { name: "m", v: 5 }];
    assert.deepEqual(sortRows(tied, "v", "desc").map((row) => row.name), ["a", "m", "z"]);
    assert.deepEqual(sortRows(tied, "v", "asc").map((row) => row.name), ["a", "m", "z"]);
    assert.equal(Math.sign(compareValues("1,234", 1000)), 1);
    assert.equal(Math.sign(compareValues("50%", 40)), 1);
    assert.equal(Math.sign(compareValues(5, "abc")), -1);
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
      appendWallet(address);
      saveTheme("light");
      saveExplanations("off");
      store.set("mo.motd.dismissed.v1", "old-motd-key");
      assert.deepEqual(loadWatchlist().map((row) => row.address), [address]);

      assert.equal(setConsent(false), false);
      assert.equal(shouldAskConsent("en-US", "America/New_York"), false);
      assert.equal(localHistoryEnabled(), false);
      assert.deepEqual(loadWatchlist(), []);
      assert.equal(store.has("mo.wallets.v1"), false);
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

  test("local history consent gating covers consent, locale, timezone, and stale storage edges", () => {
    const store = new Map();
    global.localStorage = {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key)
    };

    assert.equal(shouldAskConsent("en-US", "Europe/Berlin"), true);
    assert.equal(shouldAskConsent("el-GR", "UTC"), true);
    assert.equal(shouldAskConsent("en-IE", "UTC"), true);
    assert.equal(shouldAskConsent("en-US", "Atlantic/Canary"), true);
    assert.equal(shouldAskConsent("en-US", "America/New_York"), false);

    setConsent(false);
    assert.equal(shouldAskConsent("de-DE", "Europe/Berlin"), false);
    assert.equal(localHistoryEnabled(), false);
    assert.deepEqual(loadWatchlist(), []);

    setConsent(true);
    assert.equal(shouldAskConsent("de-DE", "Europe/Berlin"), false);
    assert.equal(localHistoryEnabled(), true);

    const fresh = `4${"D".repeat(94)}`;
    const stale = `4${"E".repeat(94)}`;
    store.set("mo.wallets.v1", JSON.stringify([
      { address: stale, time: Date.now() - 181 * 24 * 60 * 60 * 1000 },
      { address: fresh, time: Date.now() }
    ]));
    assert.deepEqual(loadWatchlist().map((row) => row.address), [fresh]);
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
    assert.equal(normalizeMotd({ message: "hi" }).body, "hi");
    assert.equal(normalizeMotd({ text: "hi" }).body, "hi");
    assert.equal(normalizeMotd({ body: "b", updated: "5" }).key, "5|b");
    assert.equal(normalizeMotd({ body: "b", time: "7" }).key, "7|b");
    assert.deepEqual(normalizeMotd({ motd: { subject: "S", body: "B", created: "1" } }), { subject: "S", body: "B", created: "1", key: "1|S|B" });
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
    const previousWindow = global.window;
    try {
      global.window = { matchMedia: (query) => ({ matches: /max-width:\s*620px/.test(query) }) };
      assert.deepEqual(readPreferences(""), { theme: "dark", explanations: "off" });
      assert.deepEqual(readPreferences("mo.explain=on"), { theme: "dark", explanations: "on" });
      global.window = { matchMedia: () => ({ matches: false }) };
      assert.deepEqual(readPreferences(""), { theme: "dark", explanations: "on" });
      assert.deepEqual(readPreferences("mo.explain=off"), { theme: "dark", explanations: "off" });
    } finally {
      global.window = previousWindow;
    }
    assert.equal(toggleTheme("light"), "dark");
    assert.equal(toggleExplanations("off"), "on");
    clearPreferenceStorage();
  });

  test("formatters and escapeHtml produce stable output across boundaries", () => {
    assert.equal(formatNumber(1234567), "1,234,567");
    assert.equal(formatNumber("x"), "--");
    assert.equal(formatPercent(50), "50.00%");
    assert.equal(formatPercent(NaN), "--");
    assert.equal(trimFixed(1.2000, 4), "1.2");
    assert.equal(trimFixed(3, 2), "3");
    assert.equal(trimFixed(10, 0), "10");
    assert.equal(trimFixed(120, 0), "120");
    assert.equal(trimFixed(100, 0), "100");
    assert.equal(formatFiat(null), "--");
    assert.equal(formatFiat(NaN), "--");
    assert.equal(formatFiat(""), "--");
    assert.equal(shortAddress(`4${"A".repeat(94)}`), "4AAAAAAA...AAAAAAAA");
    assert.equal(shortAddress(""), "");
    assert.equal(formatHashrate(0), "0 H/s");
    assert.equal(formatHashrate(-5), "0 H/s");
    assert.equal(formatHashrate(NaN), "0 H/s");
    assert.equal(formatHashrate(12345), "12.3 kH/s");
    assert.equal(formatHashrate(2.5e18), "2500 PH/s");
    assert.equal(escapeHtml(`<a href="x" title='y'>&`), "&lt;a href=&quot;x&quot; title=&#039;y&#039;&gt;&amp;");
    assert.equal(escapeHtml(null), "");
  });

  test("setTitle maps routes with a home fallback and updateCanonical syncs href", () => {
    const previousDocument = global.document;
    const link = { href: "" };
    global.document = { title: "", querySelector: (selector) => selector.includes("canonical") ? link : null };
    try {
      setTitle({ n: "home" });
      assert.equal(global.document.title, "MoneroOcean Pool Dashboard | XMR Mining Pool");
      setTitle({ n: "coins" });
      assert.equal(global.document.title, "MoneroOcean Coins | XMR Mining Pool");
      setTitle({ n: "unknown" });
      assert.equal(global.document.title, "MoneroOcean Pool Dashboard | XMR Mining Pool");
      updateCanonical({ p: "#/coins" });
      assert.equal(link.href, "https://moneroocean.stream/#/coins");
    } finally {
      if (previousDocument === undefined) delete global.document;
      else global.document = previousDocument;
    }
  });

  test("saveWallet stores newest-first with dedupe and rmWallet removes", () => {
    const store = new Map();
    global.localStorage = {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key)
    };
    setConsent(true);
    const a = `4${"A".repeat(94)}`;
    const b = `8${"B".repeat(105)}`;
    assert.deepEqual(saveWallet(a).map((row) => row.address), [a]);
    assert.deepEqual(saveWallet(b).map((row) => row.address), [b, a]);
    assert.deepEqual(saveWallet(a).map((row) => row.address), [a, b]);
    assert.deepEqual(saveWallet("bad").map((row) => row.address), [a, b]);
    assert.deepEqual(rmWallet(a).map((row) => row.address), [b]);
  });

  test("appendWallet appends oldest-first, dedupes to the end, and caps at 10 by dropping the oldest", () => {
    const store = new Map();
    global.localStorage = {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key)
    };
    setConsent(true);
    const addr = (i) => `4${String.fromCharCode(65 + i).repeat(94)}`;
    assert.deepEqual(appendWallet(addr(0)).map((row) => row.address), [addr(0)]);
    assert.deepEqual(appendWallet(addr(1)).map((row) => row.address), [addr(0), addr(1)]);
    assert.deepEqual(appendWallet(addr(0)).map((row) => row.address), [addr(1), addr(0)], "re-append moves to the end");
    let list;
    for (let i = 2; i < 13; i += 1) list = appendWallet(addr(i));
    assert.equal(list.length, 10);
    assert.equal(list.at(-1).address, addr(12));
    assert.equal(list.some((row) => row.address === addr(1)), false, "oldest entries are evicted past the cap");
  });

  test("saveTheme/saveExplanations persist with a 180-day Secure SameSite=Lax cookie", () => {
    const previousDocument = global.document;
    const writes = [];
    global.document = { get cookie() { return ""; }, set cookie(value) { writes.push(value); } };
    try {
      saveTheme("light", { persist: true });
      assert.match(writes.at(-1), /^mo\.theme=light; Max-Age=15552000; Path=\/; SameSite=Lax; Secure$/);
      saveExplanations("off", { persist: true });
      assert.match(writes.at(-1), /^mo\.explain=off; Max-Age=15552000; Path=\/; SameSite=Lax; Secure$/);
      const count = writes.length;
      saveTheme("dark", { persist: false });
      assert.equal(writes.length, count, "persist:false writes no cookie");
    } finally {
      if (previousDocument === undefined) delete global.document;
      else global.document = previousDocument;
    }
  });

  test("pageQuery and pageBounds build pagination state", () => {
    assert.equal(pageQuery(1, 15), "limit=15");
    assert.equal(pageQuery(1), "limit=15");
    assert.equal(pageQuery(3, 50), "page=3&limit=50");
    assert.equal(pageQuery(2, 25), "page=2&limit=15");
    assert.deepEqual(pageBounds(101, 50, 1, 50), { pageCount: 3, hasNext: true });
    assert.deepEqual(pageBounds(101, 50, 3, 1), { pageCount: 3, hasNext: false });
    assert.deepEqual(pageBounds(0, 50, 2, 50), { pageCount: 1, hasNext: true });
    assert.deepEqual(pageBounds(0, 50, 2, 10), { pageCount: 1, hasNext: false });
  });
});
