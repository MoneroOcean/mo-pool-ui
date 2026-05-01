import { api } from "../api.js";
import { shortAddress } from "../format.js";
import { normalizeMotd, shouldShowMotd } from "../motd.js";
import { isXmrAddress } from "../routes.js";
import { state } from "../state.js";
import { localHistoryEnabled, saveWallet } from "../privacy.js";
import { summarizeUptimeRobot } from "../uptime.js";
import { chartHtml, hashrateChart } from "./charts.js";
import { chipLink, escapeHtml, graphControls, recover } from "./common.js";
import { poolDashboard } from "./pool-dashboard.js";
import { walletRouteWithGraph, lastShareAgeSuffix, walletKpis, workerList } from "./wallet.js";

export async function homeView(route = state.r) {
  const focusedAddress = route.n === "wallet" ? route.a : "";
  const focusedValid = focusedAddress ? isXmrAddress(focusedAddress) : true;
  if (focusedAddress && focusedValid) {
    state.a = focusedAddress;
    state.w = saveWallet(focusedAddress);
  }
  const graphWindow = route.q?.w || state.gw;
  const graphMode = route.q?.m || state.gm;
  state.gw = graphWindow;
  state.gm = graphMode;
  const [pool, network, uptimeData, poolChartRows, motdData] = await Promise.all([
    api.poolStats(),
    api.networkStats(),
    recover(api.uptimeStatus(), null),
    recover(api.poolChart(), []),
    recover(api.motd(), {})
  ]);
  state.p = Number(pool.pplnsWindowTime) || 0;
  const uptime = uptimeData ? summarizeUptimeRobot(uptimeData) : { tone: "yellow", label: "Unknown", detail: "UptimeRobot status unavailable" };
  const motd = normalizeMotd(motdData);

  return `
    <div class="gd">
      ${poolDashboard(pool, network, uptime)}
      ${poolHashrateChart(poolChartRows, graphWindow)}
      ${motdCard(motd)}
      ${dashboardGraphControls(graphWindow, graphMode)}
      <div id="wl" class="wl">
        ${state.w.length ? await walletSummaryCards() : `<div class="cd mt">No wallets tracked yet.</div>`}
      </div>
      <div class="cd wtc">
        <form id="af" class="ab">
          <label class="sro" for="ai">XMR wallet address</label>
          <input id="ai" autocomplete="off" placeholder="Paste XMR wallet address" value="">
          <button type="submit" data-ws>${walletTrackButtonLabel()}</button>
        </form>
        ${focusedAddress && !focusedValid ? `<p class="red ex">Invalid wallet address. Paste a complete XMR payout address.</p>` : ""}
      </div>
    </div>`;
}

export function walletTrackButtonLabel(historyEnabled = localHistoryEnabled()) { return historyEnabled ? "Track wallet" : "Temporary track wallet"; }

export function syncWalletTrackButtonLabels(root = document) {
  root.querySelectorAll("[data-ws]").forEach((button) => {
    button.textContent = walletTrackButtonLabel();
  });
}

async function walletSummaryCards() {
  const rows = await Promise.all(state.w.map((row) => walletSummaryCard(row.address)));
  return rows.join("");
}

function dashboardGraphControls(graphWindow, graphMode) {
  return graphControls(dashboardGraphRoute, graphWindow, graphMode, "cd gs br sbr");
}

function dashboardGraphRoute(graphWindow, graphMode) {
  const params = new URLSearchParams();
  params.set("w", graphWindow);
  params.set("m", graphMode);
  return `#/?${params.toString()}`;
}

function poolHashrateChart(rows, graphWindow) {
  const graph = hashrateChart(rows, graphWindow, "hsh");
  return `<section class="pn">
    <div class="cd">${graph.p.length ? chartHtml(graph.m, graph.l, graph.r, graph.a, "Pool-wide hashrate chart") : `<p class="mt">Pool-wide hashrate graph appears after backend history is available.</p>`}</div>
  </section>`;
}

function motdCard(motd) {
  if (!shouldShowMotd(motd, { persist: localHistoryEnabled() })) return "";
  const title = motd.subject || "Pool notice";
  return `<section class="pn mc" data-mk="${escapeHtml(motd.key)}">
    <div class="ph">
      <div>
        <h2>${escapeHtml(title)}</h2>
      </div>
      <button class="md" data-dm="${escapeHtml(motd.key)}" aria-label="Dismiss pool notice until it changes" title="Dismiss until updated">🗑</button>
    </div>
    <div class="cd"><p class="mcp">${escapeHtml(motd.body)}</p></div>
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
    <article class="ws pn" id="wallet-${escapeHtml(address)}" data-w="${escapeHtml(address)}">
      <div class="ph wh">
        <div>
          <div class="wtr">
            <h1><a class="wtl" href="${walletRouteWithGraph(address, "overview", state.gw, state.gm)}">${shortAddress(address)}</a></h1>
            ${lastShareAgeSuffix(stats)}
            ${chipLink("Setup", `#/setup?a=${encodeURIComponent(address)}`, false, `title="Open setup commands for this wallet"`)}
          </div>
        </div>
        <button class="wrm" data-rw="${escapeHtml(address)}" aria-label="Remove wallet ${escapeHtml(shortAddress(address))}" title="Remove wallet">🗑</button>
      </div>
      <div class="cd gd kg">
        ${walletKpis(stats, workerRows.length, stats.hash2 || stats.hash || 0)}
      </div>
      <div class="cd">${graph.p.length ? chartHtml(graph.m, graph.l, graph.r, graph.a, "Wallet hashrate chart") : `<p class="mt">No wallet graph data yet.</p>`}</div>
    </article>
  `;
}
