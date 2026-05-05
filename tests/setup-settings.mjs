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
import { referencePortList, referencePortSummary } from "../src/views/help.js";
import { homeView, walletTrackButtonLabel } from "../src/views/home.js";
import { poolDashboard } from "../src/views/pool-dashboard.js";
import { coinsView } from "../src/views/coins.js";
import { paymentsView, paymentRoute } from "../src/views/payments.js";

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

test.describe("setup, settings, uptime, and copy", { concurrency: false }, () => {
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
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", address: "ADDR", worker: "rig" }).tlsRunCommand, /gulf\.moneroocean\.stream:20016 .*--tls/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo" }).tlsRunNote, /TLS encrypts/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "linux", address: "ADDR", worker: "rig" }).torCommand, /sudo apt-get install tor && sudo systemctl enable --now tor/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "macos", address: "ADDR", worker: "rig" }).torCommand, /brew install tor && brew services start tor/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "linux" }).torNote, /onion host.*selected non-TLS setup port.*127\.0\.0\.1:9050.*127\.0\.0\.1:9150.*TLS does not improve security over Tor/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "linux", address: "ADDR", worker: "rig" }).torCommand, /\.\/xmrig -o mo2tor2amawhphlrgyaqlrqx7o27jaj7yldnx3t6jip3ow4bujlwz6id\.onion:10016 .* -u ADDR --rig-id rig --keepalive/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "macos", address: "ADDR", worker: "rig" }).torCommand, /\.\/xmrig -o mo2tor2amawhphlrgyaqlrqx7o27jaj7yldnx3t6jip3ow4bujlwz6id\.onion:10016 .* -u ADDR --rig-id rig --keepalive/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-mo", os: "linux" }).torCommand, /--coin monero| -p tor|YOUR_XMR_WALLET|9150|do not add --tls|First run may benchmark|setup-step -ltn|Use 127\.0\.0\.1:9050|:20128|--tls/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "linux" }).notes, /first run may benchmark for several minutes before pool jobs appear/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "linux" }).downloadCommand, /sudo apt-get install curl/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "linux" }).downloadCommand, /tar xf xmrig\.tar\.gz && chmod \+x xmrig/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-mo", os: "linux" }).downloadCommand, /strip-components/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "windows" }).downloadNote, /Open Windows PowerShell first/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-mo", os: "windows" }).downloadCommand, /Open Windows PowerShell first/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-mo", os: "windows" }).plainRunCommand, /Open Windows PowerShell first|\.\\xmrig\.exe/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "windows" }).plainRunCommand, /^xmrig\.exe/m);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "meta-miner", os: "windows" }).plainRunCommand || "", /Open Windows PowerShell first/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "macos" }).downloadCommand, /grep 'mac64\\\.tar\\\.gz'/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-mo", os: "macos" }).downloadCommand, /mac-intel|\$asset|uname -m/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-mo", os: "macos" }).downloadCommand, /macOS release assets are currently arm64 only/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "macos" }).downloadCommand, /xattr -d com\.apple\.quarantine xmrig/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "macos" }).downloadNote, /MoneroOcean XMRig macOS release assets are currently arm64 only.*build XMRig from source on Intel macOS/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-mo", os: "macos" }).notes, /Intel macOS is not supported/);
    assert.equal(setupPlanWithPorts({ profile: "srb-gpu", os: "macos" }).selection.profile, "xmrig-mo");
    assert.equal(setupPlanWithPorts({ profile: "xmr-node-proxy", os: "windows" }).selection.profile, "xmrig-mo");
    assert.equal(setupPlanWithPorts({ profile: "xmrig-fixed", algo: "etchash" }).selection.profile, "xmrig-mo");
    assert.equal(setupPlanWithPorts({ profile: "xmrig-fixed", algo: "etchash" }).selection.algo, "auto");
    assert.equal(setupHashrateToHps(4, "kh"), 4000);
    const configuredPorts = setupConfiguredPorts({
      configured: [
        { port: null, tlsPort: 9000, difficulty: 1000, targetHashrate: 1000 / 30, description: "TLS only" },
        { port: 10002, tlsPort: 20002, difficulty: 20_000, targetHashrate: 700, description: "Small CPU" },
        { port: 10016, tlsPort: 20016, difficulty: 160_000, targetHashrate: 5000, description: "Fast CPU" }
      ]
    });
    assert.deepEqual(configuredPorts.map((row) => row.port), [10002, 10016]);
    assert.equal(setupPlan({ profile: "xmrig-mo", hashrate: 4, hashrateUnit: "kh", ports: configuredPorts }).selection.port, 10016);
    assert.match(setupPlan({ profile: "xmrig-mo", hashrate: 4, hashrateUnit: "kh", ports: configuredPorts }).summary, /Fast CPU/);
    assert.equal(setupPlan().selection.port, 0);
    assert.equal(setupPlanWithPorts({ profile: "xmrig-mo" }).selection.port, 10016);
    assert.equal(setupPlanWithPorts({ profile: "srb-gpu", os: "windows", address: "ADDR" }).selection.address, "ADDR");
    assert.equal(setupPlanWithPorts({ profile: "xmrig-mo", hashrate: 250, hashrateUnit: "h" }).selection.port, 10002);
    assert.equal(setupPlanWithPorts({ profile: "xmrig-proxy" }).selection.port, 18192);
    assert.deepEqual(setupHashrateDefaults("xmrig-proxy"), { value: 64, unit: "kh" });
    assert.deepEqual(setupHashrateDefaults("xmr-node-proxy"), { value: 128, unit: "kh" });
    assert.deepEqual(setupHashrateDefaults("srb-gpu", "intel"), { value: 128, unit: "kh" });
    assert.match(setupPlanWithPorts({ profile: "srb-gpu", gpu: "intel", algo: "cn/gpu" }).plainRunCommand, /--algorithm cryptonight_gpu/);
    assert.match(setupPlanWithPorts({ profile: "srb-gpu", gpu: "intel", algo: "cn/gpu" }).tlsRunCommand, /--pool gulf\.moneroocean\.stream:28192 .*--tls true/);
    assert.match(setupPlanWithPorts({ profile: "srb-gpu", gpu: "intel", algo: "cn/gpu" }).tlsRunNote, /Use --list-devices first/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "srb-gpu", gpu: "intel", algo: "cn/gpu" }).notes, /Use --list-devices first/);
    assert.match(setupPlanWithPorts({ profile: "srb-gpu", gpu: "intel", algo: "etchash" }).plainRunCommand, /--esm 2 --nicehash true/);
    assert.match(setupPlanWithPorts({ profile: "srb-gpu", gpu: "amd", algo: "kawpow" }).plainRunCommand, /--disable-gpu-nvidia --disable-gpu-intel/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "meta-miner", gpu: "nvidia" }).tlsRunCommand, /mm\.json/);
    assert.match(setupPlanWithPorts({ profile: "meta-miner", gpu: "nvidia" }).downloadCommand, /sudo apt-get install nodejs curl/);
    assert.match(setupPlanWithPorts({ profile: "meta-miner", gpu: "nvidia" }).tlsRunCommand, /--no-config-save/);
    assert.match(setupPlanWithPorts({ profile: "meta-miner", gpu: "nvidia" }).tlsRunCommand, /--pool="\$POOL"/);
    assert.match(setupPlanWithPorts({ profile: "meta-miner", gpu: "nvidia" }).tlsRunCommand, /POOL='gulf\.moneroocean\.stream:ssl28192'/);
    assert.match(setupPlanWithPorts({ profile: "meta-miner", gpu: "nvidia" }).tlsRunCommand, /--algo_min_time=60/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "meta-miner", gpu: "nvidia" }).tlsRunCommand, /--watchdog=600/);
    assert.match(setupPlanWithPorts({ profile: "meta-miner", gpu: "nvidia" }).notes, /First run benchmarks\/autotunes configured algorithms/);
    assert.match(setupPlanWithPorts({ profile: "meta-miner", gpu: "nvidia" }).tlsRunCommand, /WALLET=/);
    assert.match(setupPlanWithPorts({ profile: "meta-miner", gpu: "nvidia" }).tlsRunCommand, /COMMON="\$SRB --disable-cpu \$GPU_FLAGS/);
    assert.match(setupPlanWithPorts({ profile: "meta-miner", gpu: "nvidia" }).tlsRunCommand, /--kawpow="\$COMMON --algorithm kawpow --password \$WORKER~kawpow"/);
    assert.match(setupPlanWithPorts({ profile: "meta-miner", os: "windows", gpu: "amd" }).tlsRunCommand, /\$Common="\$Srb --disable-cpu \$GpuFlags/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy" }).tlsRunCommand, /xmrig-proxy/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy" }).tlsRunCommand, /--bind 0\.0\.0\.0:3333/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy" }).tlsRunCommand, /--mode nicehash/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy" }).tlsRunCommand, /gulf\.moneroocean\.stream:28192 .*--tls/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-proxy", worker: "rig" }).tlsRunCommand, / -p rig\b/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-proxy", worker: "rig" }).localCommand, / -p x\b/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-proxy" }).tlsRunCommand, /--coin monero/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-proxy" }).tlsRunCommand, /--donate-level 1/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-proxy" }).tlsRunCommand, /config\.json/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy" }).downloadCommand, /MoneroOcean\/xmrig-proxy/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy" }).downloadCommand, /tar xf xmrig-proxy\.tar\.gz && chmod \+x xmrig-proxy/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-proxy" }).downloadCommand, /xmrig-proxy\.tar\.gz --strip-components=1/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy", os: "windows" }).downloadCommand, /win64/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy" }).localCommand, /--nicehash/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy" }).localNote, /Replace PROXY_HOST/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy" }).notes, /For small proxy setups, start with 64-128 KH\/s/);
    assert.equal(setupPlanWithPorts({ profile: "xmrig-proxy", algo: "etchash" }).selection.algo, "auto");
    assert.match(setupPlanWithPorts({ profile: "xmr-node-proxy" }).tlsRunCommand, /node proxy\.js --config config\.json/);
    assert.equal(setupPlanWithPorts({ profile: "xmr-node-proxy", algo: "etchash" }).selection.algo, "auto");
    assert.match(setupPlanWithPorts({ profile: "xmr-node-proxy" }).tlsRunCommand, /"ssl": true/);
    assert.match(setupPlanWithPorts({ profile: "xmr-node-proxy" }).tlsRunCommand, /"allowSelfSignedSSL": true/);
    assert.match(setupPlanWithPorts({ profile: "xmr-node-proxy" }).tlsRunCommand, /"port": 28192/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmr-node-proxy" }).tlsRunCommand, /"password"|algo_perf|blob_type|developerShare|bindAddress|Optional production service|pm2|rx\/0 starter config/);
    assert.match(setupPlanWithPorts({ profile: "xmr-node-proxy" }).notes, /rx\/0 starter config/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmr-node-proxy", os: "macos" }).downloadCommand, /Node\.js 18\+ is required/);
    assert.match(setupPlanWithPorts({ profile: "xmr-node-proxy", os: "linux" }).downloadCommand, /sudo apt-get install git/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmr-node-proxy" }).localCommand, /--coin monero/);
    assert.match(setupPlanWithPorts({ profile: "xmr-node-proxy" }).localNote, /Replace PROXY_HOST/);
    assert.deepEqual(setupAlgoOptions("xmrig-mo"), [["auto", "Auto switch"]]);
    assert.deepEqual(setupAlgoOptions("xmrig-fixed"), [["auto", "Auto switch"]]);
    assert.equal(setupAlgoOptions("srb-gpu").some(([id]) => id === "rx/0"), false);
    assert.deepEqual(setupProfileOptions("macos").map((row) => row[0]), ["xmrig-mo", "xmrig-proxy", "xmr-node-proxy"]);
    assert.equal(setupProfileOptions("windows").some((row) => row[0] === "xmr-node-proxy"), false);
    assert.equal(setupPlanWithPorts({ profile: "xmrig-proxy", os: "macos" }).selection.profile, "xmrig-proxy");
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy", os: "macos" }).downloadCommand, /xmrig-proxy macOS release assets are currently arm64 only/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy", os: "macos" }).downloadCommand, /mac64\\.tar\\.gz/);
    assert.doesNotMatch(setupPlanWithPorts({ profile: "xmrig-proxy", os: "macos" }).downloadCommand, /mac-intel/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy", os: "macos" }).downloadNote, /MoneroOcean xmrig-proxy macOS release assets are currently arm64 only.*build xmrig-proxy from source on Intel macOS/);
    assert.match(setupPlanWithPorts({ profile: "xmrig-proxy", os: "macos" }).notes, /Intel macOS is not supported/);
    assert.match(setupPlanWithPorts({ profile: "xmr-node-proxy", os: "macos" }).downloadCommand, /brew install node git/);
    assert.equal(setupAddress({ queryAddress: "query", activeAddress: "active", watchlist: [{ address: "tracked" }] }), "query");
    assert.equal(setupAddress({ activeAddress: "active", watchlist: [{ address: "tracked" }] }), "active");
    assert.equal(setupAddress({ watchlist: [{ address: "tracked" }] }), "tracked");
    assert.equal(setupAddress(), "YOUR_XMR_ADDRESS");
  });

  test("setup package install commands come first in command cards", () => {
    for (const os of ["linux", "macos", "windows"]) {
      for (const profile of ["xmrig-mo", "srb-gpu", "meta-miner", "xmrig-proxy", "xmr-node-proxy"]) {
        const plan = setupPlanWithPorts({ os, profile });
        for (const field of ["downloadCommand", "tlsRunCommand", "plainRunCommand", "torCommand", "localCommand"]) {
          assertPackageInstallFirst(plan[field] || "", `${os}/${profile}/${field}`);
        }
      }
    }
  });

  test("help reference ports match current port stats", () => {
    assert.equal(referencePortSummary(), "80/443 TLS for 1 KH/s; 10001/20001 TLS for 1 KH/s; 10002/20002 TLS for 2 KH/s; 10004/20004 TLS for 4 KH/s; 10008/20008 TLS for 8 KH/s; 10016/20016 TLS for 16 KH/s; 10032/20032 TLS for 32 KH/s; 10064/20064 TLS for 64 KH/s; 10128/20128 TLS for 128 KH/s; 10256/20256 TLS for 256 KH/s; 10512/20512 TLS for 512 KH/s; 11024/21024 TLS for 1 MH/s; 12048/22048 TLS for 2 MH/s; 14096/24096 TLS for 4 MH/s; 18192/28192 TLS for 8 MH/s");
    const list = referencePortList();
    assert.match(list, /^<ul class="reference-port-list"><li>80\/443 TLS for 1 KH\/s<\/li>/);
    assert.equal([...list.matchAll(/<li>/g)].length, 15);
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

  test("tracking a wallet opens first wallet details then stays on dashboard for later wallets", () => {
    const address = `4${"A".repeat(94)}`;
    const existing = `8${"B".repeat(105)}`;
    const first = trackWalletState([], address, 123);
    assert.equal(first.nextHash, `#/wallet/${address}/overview`);
    assert.equal(first.clearInput, true);
    assert.deepEqual(first.watchlist.map((row) => row.address), [address]);

    const result = trackWalletState([{ address: existing, time: 1 }], address, 123);
    assert.equal(result.nextHash, "#/?tracked=123");
    assert.equal(result.clearInput, true);
    assert.deepEqual(result.watchlist.map((row) => row.address), [existing, address]);
  });

  test("worker controls sortable by name or hashrate", () => {
    const workers = [{ name: "zeta", rate: 10 }, { name: "alpha", rate: 50 }, { name: "beta", rate: 50 }];
    assert.equal(workerSortMode("name"), "name");
    assert.equal(workerSortMode("other"), "h");
    assert.equal(workerSortDirection("asc"), "asc");
    assert.deepEqual(sortWorkerRows(workers, "name", "asc").map((row) => row.name), ["alpha", "beta", "zeta"]);
    assert.deepEqual(sortWorkerRows(workers, "hashrate").map((row) => row.name), ["alpha", "beta", "zeta"]);
    assert.deepEqual(sortWorkerRows(workers, "hashrate", "asc").map((row) => row.name), ["zeta", "alpha", "beta"]);

    const address = `4${"A".repeat(94)}`;
    const controls = walletWorkersSection(address, [], {}, "6h", "raw", "h", "desc", false, 2, false);
    assert.match(controls, /window=6h&mode=raw&view=2&sort=name&dir=desc&dead=0/);
    assert.match(controls, /window=6h&mode=raw&view=2&sort=h&dir=asc&dead=0/);
    assert.match(controls, />Dead</);
    assert.match(controls, /view=list&sort=name&dir=asc&dead=0/);

    const mobileDefaultControls = walletWorkersSection(address, [], {}, "6h", "xmr", "h", "desc", false, 1, true);
    assert.match(mobileDefaultControls, /aria-current=page>1</);
    assert.match(mobileDefaultControls, /window=6h&mode=xmr&view=3&sort=h&dir=desc/);
    assert.match(mobileDefaultControls, /window=6h&mode=xmr&view=4&sort=h&dir=desc/);
    assert.match(mobileDefaultControls, /window=6h&mode=xmr&view=5&sort=h&dir=desc/);
  });

  test("explainer copy covers required terms", () => {
    assert.match(EXPLANATIONS.normalizedHashrate, /XMR-normalized/);
    assert.match(EXPLANATIONS.currentHashrate, /10-minute/);
    assert.match(EXPLANATIONS.currentHashrate, /XMR-normalized/);
    assert.match(EXPLANATIONS.hashScalar, /profit per hash/);
    assert.match(EXPLANATIONS.rawHashrate, /Raw hashrate/);
    assert.match(EXPLANATIONS.xmrPayouts, /XTM\/Tari/);
    assert.match(EXPLANATIONS.payoutPolicy, /threshold/);
  });
});
