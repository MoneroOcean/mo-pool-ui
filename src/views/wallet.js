import { api } from "../api.js";
import { EXPLANATIONS, XMR_PORT } from "../constants.js";
import { atomicXmr, formatAge, formatDate, formatHashrate, formatNumber, normalizeTimestampSeconds, shortAddress } from "../format.js";
import { coinName } from "../pool.js";
import { walletRoute, isXmrAddress } from "../routes.js";
import { formatPayoutThresholdInput, normalizePayoutPolicy, payoutFeeText, payoutPolicyFromConfig, payoutThresholdFromAtomic, validatePayoutThreshold } from "../settings.js";
import { state } from "../state.js";
import { UNKNOWN_UPTIME, summarizeUptimeRobot } from "../uptime.js";
import { saveWallet } from "../privacy.js";
import { compactWorkerRows, sortWorkerListRows, sortWorkerRows, workerDisplayMode, workerGraphColumns, workerListSortMode, workerSortDirection, workerSortMode } from "../wallet.js";
import { MAX_ROUTE_PAGE, blockPageSize, pageCountFor, routePageNumber } from "../paging.js";
import { nextSortDirection, nextSortDirectionForKey } from "../table-sort.js";
import { attr, on, qs } from "../dom.js";
import { activeAttr, blockHashLink, cellHtml, chipLink, coinCell, dateCell, escapeHtml, formatAtomicXmrValue, graphControls, kpi, linkLabel, pageSizeSelect, pagerNav, paymentHashLink, recover, tablePage } from "./common.js";
import { chartHtml, hashrateChart, normalizeGraph } from "./charts.js";
import { poolDashboard } from "./pool-dashboard.js";

const BLOCK_REWARD_HELP = "Per-block PPLNS rewards. Hashes link to share dump CSVs.";
const EMAIL_ALERTS_HELP = "Toggle alerts; replace with Current/New email.";
const OVERVIEW_TAB = "overview";
const BLOCK_REWARDS_TAB = "rewards";
const WITHDRAWALS_TAB = "withdrawals";
const THRESHOLD_TAB = "payout";
const EMAIL_ALERTS_TAB = "alerts";
const WORKER_COLUMNS = [
  ["Worker", "name"],
  ["Algo", "algo"],
  ["XMR", "xmr"],
  ["Raw", "raw"],
  ["Avg XMR", "avg"],
  ["Avg Raw", "avgraw"],
  ["Last", "last"],
  ["Valid", "valid"],
  ["Invalid", "invalid"],
  ["Hashes", "hashes"]
];
let workerMode = 0;
let workerShowDead = true;

export async function walletView(route) {
  const address = route.a;
  if (!isXmrAddress(address)) return `<section class=panel><div class=card><h1>Invalid wallet address</h1><p class=muted>Paste a complete XMR payout address.</p></div></section>`;
  state.a = address;
  state.w = saveWallet(address);
  const graphWindow = route.q?.window || state.gw;
  const graphMode = route.q?.mode || state.gm;
  state.gw = graphWindow;
  state.gm = graphMode;
  workerMode = workerDisplayMode(route.q?.view);
  workerShowDead = route.q?.dead !== "0";
  const workerSort = workerMode === "list" ? workerListSortMode(route.q?.sort) : workerSortMode(route.q?.sort);
  const workerDir = workerMode === "list" && workerSort === "name" && !route.q?.dir ? "asc" : workerSortDirection(route.q?.dir);
  const graphDetails = route.q?.stats === "1";
  const pages = walletPages(route.q || {});
  const activeTab = route.t || OVERVIEW_TAB;
  const results = await fetchWalletPanels(address, activeTab, pages);
  const detailBody = walletDetailBody(activeTab, results, address, graphWindow, graphMode, workerSort, workerDir, graphDetails, pages);
  const overviewExtras = activeTab === OVERVIEW_TAB
    ? `<div class="card graph-switches">${walletGraphControls(address, graphWindow, graphMode, workerSort, workerDir, graphDetails)}</div>${walletWorkersSection(address, results.workers, results.workerCharts, graphWindow, graphMode, workerSort, workerDir, graphDetails)}`
    : "";
  return `
    <div class="grid">
      ${results.poolBlock}
      <section class="wallet-block panel" id="wallet-${escapeHtml(address)}" data-wallet-address="${escapeHtml(address)}">
        <div class="panel-header wallet-header">
          <div>
            <h1>${shortAddress(address)}${lastShareAgeSuffix(results.walletStats)}</h1>
          </div>
          <div class="wallet-actions">
            <nav class="tabs inline-tabs" aria-label="Wallet detail views">
              ${walletDetailTabs(address, route.t || OVERVIEW_TAB, graphWindow, graphMode, workerSort, workerDir, graphDetails)}
            </nav>
          </div>
        </div>
        ${detailBody}
      </section>
      ${overviewExtras}
    </div>
  `;
}

function walletPages(query) {
  return {
    withdrawalPage: routePageNumber(query.wpage),
    withdrawalLimit: blockPageSize(query.wlimit),
    blockRewardPage: routePageNumber(query.rpage),
    blockRewardLimit: blockPageSize(query.rlimit)
  };
}

async function fetchWalletPanels(address, dataTab, pages) {
  const needsOverview = dataTab === OVERVIEW_TAB;
  const needsWithdrawals = dataTab === WITHDRAWALS_TAB;
  const needsSettings = dataTab === THRESHOLD_TAB || dataTab === EMAIL_ALERTS_TAB;
  const needsWalletStats = needsOverview || needsWithdrawals;
  const [poolData, networkData, uptimeData, configData, walletStats, userSettings, chartRows, workers, workerCharts, payments, blockPayments] = await Promise.all([
    recover(api.poolStats(), null),
    recover(api.networkStats(), null),
    recover(api.uptimeStatus(), null),
    needsSettings ? recover(api.config(), {}) : {},
    needsWalletStats ? recover(api.wallet(address), {}) : {},
    needsSettings ? recover(api.userSettings(address), {}) : {},
    needsOverview ? recover(api.walletChart(address), []) : [],
    needsOverview ? recover(api.walletWorkers(address), {}) : {},
    needsOverview ? recover(api.walletWorkerCharts(address), {}) : {},
    needsWithdrawals ? recover(api.walletPayments(address, pages.withdrawalPage - 1, pages.withdrawalLimit), []) : [],
    dataTab === BLOCK_REWARDS_TAB ? recover(api.walletBlockPayments(address, pages.blockRewardPage - 1, pages.blockRewardLimit), []) : []
  ]);
  const poolStats = poolData || {};
  const networkStats = networkData || {};
  const graphPoints = normalizeGraph(chartRows.length ? chartRows : walletStats);
  const poolBlock = poolData && networkData
    ? poolDashboardWithWindow(poolStats, networkStats, uptimeData)
    : `<section class=panel><div class="card muted">Pool dashboard temporarily unavailable.</div></section>`;
  return {
    poolBlock,
    poolStats,
    payoutPolicy: payoutPolicyFromConfig(configData),
    walletStats,
    userSettings,
    workers: workerList(workers, workerCharts),
    workerCharts,
    payments,
    blockPayments,
    graphPoints
  };
}

function poolDashboardWithWindow(poolStats, networkStats, uptimeData) {
  state.p = Number(poolStats.pplnsWindowTime) || 0;
  const uptime = uptimeData
    ? summarizeUptimeRobot(uptimeData)
    : UNKNOWN_UPTIME;
  return poolDashboard(poolStats, networkStats, uptime);
}

function walletDetailBody(tab, data, address, graphWindow, graphMode, workerSort, workerDir, graphDetails, pages) {
  if (tab === WITHDRAWALS_TAB) return walletWithdrawalsPanel(address, data.walletStats, graphWindow, graphMode, workerSort, workerDir, graphDetails, data.payments, pages.withdrawalPage, pages.withdrawalLimit, pages.blockRewardPage, pages.blockRewardLimit);
  if (tab === BLOCK_REWARDS_TAB) return walletBlockRewardsPanel(address, data.poolStats, graphWindow, graphMode, workerSort, workerDir, graphDetails, data.blockPayments, pages.blockRewardPage, pages.blockRewardLimit, pages.withdrawalPage, pages.withdrawalLimit);
  if (tab === THRESHOLD_TAB) return paymentThresholdPanel(address, data.userSettings, data.payoutPolicy);
  if (tab === EMAIL_ALERTS_TAB) return emailAlertsPanel(address, data.userSettings);
  const graph = hashrateChart(data.graphPoints, graphWindow, graphMode === "raw" ? "hsh" : "hsh2");
  return walletOverview(data.walletStats, data.workers, graph, address, graphWindow, graphMode, workerSort, workerDir, graphDetails);
}

function walletDetailTabs(address, activeTab, graphWindow, graphMode, workerSort, workerDir, graphDetails) {
  const tabs = [
    [OVERVIEW_TAB, "Overview", "Wallet balance, pool-side hashrate, total graph, worker graphs."],
    [BLOCK_REWARDS_TAB, "Rewards", BLOCK_REWARD_HELP],
    [WITHDRAWALS_TAB, "Withdrawals", EXPLANATIONS.payoutPolicy],
    [THRESHOLD_TAB, "Payout", EXPLANATIONS.payoutPolicy],
    [EMAIL_ALERTS_TAB, "Alerts", "Manage email notices."]
  ];
  const active = activeTab;
  // The magnifier is visually paired with Overview because the extra total
  // hashes/share lines only exist on overview graphs. On other wallet tabs inline-tabs
  // still links back to Overview with details enabled, instead of implying that
  // table views have a hidden detail mode.
  const targetDetails = active === OVERVIEW_TAB ? !graphDetails : true;
  const detailsToggle = `<a href="${walletRouteWithGraph(address, OVERVIEW_TAB, graphWindow, graphMode, workerSort, workerDir, targetDetails)}" title="${active === OVERVIEW_TAB && graphDetails ? "Hide graph share stats" : "Show graph share stats"}" aria-pressed="${active === OVERVIEW_TAB && graphDetails}">🔍</a>`;
  return tabs.map(([tab, label, title]) => {
    const link = `<a href="${walletRouteWithGraph(address, tab, graphWindow, graphMode, workerSort, workerDir, graphDetails)}" title="${escapeHtml(title)}"${activeAttr(active === tab)}>${escapeHtml(label)}</a>`;
    return tab === OVERVIEW_TAB ? `<span>${detailsToggle}${link}</span>` : link;
  }).join("");
}

function walletOverview(stats, workers, graph, address, graphWindow, graphMode, workerSort, workerDir, graphDetails) {
  return `<section class=panel>
    <div class="card grid kpi-grid wallet-kpi-grid">
      ${walletKpis(stats, workers.length, stats.hash2 || stats.hash || graph.a, linkLabel("XMR total due", walletRouteWithGraph(address, THRESHOLD_TAB, graphWindow, graphMode, workerSort, workerDir, graphDetails)), linkLabel("XMR paid", walletRouteWithGraph(address, WITHDRAWALS_TAB, graphWindow, graphMode, workerSort, workerDir, graphDetails)))}
    </div>
    <div class=card>
      ${graph.p.length ? chartHtml(graph.m, graph.l, graph.r, graph.a, "Wallet hashrate chart", graphDetails ? miningStatsLine(stats) : "") : `<p class=muted>Graph appears after submitted shares. Backend samples every 2 minutes; points use a 10-minute window.</p>`}
    </div>
  </section>`;
}

function walletGraphControls(address, graphWindow, graphMode, workerSort, workerDir, graphDetails) {
  return graphControls((window, mode) => walletRouteWithGraph(address, OVERVIEW_TAB, window, mode, workerSort, workerDir, graphDetails), graphWindow, graphMode);
}

export function walletKpis(stats, workerCount, currentHashrate, dueLabel = "XMR total due", paidLabel = "XMR paid") {
  return `${kpi(dueLabel, formatAtomicXmrValue(stats.amtDue ?? stats.due ?? 0, 6), "Payment threshold is in wallet settings.")}
      ${kpi(paidLabel, formatAtomicXmrValue(stats.amtPaid ?? stats.paid ?? 0, 6), "Historical wallet payouts.")}
      ${kpi("Workers", formatNumber(workerCount), "Individual miner devices.")}
      ${kpi("Hashrate", formatHashrate(currentHashrate), EXPLANATIONS.currentHashrate)}`;
}

export function walletWorkersSection(address, workers, workerCharts, graphWindow, graphMode, workerSort, workerDir, graphDetails, displayMode = workerMode, showDead = workerShowDead) {
  const visibleWorkers = showDead ? workers : workers.filter((worker) => worker.status !== "Dead");
  if (displayMode === "list") return walletWorkerTable(address, visibleWorkers, graphWindow, graphMode, workerSort, workerDir, graphDetails, displayMode, showDead);
  const sorted = sortWorkerRows(visibleWorkers, workerSort, workerDir);
  const chartKey = graphMode === "raw" ? "hsh" : "hsh2";
  const nameDir = nextSortDirection(workerSort, workerDir, "name");
  const hashrateDir = nextSortDirection(workerSort, workerDir, "h");
  const cols = typeof displayMode === "number" ? displayMode : workerGraphColumns();
  const controls = `<div class=block-controls><div class=bar>${workerModeLinks(address, graphWindow, graphMode, workerSort, workerDir, graphDetails, cols, showDead)}</div><div class=bar>${chipLink(`Name${workerSort === "name" ? (workerDir === "asc" ? " ↑" : " ↓") : ""}`, walletRouteWithGraph(address, OVERVIEW_TAB, graphWindow, graphMode, "name", nameDir, graphDetails, cols, showDead), workerSort === "name")}${chipLink(`Hashrate${workerSort === "h" ? (workerDir === "asc" ? " ↑" : " ↓") : ""}`, walletRouteWithGraph(address, OVERVIEW_TAB, graphWindow, graphMode, "h", hashrateDir, graphDetails, cols, showDead), workerSort === "h")}</div></div>`;
  return `<section class=panel><div class=card>${controls}<div class="worker-graph-grid w${cols}">${sorted.map((worker) => workerGraphCard(worker, workerCharts?.[worker.n], chartKey, graphWindow, graphDetails)).join("") || `<div class=muted>No workers.</div>`}</div></div></section>`;
}

function walletWorkerTable(address, workers, graphWindow, graphMode, workerSort, workerDir, graphDetails, displayMode = workerMode, showDead = workerShowDead) {
  const sortable = workerListSortMode(workerSort);
  const direction = sortable === "name" && workerSort !== "name" ? "asc" : workerDir;
  const sorted = sortWorkerListRows(workers, sortable, direction);
  return tablePage("", "", workerTableHeadings(address, graphWindow, graphMode, sortable, direction, graphDetails, showDead), sorted.map(workerTableRow), workerModeControls(address, graphWindow, graphMode, sortable, direction, graphDetails, displayMode, showDead), "Workers", "No workers.");
}

function workerModeControls(address, graphWindow, graphMode, workerSort, workerDir, graphDetails, activeMode, showDead = workerShowDead) {
  return `<div class=block-controls><div class=bar>${workerModeLinks(address, graphWindow, graphMode, workerSort, workerDir, graphDetails, activeMode, showDead)}</div></div>`;
}

function workerModeLinks(address, graphWindow, graphMode, workerSort, workerDir, graphDetails, activeMode, showDead = workerShowDead) {
  const mode = activeMode || workerMode || workerGraphColumns();
  const deadLink = chipLink("Dead", walletRouteWithGraph(address, OVERVIEW_TAB, graphWindow, graphMode, workerSort, workerDir, graphDetails, mode, !showDead), showDead);
  return deadLink + ["list", 1, 2, 3].map((value) => {
    const sortable = value === "list" ? workerListSortMode(workerSort) : workerSortMode(workerSort);
    const direction = value === "list" && sortable === "name" && workerSort !== "name" ? "asc" : workerDir;
    return chipLink(value === "list" ? "List" : value, walletRouteWithGraph(address, OVERVIEW_TAB, graphWindow, graphMode, sortable, direction, graphDetails, value, showDead), mode === value);
  }).join("");
}

function workerTableHeadings(address, graphWindow, graphMode, active, direction, graphDetails, showDead = workerShowDead) {
  return WORKER_COLUMNS.map(([label, key]) => sortableWorkerHeading(label, key, address, graphWindow, graphMode, active, direction, graphDetails, showDead));
}

function sortableWorkerHeading(label, key, address, graphWindow, graphMode, active, direction, graphDetails, showDead = workerShowDead) {
  const selected = active === key;
  const firstDirection = { name: "asc", algo: "asc" };
  const next = nextSortDirectionForKey(active, direction, key, firstDirection);
  const arrow = selected ? (direction === "asc" ? " ↑" : " ↓") : "";
  return { html: `<a class="sortable" href="${walletRouteWithGraph(address, OVERVIEW_TAB, graphWindow, graphMode, key, next, graphDetails, "list", showDead)}">${escapeHtml(label)}${escapeHtml(arrow)}</a>` };
}

function workerTableRow(worker) {
  const row = [
    worker.n,
    worker.la || "--",
    formatHashrate(worker.xmr),
    formatHashrate(worker.raw),
    formatHashrate(worker.ax),
    formatHashrate(worker.ar),
    dateCell(worker.l),
    formatNumber(worker.vs),
    formatNumber(worker.is),
    formatNumber(worker.totalHashes)
  ];
  return worker.status === "Active" ? row : row.map(redCell);
}

function redCell(cell) {
  return { html: `<span class=red>${cellHtml(cell)}</span>` };
}

function workerGraphCard(worker, chartRows, chartKey, graphWindow, graphDetails) {
  const graph = hashrateChart(chartRows || [], graphWindow, chartKey);
  const zeroHashrate = Number(worker.r) <= 0;
  const inactive = worker.status !== "Active" || zeroHashrate;
  const statusTitle = worker.status;
  const workerName = inactive ? `<span class=red title="${escapeHtml(statusTitle)}">${escapeHtml(worker.n)}</span>` : escapeHtml(worker.n);
  const rate = `<span class=${inactive ? "red" : "muted"}${inactive ? ` title="${escapeHtml(statusTitle)}"` : ""}>${formatHashrate(worker.r)}</span>`;
  return `<article class=card><div class="worker-chart-header${zeroHashrate ? " red" : ""}"><h3>${workerName}${lastShareAgeSuffix(worker.l)}</h3>${rate}</div>${graph.p.length ? chartHtml(graph.m, graph.l, graph.r, graph.a, `${worker.n} worker hashrate chart`, graphDetails ? miningStatsLine(worker) : "") : `<p class=muted>No worker chart points.</p>`}</article>`;
}

export function walletRouteWithGraph(address, tab, window, mode, workerSort = "h", workerDir = "desc", graphDetails = false, cols = workerMode || workerGraphColumns(), showDead = workerShowDead) {
  const displayMode = workerDisplayMode(cols);
  const sortable = displayMode === "list" ? workerListSortMode(workerSort) : workerSortMode(workerSort);
  const direction = displayMode === "list" && sortable === "name" && workerSort !== "name" ? "asc" : workerSortDirection(workerDir);
  const graphMode = mode === "raw" ? "raw" : "xmr";
  return `${walletRoute(address, tab)}?window=${window}&mode=${graphMode}&view=${displayMode}&sort=${sortable}&dir=${direction}${showDead ? "" : "&dead=0"}${graphDetails ? "&stats=1" : ""}`;
}

function walletWithdrawalsPanel(address, stats, graphWindow, graphMode, workerSort, workerDir, graphDetails, withdrawals, withdrawalPage, withdrawalLimit, blockRewardPage, blockRewardLimit) {
  const withdrawalCount = Number(stats.txnCount) || 0;
  const withdrawalRows = withdrawals.map((pay) => [
    dateCell(pay.ts || pay.time || pay.timestamp),
    formatNumber(atomicXmr(pay.amount ?? pay.value ?? 0), 8),
    paymentHashLink(pay.txnHash || pay.hash || pay.txHash)
  ]);
  return walletPaymentTable("Withdrawals", ["Sent time","Amount (XMR)","Tx hash"], withdrawalRows, walletWithdrawalControls(address, graphWindow, graphMode, workerSort, workerDir, graphDetails, withdrawalPage, withdrawalLimit, withdrawals.length, withdrawalCount, blockRewardPage, blockRewardLimit));
}

function walletBlockRewardsPanel(address, pool, graphWindow, graphMode, workerSort, workerDir, graphDetails, blockRewards, blockRewardPage, blockRewardLimit, withdrawalPage, withdrawalLimit) {
  const annotatedRewards = annotateBlockRewards(blockRewards);
  const blockRewardRows = annotatedRewards.map((row) => [
    dateCell(row.p.ts || row.p.time || row.p.timestamp),
    dateCell(row.p.ts_found || row.p.found || row.p.ts || row.p.timestamp),
    blockRewardValueCell(row.p.value ?? row.p.xmr ?? 0, 8, row.s),
    blockRewardValueCell(row.p.value_percent ?? row.p.percent ?? 0, 8, row.s),
    coinCell(coinName(pool, row.p.port || XMR_PORT)),
    blockHashLink(row.p.hash || row.p.hash_pay)
  ]);
  const hasStaleTail = annotatedRewards.some((row) => row.s);
  return walletPaymentTable("Rewards", ["Pay time","Found time","Amount (XMR)","Block share (%)","Coin","Block hash"], blockRewardRows, walletBlockRewardControls(address, graphWindow, graphMode, workerSort, workerDir, graphDetails, blockRewardPage, blockRewardLimit, blockRewards.length, hasStaleTail, withdrawalPage, withdrawalLimit));
}

const BLOCK_REWARD_DETAIL_RETENTION_SECONDS = 2 * 24 * 60 * 60;
const STALE_BLOCK_REWARD_TITLE = "Old block detail likely DB-pruned; credited rewards are OK.";

function annotateBlockRewards(blockRewards, now = Date.now()) {
  // Backend block-balance detail is retained briefly. A trailing run of old
  // zero rows can mean detail was pruned rather than that the wallet got exactly
  // zero reward; mark only that stale tail so fresh zero rewards remain normal
  // table values.
  const annotated = blockRewards.map((pay) => {
    const amount = Number(pay.value ?? pay.xmr ?? 0);
    const share = Number(pay.value_percent ?? pay.percent ?? 0);
    const payTime = normalizeTimestampSeconds(pay.ts || pay.time || pay.timestamp);
    const isOld = payTime > 0 && now / 1000 - payTime > BLOCK_REWARD_DETAIL_RETENTION_SECONDS;
    return { p: pay, n: amount !== 0 || share !== 0, o: isOld, s: false };
  });
  let hasNonZeroAfter = false;
  for (let index = annotated.length - 1; index >= 0; index -= 1) {
    const row = annotated[index];
    row.s = !row.n && row.o && !hasNonZeroAfter;
    if (row.n) hasNonZeroAfter = true;
  }
  return annotated;
}

function blockRewardValueCell(value, digits, stalePruned) {
  const number = Number(value);
  const text = formatNumber(number, digits);
  if (number !== 0) return text;
  if (!stalePruned) return text;
  return { html: `<span class=red title="${escapeHtml(STALE_BLOCK_REWARD_TITLE)}">${escapeHtml(text)}</span>` };
}

function walletPaymentTable(title, headings, rows, controls) {
  return tablePage("", "", headings, rows, controls, title, "No rows found.");
}

function walletWithdrawalControls(address, graphWindow, graphMode, workerSort, workerDir, graphDetails, page, limit, rowCount, totalCount, blockRewardPage, blockRewardLimit) {
  const pageCount = pageCountFor(totalCount, limit);
  const hasNext = page < pageCount || (!totalCount && rowCount >= limit);
  return walletPager("ww", page, limit, pageCount, hasNext, (nextPage, nextLimit) => walletPaymentRouteFor(address, WITHDRAWALS_TAB, graphWindow, graphMode, workerSort, workerDir, graphDetails, nextPage, nextLimit, blockRewardPage, blockRewardLimit), true, EXPLANATIONS.payoutPolicy);
}

function walletBlockRewardControls(address, graphWindow, graphMode, workerSort, workerDir, graphDetails, page, limit, rowCount, hasStaleTail, withdrawalPage, withdrawalLimit) {
  const hasNext = page < MAX_ROUTE_PAGE && rowCount >= limit && !hasStaleTail;
  return walletPager("wr", page, limit, 0, hasNext, (nextPage, nextLimit) => walletPaymentRouteFor(address, BLOCK_REWARDS_TAB, graphWindow, graphMode, workerSort, workerDir, graphDetails, withdrawalPage, withdrawalLimit, nextPage, nextLimit), false, BLOCK_REWARD_HELP);
}

function walletPager(kind, page, limit, pageCount, hasNext, routeFor, canEditPage = true, explanation = "") {
  return `<div class="wallet-pager-top"${explanation ? ` title="${escapeHtml(explanation)}"` : ""}>
    ${explanation ? `<p class="wallet-pager-note explanation comments-controlled">${escapeHtml(explanation)}</p>` : ""}
    <div class="page-tools wallet-pager-tools">
      ${pageSizeSelect(`${kind}-page-size`, limit)}
      ${pagerNav(`${kind} pages`, `${kind}-page-input`, page, pageCount, hasNext, routeFor, limit, canEditPage)}
    </div>
  </div>`;
}

function walletPaymentRouteFor(address, tab, graphWindow, graphMode, workerSort, workerDir, graphDetails, withdrawalPage, withdrawalLimit, blockRewardPage, blockRewardLimit) {
  // Wallet table paging shares one route so switching between withdrawals and
  // block rewards preserves the other table's page size.
  let params = `window=${graphWindow}&mode=${graphMode}&view=${workerMode || workerGraphColumns()}&sort=${workerSort}&dir=${workerDir}`;
  if (!workerShowDead) params += "&dead=0";
  if (graphDetails) params += "&stats=1";
  if (withdrawalPage > 1) params += `&wpage=${withdrawalPage}`;
  params += `&wlimit=${blockPageSize(withdrawalLimit)}`;
  if (blockRewardPage > 1) params += `&rpage=${blockRewardPage}`;
  params += `&rlimit=${blockPageSize(blockRewardLimit)}`;
  return `${walletRoute(address, tab)}?${params}`;
}

export function walletPaymentRoute(overrides = {}) {
  const route = state.r;
  const query = route.q || {};
  return walletPaymentRouteFor(
    route.a,
    route.t === BLOCK_REWARDS_TAB ? BLOCK_REWARDS_TAB : WITHDRAWALS_TAB,
    query.window || state.gw,
    query.mode || state.gm,
    workerSortMode(query.sort),
    workerSortDirection(query.dir),
    query.stats === "1",
    overrides.withdrawalPage ?? routePageNumber(query.wpage),
    overrides.withdrawalLimit ?? blockPageSize(query.wlimit),
    overrides.blockRewardPage ?? routePageNumber(query.rpage),
    overrides.blockRewardLimit ?? blockPageSize(query.rlimit)
  );
}

function paymentThresholdPanel(address, settings, payoutPolicy) {
  const policy = normalizePayoutPolicy(payoutPolicy);
  if (!policy) return `<section class="panel settings-grid"><div class="card settings-card"><p class="settings-status red">Payout policy unavailable from API.</p></div></section>`;
  const threshold = payoutThresholdFromAtomic(settings.payout_threshold, policy);
  const thresholdText = formatPayoutThresholdInput(threshold, policy);
  const minimumThreshold = formatPayoutThresholdInput(policy.minimumThreshold, policy);
  return `<section class="panel settings-grid">
    <form id="payout-form" class="card settings-card" data-wallet-address="${escapeHtml(address)}" data-payout-policy="${escapeHtml(JSON.stringify(policy))}" title="${escapeHtml(`Minimum threshold is ${minimumThreshold} XMR. ${EXPLANATIONS.payoutPolicy}`)}">
      <label class="settings-field-title" for="payout-input">Current payment threshold (XMR)</label>
      <div class="settings-row payout-row">
        <input id=payout-input inputmode=decimal autocomplete=off value="${escapeHtml(thresholdText)}" aria-describedby=payout-fee>
        <button id=payout-submit type=submit>Update</button>
      </div>
      <p id=payout-fee class=muted title="Estimated XMR tx fee from pool policy. Higher thresholds reduce relative fee.">${escapeHtml(payoutFeeText(threshold, policy))}</p>
      <p class="muted explanation comments-controlled">Minimum threshold is ${minimumThreshold} XMR. ${EXPLANATIONS.payoutPolicy}</p>
      <p id=payout-status class="settings-status muted" role=status></p>
    </form>
  </section>`;
}

function emailAlertsPanel(address, settings) {
  const ee = Number(settings.email_enabled) === 1;
  return `<section class="panel settings-grid">
    <form id="email-form" class="card settings-card" data-wallet-address="${escapeHtml(address)}" title="${EMAIL_ALERTS_HELP}">
      <div class="settings-row payout-row">
        <button id=email-toggle class=state-button type=submit data-email-action=toggle data-email-enabled="${ee ? "0" : "1"}" aria-pressed="${ee}" title="${ee ? "Disable email alerts" : "Enable email alerts"}">Email alerts: ${ee ? "Enabled" : "Disabled"}</button>
      </div>
      <label for="email-current">Current email</label>
      <input id=email-current type=email autocomplete=email placeholder=old@example.com>
      <label for="email-new">New email</label>
      <input id=email-new type=email autocomplete=email placeholder=new@example.com>
      <div class=bar>
        <button type=submit data-email-action=change data-email-enabled=1>Change email</button>
      </div>
      <p class="muted explanation comments-controlled">${EMAIL_ALERTS_HELP}</p>
      <p id=email-status class="settings-status muted" role=status></p>
    </form>
  </section>`;
}

export function workerList(data, charts = {}, now = Date.now()) {
  return compactWorkerRows(data, charts, now);
}

export function lastShareAgeSuffix(source, now = Date.now()) {
  const ts = normalizeTimestampSeconds(source && typeof source === "object" ? source.lastHash ?? source.lastShare ?? source.lts ?? source.last ?? source.l : source);
  if (!ts || now / 1000 - ts <= 180) return "";
  return ` <span class=last-share-age title="${escapeHtml(formatDate(ts))}">(${escapeHtml(formatAge(ts, now))})</span>`;
}

function miningStatsLine(stats = {}) {
  const total = stats.totalHashes ?? stats.th ?? stats.totalHash ?? stats.hashes ?? 0;
  const valid = stats.vs ?? stats.validShares ?? stats.valid ?? stats.shares ?? stats.s ?? 0;
  const invalid = stats.is ?? stats.invalidShares ?? stats.invalid ?? stats.badShares ?? stats.bad_shares ?? 0;
  return [`Last algo ${stats.la || stats.lastShareAlgo || "--"}`, `Total hashes ${formatNumber(total)}`, `Valid shares ${formatNumber(valid)}`, `Invalid shares ${formatNumber(invalid)}`];
}

export function bindSettingsForms() {
  const thresholdForm = qs("#payout-form");
  const thresholdInput = qs("#payout-input");
  const thresholdButton = qs("#payout-submit");
  const feeLabel = qs("#payout-fee");
  const thresholdStatus = qs("#payout-status");
  const payoutPolicy = thresholdForm?.dataset.payoutPolicy ? normalizePayoutPolicy(JSON.parse(thresholdForm.dataset.payoutPolicy)) : null;
  const updateFee = () => {
    if (feeLabel && thresholdInput) feeLabel.textContent = payoutFeeText(thresholdInput.value, payoutPolicy);
    const validation = validatePayoutThreshold(thresholdInput?.value, payoutPolicy);
    if (thresholdButton) thresholdButton.disabled = !validation.valid;
    if (thresholdStatus) {
      setSettingsStatus(thresholdStatus, validation.valid ? "" : validation.message, validation.valid ? "muted" : "red");
    }
  };
  on(thresholdInput, "input", updateFee);
  updateFee();
  on(thresholdForm, "submit", async (event) => saveThreshold(event, thresholdForm, thresholdInput, thresholdStatus, payoutPolicy, updateFee));
  bindEmailForm();
}

async function saveThreshold(event, thresholdForm, thresholdInput, thresholdStatus, payoutPolicy, updateFee) {
  event.preventDefault();
  const address = thresholdForm.dataset.walletAddress;
  const validation = validatePayoutThreshold(thresholdInput?.value, payoutPolicy);
  const threshold = validation.threshold;
  if (!validation.valid) {
    setSettingsStatus(thresholdStatus, validation.message, "red");
    return;
  }
  thresholdInput.value = formatPayoutThresholdInput(threshold, payoutPolicy);
  updateFee();
  setSettingsStatus(thresholdStatus, "Saving threshold...");
  try {
    const result = await api.updateThreshold(address, threshold);
    api.clearUserSettings(address);
    setSettingsStatus(thresholdStatus, result.msg || "Threshold updated.", "green");
  } catch (error) {
    setSettingsStatus(thresholdStatus, error.message || "Threshold update failed.", "red");
  }
}

function bindEmailForm() {
  const emailForm = qs("#email-form");
  const emailStatus = qs("#email-status");
  on(emailForm, "submit", async (event) => {
    event.preventDefault();
    const submitter = event.submitter;
    const enabled = submitter?.dataset.emailEnabled === "1" ? 1 : 0;
    const action = submitter?.dataset.emailAction || "change";
    const address = emailForm.dataset.walletAddress;
    const from = action === "toggle" ? "" : qs("#email-current")?.value.trim() || "";
    const to = action === "toggle" ? "" : qs("#email-new")?.value.trim() || "";
    setSettingsStatus(emailStatus, "Saving email preferences...");
    try {
      const result = await api.subscribeEmail(address, enabled, from, to);
      api.clearUserSettings(address);
      setSettingsStatus(emailStatus, result.msg || "Email preferences updated.", "green");
      syncEmailToggle(enabled);
    } catch (error) {
      setSettingsStatus(emailStatus, error.message || "Email update failed.", "red");
    }
  });
}

function setSettingsStatus(node, message, tone = "muted") {
  node.textContent = message;
  node.className = `settings-status ${tone === "muted" ? "muted" : tone}`;
}

function syncEmailToggle(enabled) {
  const toggle = qs("#email-toggle");
  if (!toggle) return;
  toggle.textContent = `Email alerts: ${enabled ? "Enabled" : "Disabled"}`;
  toggle.dataset.emailEnabled = enabled ? "0" : "1";
  attr(toggle, "aria-pressed", String(Boolean(enabled)));
  attr(toggle, "title", enabled ? "Disable email alerts" : "Enable email alerts");
}
