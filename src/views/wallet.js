import { api } from "../api.js";
import { EXPLANATIONS, XMR_PORT } from "../constants.js";
import { atomicXmr, formatAge, formatDate, formatHashrate, formatNumber, normalizeTimestampSeconds, shortAddress } from "../format.js";
import { coinName } from "../pool.js";
import { walletRoute, isXmrAddress } from "../routes.js";
import { formatPayoutThresholdInput, normalizePayoutPolicy, payoutFeeText, payoutPolicyFromConfig, payoutThresholdFromAtomic, validatePayoutThreshold } from "../settings.js";
import { state } from "../state.js";
import { summarizeUptimeRobot } from "../uptime.js";
import { saveWallet } from "../privacy.js";
import { sortWorkerRows, workerGraphColumns, workerSortDirection, workerSortMode } from "../wallet.js";
import { MAX_ROUTE_PAGE, blockPageSize, pageCountFor, routePageNumber } from "../paging.js";
import { nextSortDirection } from "../table-sort.js";
import { attr, on, qs, qsa, tog } from "../dom.js";
import { activeAttr, blockHashLink, chipLink, coinCell, dateCell, escapeHtml, formatAtomicXmrValue, graphControls, kpi, linkLabel, pageSizeSelect, pagerNav, paymentHashLink, recover, tablePage } from "./common.js";
import { chartHtml, hashrateChart, normalizeGraph } from "./charts.js";
import { poolDashboard } from "./pool-dashboard.js";

const BLOCK_REWARD_HELP = "Per-block PPLNS rewards. Hashes link to share dump CSVs.";
const EMAIL_ALERTS_HELP = "Toggle alerts; replace with Current/New email.";
let workerCols = 0;

export async function walletView(route) {
  const address = route.a;
  if (!isXmrAddress(address)) return `<section class="pn"><div class="cd"><h1>Invalid wallet address</h1><p class="mt">Paste a complete XMR payout address.</p></div></section>`;
  state.a = address;
  state.w = saveWallet(address);
  const graphWindow = route.q?.w || state.gw;
  const graphMode = route.q?.m || state.gm;
  state.gw = graphWindow;
  state.gm = graphMode;
  const workerSort = workerSortMode(route.q?.s);
  const workerDir = workerSortDirection(route.q?.d);
  workerCols = workerGraphColumns(route.q?.c);
  const graphDetails = route.q?.x === "1";
  const pages = walletPages(route.q || {});
  const activeTab = route.t || "overview";
  const results = await fetchWalletPanels(address, activeTab, pages);
  const detailBody = walletDetailBody(activeTab, results, address, graphWindow, graphMode, workerSort, workerDir, graphDetails, pages);
  const overviewExtras = activeTab === "overview"
    ? `<div class="cd gs">${walletGraphControls(address, graphWindow, graphMode, workerSort, workerDir, graphDetails)}</div>${walletWorkersSection(address, results.wr, results.wc, graphWindow, graphMode, workerSort, workerDir, graphDetails)}`
    : "";
  return `
    <div class="gd">
      ${results.pb}
      <section class="wb pn" id="wallet-${escapeHtml(address)}" data-w="${escapeHtml(address)}">
        <div class="ph wh">
          <div>
            <h1>${shortAddress(address)}${lastShareAgeSuffix(results.st)}</h1>
          </div>
          <div class="wa">
            <nav class="tb it" aria-label="Wallet detail views">
              ${walletDetailTabs(address, route.t || "overview", graphWindow, graphMode, workerSort, workerDir, graphDetails)}
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
  return { wp: routePageNumber(query.wp), wl: blockPageSize(query.wl), bp: routePageNumber(query.bp), bl: blockPageSize(query.bl) };
}

async function fetchWalletPanels(address, dataTab, pages) {
  const needsOverview = dataTab === "overview";
  const needsWithdrawals = dataTab === "withdrawals";
  const needsSettings = dataTab === "payment-threshold" || dataTab === "email-alerts";
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
    needsWithdrawals ? recover(api.walletPayments(address, pages.wp - 1, pages.wl), []) : [],
    dataTab === "block-rewards" ? recover(api.walletBlockPayments(address, pages.bp - 1, pages.bl), []) : []
  ]);
  const poolStats = poolData || {};
  const networkStats = networkData || {};
  const graphPoints = normalizeGraph(chartRows.length ? chartRows : walletStats);
  const poolBlock = poolData && networkData
    ? poolDashboardWithWindow(poolStats, networkStats, uptimeData)
    : `<section class="pn"><div class="cd mt">Pool dashboard temporarily unavailable.</div></section>`;
  return {
    // Private wallet panel bundle: pb pool dashboard block, ps pool stats,
    // st wallet stats, se settings, wr worker rows, wc worker chart map,
    // pr withdrawals, br block rewards, gp graph points.
    pb: poolBlock,
    ps: poolStats,
    pp: payoutPolicyFromConfig(configData),
    st: walletStats,
    se: userSettings,
    wr: workerList(workers),
    wc: workerCharts,
    pr: payments,
    br: blockPayments,
    gp: graphPoints
  };
}

function poolDashboardWithWindow(poolStats, networkStats, uptimeData) {
  state.p = Number(poolStats.pplnsWindowTime) || 0;
  const uptime = uptimeData
    ? summarizeUptimeRobot(uptimeData)
    : { tone: "yellow", label: "Unknown", detail: "UptimeRobot status unavailable" };
  return poolDashboard(poolStats, networkStats, uptime);
}

function walletDetailBody(tab, data, address, graphWindow, graphMode, workerSort, workerDir, graphDetails, pages) {
  if (tab === "withdrawals") return walletWithdrawalsPanel(address, data.st, graphWindow, graphMode, workerSort, workerDir, graphDetails, data.pr, pages.wp, pages.wl, pages.bp, pages.bl);
  if (tab === "block-rewards") return walletBlockRewardsPanel(address, data.ps, graphWindow, graphMode, workerSort, workerDir, graphDetails, data.br, pages.bp, pages.bl, pages.wp, pages.wl);
  if (tab === "payment-threshold") return paymentThresholdPanel(address, data.se, data.pp);
  if (tab === "email-alerts") return emailAlertsPanel(address, data.se);
  const graph = hashrateChart(data.gp, graphWindow, graphMode === "raw" ? "hsh" : "hsh2");
  return walletOverview(data.st, data.wr, graph, address, graphWindow, graphMode, workerSort, workerDir, graphDetails);
}

function walletDetailTabs(address, activeTab, graphWindow, graphMode, workerSort, workerDir, graphDetails) {
  const tabs = [
    ["overview", "Overview", "Wallet balance, pool-side hashrate, total graph, worker graphs."],
    ["block-rewards", "Block rewards", BLOCK_REWARD_HELP],
    ["withdrawals", "XMR withdrawals", EXPLANATIONS.py],
    ["payment-threshold", "Payment threshold", EXPLANATIONS.py],
    ["email-alerts", "Email alerts", "Manage email notices."]
  ];
  const active = activeTab;
  // The magnifier is visually paired with Overview because the extra total
  // hashes/share lines only exist on overview graphs. On other wallet tabs it
  // still links back to Overview with details enabled, instead of implying that
  // table views have a hidden detail mode.
  const targetDetails = active === "overview" ? !graphDetails : true;
  const detailsToggle = `<a href="${walletRouteWithGraph(address, "overview", graphWindow, graphMode, workerSort, workerDir, targetDetails)}" title="${active === "overview" && graphDetails ? "Hide graph share stats" : "Show graph share stats"}" aria-pressed="${active === "overview" && graphDetails}">🔍</a>`;
  return tabs.map(([tab, label, title]) => {
    const link = `<a href="${walletRouteWithGraph(address, tab, graphWindow, graphMode, workerSort, workerDir, graphDetails)}" title="${escapeHtml(title)}"${activeAttr(active === tab)}>${escapeHtml(label)}</a>`;
    return tab === "overview" ? `<span>${detailsToggle}${link}</span>` : link;
  }).join("");
}

function walletOverview(stats, workers, graph, address, graphWindow, graphMode, workerSort, workerDir, graphDetails) {
  return `<section class="pn">
    <div class="cd gd kg">
      ${walletKpis(stats, workers.length, stats.hash2 || stats.hash || graph.a, linkLabel("XMR total due", walletRouteWithGraph(address, "payment-threshold", graphWindow, graphMode, workerSort, workerDir, graphDetails)), linkLabel("XMR paid", walletRouteWithGraph(address, "withdrawals", graphWindow, graphMode, workerSort, workerDir, graphDetails)))}
    </div>
    <div class="cd">
      ${graph.p.length ? chartHtml(graph.m, graph.l, graph.r, graph.a, "Wallet hashrate chart", graphDetails ? miningStatsLine(stats) : "") : `<p class="mt">Graph appears after submitted shares. Backend samples every 2 minutes; points use a 10-minute window.</p>`}
    </div>
  </section>`;
}

function walletGraphControls(address, graphWindow, graphMode, workerSort, workerDir, graphDetails) {
  return graphControls((window, mode) => walletRouteWithGraph(address, "overview", window, mode, workerSort, workerDir, graphDetails), graphWindow, graphMode);
}

export function walletKpis(stats, workerCount, currentHashrate, dueLabel = "XMR total due", paidLabel = "XMR paid") {
  return `${kpi(dueLabel, formatAtomicXmrValue(stats.amtDue ?? stats.due ?? 0), "Payment threshold is in wallet settings.")}
      ${kpi(paidLabel, formatAtomicXmrValue(stats.amtPaid ?? stats.paid ?? 0), "Historical wallet payouts.")}
      ${kpi("Workers", formatNumber(workerCount), "Individual miner devices.")}
      ${kpi("Current pool estimate", formatHashrate(currentHashrate), EXPLANATIONS.c)}`;
}

function walletWorkersSection(address, workers, workerCharts, graphWindow, graphMode, workerSort, workerDir, graphDetails) {
  const sorted = sortWorkerRows(workers, workerSort, workerDir);
  const chartKey = graphMode === "raw" ? "hsh" : "hsh2";
  const nameDir = nextSortDirection(workerSort, workerDir, "name");
  const hashrateDir = nextSortDirection(workerSort, workerDir, "h");
  const cols = workerCols || workerGraphColumns();
  return `<section class=pn><div class=cd><div class=bc><div class=br>${[1, 2, 3].map((count) => chipLink(count, walletRouteWithGraph(address, "overview", graphWindow, graphMode, workerSort, workerDir, graphDetails, count), cols === count)).join("")}</div><div class=br>${chipLink(`Name${workerSort === "name" ? (workerDir === "asc" ? " ↑" : " ↓") : ""}`, walletRouteWithGraph(address, "overview", graphWindow, graphMode, "name", nameDir, graphDetails), workerSort === "name")}${chipLink(`Hashrate${workerSort === "h" ? (workerDir === "asc" ? " ↑" : " ↓") : ""}`, walletRouteWithGraph(address, "overview", graphWindow, graphMode, "h", hashrateDir, graphDetails), workerSort === "h")}</div></div><div class="wgg w${cols}">${sorted.map((worker) => workerGraphCard(worker, workerCharts?.[worker.n], chartKey, graphWindow, graphDetails)).join("") || `<div class=mt>No workers found.</div>`}</div></div></section>`;
}

function workerGraphCard(worker, chartRows, chartKey, graphWindow, graphDetails) {
  const graph = hashrateChart(Array.isArray(chartRows) ? chartRows : [], graphWindow, chartKey);
  return `<article class=cd><div class=wch><h3>${escapeHtml(worker.n)}${lastShareAgeSuffix(worker.l)}</h3><span class=mt>${formatHashrate(worker.r)}</span></div>${graph.p.length ? chartHtml(graph.m, graph.l, graph.r, graph.a, `${worker.n} worker hashrate chart`, graphDetails ? miningStatsLine(worker) : "") : `<p class=mt>No worker chart points.</p>`}</article>`;
}

export function walletRouteWithGraph(address, tab, window, mode, workerSort = "h", workerDir = "desc", graphDetails = false, cols = workerCols || workerGraphColumns()) {
  return `${walletRoute(address, tab)}?w=${window}&m=${mode}&c=${cols}&s=${workerSort}&d=${workerDir}${graphDetails ? "&x=1" : ""}`;
}

function walletWithdrawalsPanel(address, stats, graphWindow, graphMode, workerSort, workerDir, graphDetails, withdrawals, withdrawalPage, withdrawalLimit, blockRewardPage, blockRewardLimit) {
  const withdrawalCount = Number(stats.txnCount) || 0;
  const withdrawalRows = withdrawals.map((pay) => [
    dateCell(pay.ts || pay.time || pay.timestamp),
    formatNumber(atomicXmr(pay.amount ?? pay.value ?? 0), 8),
    paymentHashLink(pay.txnHash || pay.hash || pay.txHash)
  ]);
  return walletPaymentTable("XMR withdrawals", ["Sent time","Amount (XMR)","Tx hash"], withdrawalRows, walletWithdrawalControls(address, graphWindow, graphMode, workerSort, workerDir, graphDetails, withdrawalPage, withdrawalLimit, withdrawals.length, withdrawalCount, blockRewardPage, blockRewardLimit));
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
  return walletPaymentTable("Block rewards", ["Pay time","Found time","Amount (XMR)","Block share (%)","Coin","Block hash"], blockRewardRows, walletBlockRewardControls(address, graphWindow, graphMode, workerSort, workerDir, graphDetails, blockRewardPage, blockRewardLimit, blockRewards.length, hasStaleTail, withdrawalPage, withdrawalLimit));
}

const BLOCK_REWARD_DETAIL_RETENTION_SECONDS = 2 * 24 * 60 * 60;
const STALE_BLOCK_REWARD_TITLE = "Old block detail likely DB-pruned; credited rewards are OK.";

function annotateBlockRewards(blockRewards, now = Date.now()) {
  // Backend block-balance detail is retained for a short period. A trailing run
  // of old zero rows can mean detail was pruned rather than that the wallet got
  // exactly zero reward; mark only that stale tail so fresh zero rewards remain
  // normal table values. Short keys keep this temporary annotation compact:
  // p payment row, n non-zero reward, o old enough for pruning, s stale-pruned.
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
  return { html: `<span class="red" title="${escapeHtml(STALE_BLOCK_REWARD_TITLE)}">${escapeHtml(text)}</span>` };
}

function walletPaymentTable(title, headings, rows, controls) {
  return tablePage("", "", headings, rows, controls, title, "No rows found.");
}

function walletWithdrawalControls(address, graphWindow, graphMode, workerSort, workerDir, graphDetails, page, limit, rowCount, totalCount, blockRewardPage, blockRewardLimit) {
  const pageCount = pageCountFor(totalCount, limit);
  const hasNext = page < pageCount || (!totalCount && rowCount >= limit);
  return walletPager("ww", page, limit, pageCount, hasNext, (nextPage, nextLimit) => walletPaymentRouteFor(address, "withdrawals", graphWindow, graphMode, workerSort, workerDir, graphDetails, nextPage, nextLimit, blockRewardPage, blockRewardLimit), true, EXPLANATIONS.py);
}

function walletBlockRewardControls(address, graphWindow, graphMode, workerSort, workerDir, graphDetails, page, limit, rowCount, hasStaleTail, withdrawalPage, withdrawalLimit) {
  const hasNext = page < MAX_ROUTE_PAGE && rowCount >= limit && !hasStaleTail;
  return walletPager("wr", page, limit, 0, hasNext, (nextPage, nextLimit) => walletPaymentRouteFor(address, "block-rewards", graphWindow, graphMode, workerSort, workerDir, graphDetails, withdrawalPage, withdrawalLimit, nextPage, nextLimit), false, BLOCK_REWARD_HELP);
}

function walletPager(kind, page, limit, pageCount, hasNext, routeFor, canEditPage = true, explanation = "") {
  return `<div class="wpto"${explanation ? ` title="${escapeHtml(explanation)}"` : ""}>
    ${explanation ? `<p class="wpe ex dx">${escapeHtml(explanation)}</p>` : ""}
    <div class="bpt wpt">
      ${pageSizeSelect(`${kind}-page-size`, limit)}
      ${pagerNav(`${kind} pages`, `${kind}-page-input`, page, pageCount, hasNext, routeFor, limit, canEditPage)}
    </div>
  </div>`;
}

function walletPaymentRouteFor(address, tab, graphWindow, graphMode, workerSort, workerDir, graphDetails, withdrawalPage, withdrawalLimit, blockRewardPage, blockRewardLimit) {
  // Wallet table paging shares one route so switching between withdrawals and
  // block rewards preserves the other table's page size. Query names stay long
  // and readable because users can see/bookmark them; only private DOM hooks are
  // abbreviated for build size.
  let params = `w=${graphWindow}&m=${graphMode}&c=${workerCols || workerGraphColumns()}&s=${workerSort}&d=${workerDir}`;
  if (graphDetails) params += "&x=1";
  if (withdrawalPage > 1) params += `&wp=${withdrawalPage}`;
  params += `&wl=${blockPageSize(withdrawalLimit)}`;
  if (blockRewardPage > 1) params += `&bp=${blockRewardPage}`;
  params += `&bl=${blockPageSize(blockRewardLimit)}`;
  return `${walletRoute(address, tab)}?${params}`;
}

export function walletPaymentRoute(overrides = {}) {
  const route = state.r;
  const query = route.q || {};
  return walletPaymentRouteFor(
    route.a,
    route.t === "block-rewards" ? "block-rewards" : "withdrawals",
    query.w || state.gw,
    query.m || state.gm,
    workerSortMode(query.s),
    workerSortDirection(query.d),
    query.x === "1",
    overrides.withdrawalPage ?? routePageNumber(query.wp),
    overrides.withdrawalLimit ?? blockPageSize(query.wl),
    overrides.blockRewardPage ?? routePageNumber(query.bp),
    overrides.blockRewardLimit ?? blockPageSize(query.bl)
  );
}

function paymentThresholdPanel(address, settings, pp) {
  const policy = normalizePayoutPolicy(pp);
  if (!policy) return `<section class="pn sgd"><div class="cd sgc"><p class="sst red">Payout policy unavailable from API.</p></div></section>`;
  const threshold = payoutThresholdFromAtomic(settings.payout_threshold, policy);
  const thresholdText = formatPayoutThresholdInput(threshold, policy);
  const minimumThreshold = formatPayoutThresholdInput(policy.m, policy);
  return `<section class="pn sgd">
    <form id="wpf" class="cd sgc" data-a="${escapeHtml(address)}" data-pp="${escapeHtml(JSON.stringify(policy))}" title="${escapeHtml(`Minimum threshold is ${minimumThreshold} XMR. ${EXPLANATIONS.py}`)}">
      <label class="sft" for="wpi">Current payment threshold (XMR)</label>
      <div class="sgr spr">
        <input id="wpi" inputmode="decimal" autocomplete="off" value="${escapeHtml(thresholdText)}" aria-describedby="wfee">
        <button id="wps" type="submit">Update</button>
      </div>
      <p id="wfee" class="mt" title="Estimated XMR tx fee from pool policy. Higher thresholds reduce relative fee.">${escapeHtml(payoutFeeText(threshold, policy))}</p>
      <p class="mt ex dx">Minimum threshold is ${minimumThreshold} XMR. ${EXPLANATIONS.py}</p>
      <p id="wpst" class="sst mt" role="status"></p>
    </form>
  </section>`;
}

function emailAlertsPanel(address, settings) {
  const ee = Number(settings.email_enabled) === 1;
  return `<section class="pn sgd">
    <form id="wef" class="cd sgc" data-a="${escapeHtml(address)}" title="${EMAIL_ALERTS_HELP}">
      <div class="sgr spr">
        <button id="wet" class="sb" type="submit" data-ea="toggle" data-ee="${ee ? "0" : "1"}" aria-pressed="${ee}" title="${ee ? "Disable email alerts" : "Enable email alerts"}">Email alerts: ${ee ? "Enabled" : "Disabled"}</button>
      </div>
      <label for="wefr">Current email</label>
      <input id="wefr" type="email" autocomplete="email" placeholder="old@example.com">
      <label for="weto">New email</label>
      <input id="weto" type="email" autocomplete="email" placeholder="new@example.com">
      <div class="br">
        <button type="submit" data-ea="change" data-ee="1">Change email</button>
      </div>
      <p class="mt ex dx">${EMAIL_ALERTS_HELP}</p>
      <p id="west" class="sst mt" role="status"></p>
    </form>
  </section>`;
}

export function workerList(data) {
  if (!data || typeof data !== "object") return [];
  return Object.entries(data).filter(([name]) => name !== "global").map(([name, rows]) => {
    const latest = Array.isArray(rows) ? rows[0] : rows?.stats?.[0] || rows;
    const validShares = latest?.valid ?? latest?.validShares ?? rows?.valid ?? rows?.validShares ?? 0;
    // Worker rows are private graph-card data: n name, r current hashrate,
    // l last-share timestamp, th total hashes, vs/is valid/invalid shares,
    // s compatibility share count for older wallet stat payloads.
    return {
      n: name,
      r: latest?.hsh2 || latest?.hsh || latest?.hash2 || latest?.hash || rows?.hash || 0,
      l: latest?.tme || latest?.ts || latest?.lts || latest?.lastShare || rows?.lastShare || rows?.lastHash || 0,
      th: latest?.totalHash ?? latest?.totalHashes ?? latest?.hashes ?? rows?.totalHash ?? rows?.totalHashes ?? rows?.hashes ?? 0,
      vs: validShares,
      is: latest?.invalid ?? latest?.invalidShares ?? rows?.invalid ?? rows?.invalidShares ?? 0,
      s: validShares
    };
  }).sort((a, b) => b.r - a.r);
}

export function lastShareAgeSuffix(source, now = Date.now()) {
  const ts = normalizeTimestampSeconds(source && typeof source === "object" ? source.lastHash ?? source.lastShare ?? source.lts ?? source.last ?? source.l : source);
  if (!ts || now / 1000 - ts <= 180) return "";
  return ` <span class=lsa title="${escapeHtml(formatDate(ts))}">(${escapeHtml(formatAge(ts, now))})</span>`;
}

function miningStatsLine(stats = {}) {
  const total = stats.th ?? stats.totalHashes ?? stats.totalHash ?? stats.hashes ?? 0;
  const valid = stats.vs ?? stats.validShares ?? stats.valid ?? stats.shares ?? stats.s ?? 0;
  const invalid = stats.is ?? stats.invalidShares ?? stats.invalid ?? stats.badShares ?? stats.bad_shares ?? 0;
  return [`Total hashes ${formatNumber(total)}`, `Valid shares ${formatNumber(valid)}`, `Invalid shares ${formatNumber(invalid)}`];
}

export function syncWalletTabsAlignment() {
  qsa(".wh").forEach((head) => {
    const title = head.firstElementChild;
    const actions = qs(".wa", head);
    if (!title || !actions) return;
    head.classList.remove("tbt");
    const titleRect = title.getBoundingClientRect();
    const actionsRect = actions.getBoundingClientRect();
    const isBelowTitle = actionsRect.left <= titleRect.right + 4;
    tog(head, "tbt", isBelowTitle);
  });
}

export function bindSettingsForms() {
  const thresholdForm = qs("#wpf");
  const thresholdInput = qs("#wpi");
  const thresholdButton = qs("#wps");
  const feeLabel = qs("#wfee");
  const thresholdStatus = qs("#wpst");
  const pp = thresholdForm?.dataset.pp ? normalizePayoutPolicy(JSON.parse(thresholdForm.dataset.pp)) : null;
  const updateFee = () => {
    if (feeLabel && thresholdInput) feeLabel.textContent = payoutFeeText(thresholdInput.value, pp);
    const validation = validatePayoutThreshold(thresholdInput?.value, pp);
    if (thresholdButton) thresholdButton.disabled = !validation.valid;
    if (thresholdStatus) {
      setSettingsStatus(thresholdStatus, validation.valid ? "" : validation.message, validation.valid ? "muted" : "red");
    }
  };
  on(thresholdInput, "input", updateFee);
  updateFee();
  on(thresholdForm, "submit", async (event) => saveThreshold(event, thresholdForm, thresholdInput, thresholdStatus, pp, updateFee));
  bindEmailForm();
}

async function saveThreshold(event, thresholdForm, thresholdInput, thresholdStatus, pp, updateFee) {
  event.preventDefault();
  const address = thresholdForm.dataset.a;
  const validation = validatePayoutThreshold(thresholdInput?.value, pp);
  const threshold = validation.threshold;
  if (!validation.valid) {
    setSettingsStatus(thresholdStatus, validation.message, "red");
    return;
  }
  thresholdInput.value = formatPayoutThresholdInput(threshold, pp);
  updateFee();
  setSettingsStatus(thresholdStatus, "Saving threshold...");
  try {
    const result = await api.updateThreshold(address, threshold);
    api.clearUserSettings(address);
    setSettingsStatus(thresholdStatus, result.msg || "Threshold updated.", "luck-green");
  } catch (error) {
    setSettingsStatus(thresholdStatus, error.message || "Threshold update failed.", "red");
  }
}

function bindEmailForm() {
  const emailForm = qs("#wef");
  const emailStatus = qs("#west");
  on(emailForm, "submit", async (event) => {
    event.preventDefault();
    const submitter = event.submitter;
    const enabled = submitter?.dataset.ee === "1" ? 1 : 0;
    const action = submitter?.dataset.ea || "change";
    const address = emailForm.dataset.a;
    const from = action === "toggle" ? "" : qs("#wefr")?.value.trim() || "";
    const to = action === "toggle" ? "" : qs("#weto")?.value.trim() || "";
    setSettingsStatus(emailStatus, "Saving email preferences...");
    try {
      const result = await api.subscribeEmail(address, enabled, from, to);
      api.clearUserSettings(address);
      setSettingsStatus(emailStatus, result.msg || "Email preferences updated.", "luck-green");
      syncEmailToggle(enabled);
    } catch (error) {
      setSettingsStatus(emailStatus, error.message || "Email update failed.", "red");
    }
  });
}

function setSettingsStatus(node, message, tone = "muted") {
  node.textContent = message;
  node.className = `sst ${tone === "muted" ? "mt" : tone}`;
}

function syncEmailToggle(enabled) {
  const toggle = qs("#wet");
  if (!toggle) return;
  toggle.textContent = `Email alerts: ${enabled ? "Enabled" : "Disabled"}`;
  toggle.dataset.ee = enabled ? "0" : "1";
  attr(toggle, "aria-pressed", String(Boolean(enabled)));
  attr(toggle, "title", enabled ? "Disable email alerts" : "Enable email alerts");
}
