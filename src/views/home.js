import { api } from "../api.js";
import { byId, qsa, tog } from "../dom.js";
import { encodeUrlPart, shortAddress } from "../format.js";
import { dismissMotd, normalizeMotd, shouldShowMotd } from "../motd.js";
import { isXmrAddress } from "../routes.js";
import { getCache, state } from "../state.js";
import { localHistoryEnabled, saveWallet } from "../privacy.js";
import { UNKNOWN_UPTIME, summarizeUptimeRobot, uptimeToneClass } from "../uptime.js";
import { bindChartHover, chartHtml, hashrateChart } from "./charts.js";
import { chipLink, escapeHtml, graphControls, recover, skel } from "./common.js";
import { poolDashboard } from "./pool-dashboard.js";
import { walletRouteWithGraph, lastShareAgeSuffix, walletKpis, workerList } from "./wallet.js";

export async function homeView(route = state.r) {
  const focusedAddress = route.n === "wallet" ? route.a : "";
  const focusedValid = focusedAddress ? isXmrAddress(focusedAddress) : true;
  if (focusedAddress && focusedValid) {
    state.a = focusedAddress;
    state.w = saveWallet(focusedAddress);
  }
  const graphWindow = route.q?.window || state.gw;
  const graphMode = route.q?.mode || state.gm;
  state.gw = graphWindow;
  state.gm = graphMode;
  const [pool, network] = await Promise.all([
    api.poolStats(),
    api.networkStats()
  ]);
  state.p = Number(pool.pplnsWindowTime) || 0;
  const poolChartRows = getCache("pool/chart/hashrate");
  const motd = normalizeMotd(getCache("pool/motd") || {});

  return `
    <div class="grid">
      ${poolDashboard(pool, network, cachedUptime())}
      ${poolHashrateChart(poolChartRows, graphWindow)}
      ${motdSlot(motd)}
      ${dashboardGraphControls(graphWindow, graphMode)}
      <div id=wallet-list class=wallet-list>
        ${state.w.length ? await walletSummaryCards() : `<div class="card muted">No wallets tracked yet.</div>`}
      </div>
      <div class="card wallet-track-card">
        <form id="af" class="address-bar">
          <label class="screen-reader-only" for="ai">XMR wallet address</label>
          <input id=ai autocomplete=off placeholder="Paste XMR wallet address" value="">
          <button type=submit data-wallet-submit>${walletTrackButtonLabel()}</button>
        </form>
        ${focusedAddress && !focusedValid ? `<p class="red explanation">Invalid wallet address. Paste a complete XMR payout address.</p>` : ""}
      </div>
    </div>`;
}

export function bindHomeUptime() {
  const node = byId("up");
  if (!node) return;
  setTimeout(() => api.uptimeStatus().then((data) => {
    if (node.isConnected) setUptimeNode(node, summarizeUptimeRobot(data));
  }).catch(() => {}), 2500);
}

export function bindHomeDeferred() {
  const chart = byId("pch");
  if (chart) setTimeout(() => api.poolChart().then((rows) => {
    if (!chart.isConnected || state.r.n !== "home") return;
    if (!Array.isArray(rows) || !rows.length) return;
    chart.outerHTML = poolHashrateChart(rows, state.gw);
    bindChartHover();
  }).catch(() => {}), 700);
  const motd = byId("mtd");
  if (motd) setTimeout(() => api.motd().then((data) => {
    if (!motd.isConnected || state.r.n !== "home") return;
    setMotdSlot(motd, normalizeMotd(data));
  }).catch(() => {}), 900);
}

function cachedUptime() {
  const cached = getCache("uptimerobot/status");
  return cached ? summarizeUptimeRobot(cached) : UNKNOWN_UPTIME;
}

function setUptimeNode(node, uptime) {
  node.className = `status-link ${uptimeToneClass(uptime.tone)}`;
  node.title = uptime.detail;
}

export function walletTrackButtonLabel(historyEnabled = localHistoryEnabled()) { return historyEnabled ? "Track wallet" : "Temporary track wallet"; }

export function syncWalletTrackButtonLabels(root = document) {
  qsa("[data-wallet-submit]", root).forEach((button) => {
    button.textContent = walletTrackButtonLabel();
  });
}

async function walletSummaryCards() {
  const rows = await Promise.all(state.w.map((row) => walletSummaryCard(row.address)));
  return rows.join("");
}

function dashboardGraphControls(graphWindow, graphMode) {
  return graphControls(dashboardGraphRoute, graphWindow, graphMode, "card graph-switches bar sbr");
}

function dashboardGraphRoute(graphWindow, graphMode) {
  return `#/?window=${graphWindow}&mode=${graphMode}`;
}

function poolHashrateChart(rows, graphWindow) {
  if (!Array.isArray(rows) || !rows.length) return `<section id=pch class=panel><div class="card chart-placeholder">${skel("Loading pool hashrate chart")}</div></section>`;
  const graph = hashrateChart(rows, graphWindow, "hsh");
  return `<section id=pch class=panel>
    <div class=card>${chartHtml(graph.m, graph.l, graph.r, graph.a, "Pool-wide hashrate chart")}</div>
  </section>`;
}

function motdSlot(motd) {
  const html = motdCard(motd);
  return `<div id="mtd"${html ? "" : " class=\"hidden\""}>${html}</div>`;
}

function setMotdSlot(node, motd) {
  const html = motdCard(motd);
  tog(node, "hidden", !html);
  node.innerHTML = html;
  const button = node.querySelector("[data-dismiss-motd]");
  if (button) button.addEventListener("click", (event) => {
    dismissMotd(event.currentTarget.dataset.dismissMotd, { persist: localHistoryEnabled() });
    event.currentTarget.closest(".motd-card")?.remove();
    tog(node, "hidden", true);
  });
}

function motdCard(motd) {
  if (!shouldShowMotd(motd, { persist: localHistoryEnabled() })) return "";
  const title = motd.subject || "Pool notice";
  return `<section class="panel motd-card" data-motd-key="${escapeHtml(motd.key)}">
    <div class=panel-header>
      <div>
        <h2>${escapeHtml(title)}</h2>
      </div>
      <button class="motd-dismiss" data-dismiss-motd="${escapeHtml(motd.key)}" aria-label="Dismiss pool notice until it changes" title="Dismiss until updated">🗑</button>
    </div>
    <div class=card><p class=motd-copy>${escapeHtml(motd.body)}</p></div>
  </section>`;
}

async function walletSummaryCard(address) {
  const [stats, chartRows, workers] = await Promise.all([
    recover(api.wallet(address), {}),
    recover(api.walletChart(address), []),
    recover(api.walletWorkers(address), {})
  ]);
  const workerRows = workerList(workers);
  const key = state.gm === "raw" ? "hsh" : "hsh2";
  const graph = hashrateChart(chartRows, state.gw, key);
  return `
    <article class="wallet-summary panel" id="wallet-${escapeHtml(address)}" data-wallet-address="${escapeHtml(address)}">
      <div class="panel-header wallet-header">
        <div>
          <div class="wallet-title-row">
            <h1><a class="wallet-title-link" href="${walletRouteWithGraph(address, "overview", state.gw, state.gm)}">${shortAddress(address)}</a></h1>
            ${lastShareAgeSuffix(stats)}
            ${chipLink("Setup", `#/setup?addr=${encodeUrlPart(address)}`, false, `title="Open setup commands for this wallet"`)}
          </div>
        </div>
        <button class="wallet-remove" data-remove-wallet="${escapeHtml(address)}" aria-label="Remove wallet ${escapeHtml(shortAddress(address))}" title="Remove wallet">🗑</button>
      </div>
      <div class="card grid kpi-grid wallet-kpi-grid">
        ${walletKpis(stats, workerRows.length, stats.hash2 || stats.hash || 0)}
      </div>
      <div class=card>${graph.p.length ? chartHtml(graph.m, graph.l, graph.r, graph.a, "Wallet hashrate chart") : `<p class=muted>No wallet graph data yet.</p>`}</div>
    </article>
  `;
}
