import { api } from "../api.js";
import { EXPLANATIONS, XMR_PORT } from "../constants.js";
import { formatHashrate, formatNumber, formatPercent, formatTinyPercent } from "../format.js";
import { coinHashScalar, coinStatsRows, effortPercent, worldHashrateForPort } from "../pool.js";
import { state } from "../state.js";
import { nextSortDirectionForKey, sortDirection, sortRows } from "../table-sort.js";
import { cellHtml, chipLink, coinCell, escapeHtml, explorerHeightLink, tablePage } from "./common.js";
import { blockRoute, effortCell } from "./blocks.js";

const COIN_SORT_KEYS = ["name", "algo", "profit", "effort", "reward", "wallets", "pool", "world", "height", "pplns", "notes"];
const COIN_TEXT_SORT_KEYS = { name: "asc", algo: "asc", notes: "asc" };

export async function coinsView() {
  const [pool, network] = await Promise.all([api.poolStats(), api.networkStats()]);
  const query = state.r.q || {};
  const showIssues = query.i === "1";
  const hideDisabled = query.h === "1";
  const sortKey = coinSortKey(query.s);
  const direction = sortDirection(query.d);
  const rows = coinRows(pool, network, showIssues, hideDisabled);
  const controls = coinControls(sortKey, direction, showIssues, hideDisabled);
  return tablePage("", "", coinHeadings(sortKey, direction, showIssues, hideDisabled), sortRows(rows, sortKey, direction).map(coinTableRow), controls);
}

function coinRows(pool, network, showIssues, hideDisabled) {
  return coinStatsRows(pool).map((coin) => {
    const port = coin.p;
    const net = network[port] || {};
    const exempt = isIssueExemptCoin(port);
    return {
      port,
      name: coin.n,
      algo: coin.a || "--",
      profit: coinHashScalar(pool, port),
      effort: effortPercent(pool, network, port),
      reward: rewardPercent(pool, port),
      wallets: coin.m,
      pool: coin.h,
      world: worldHashrateForPort(net, port, pool),
      height: Number(net.height) || 0,
      pplns: coin.ps * 100,
      notes: coin.dr || coin.c || "",
      configured: coin.ec,
      active: coin.ac,
      issue: !coin.ec,
      disabled: !coin.ac && !exempt,
      ok: coin.ec && (coin.ac || exempt)
    };
  }).filter((row) => (showIssues || !row.issue) && (!hideDisabled || !row.disabled));
}

function coinControls(sortKey, direction, showIssues, hideDisabled) {
  const inactive = chipLink(hideDisabled ? "Show inactive coins" : "Hide inactive coins", coinsRoute(sortKey, direction, showIssues, !hideDisabled));
  const issues = chipLink(showIssues ? "Hide disabled coins" : "Show disabled coins", coinsRoute(sortKey, direction, !showIssues, hideDisabled));
  return `<div title="${escapeHtml(EXPLANATIONS.h)}"><div class="br">${inactive}${issues}</div><p class="ex dx">${EXPLANATIONS.h}</p></div>`;
}

function coinTableRow(row) {
  return coinRow(row, [
    linkedBlockCoin(row.port, row.name),
    row.algo,
    formatTinyPercent(row.profit, 2, 8),
    effortCell(row.effort),
    formatPercent(row.reward, 2),
    formatNumber(row.wallets),
    formatHashrate(row.pool),
    formatHashrate(row.world),
    explorerHeightLink(row.port, row.height),
    formatPercent(row.pplns, 2),
    row.notes
  ]);
}

function linkedBlockCoin(port, name) {
  return coinCell({ html: `<a href="${blockRoute(port)}">${escapeHtml(name)}</a>` });
}

function coinSortKey(value) {
  return COIN_SORT_KEYS.includes(value) ? value : "pplns";
}

function coinHeadings(active, direction, showIssues, hideDisabled) {
  return [
    sortableCoinHeading("Coin", "name", active, direction, showIssues, hideDisabled),
    sortableCoinHeading("Algo", "algo", active, direction, showIssues, hideDisabled),
    sortableCoinHeading({ html: `<span title="${escapeHtml(EXPLANATIONS.h)}">Hash scalar</span>` }, "profit", active, direction, showIssues, hideDisabled),
    sortableCoinHeading("Effort", "effort", active, direction, showIssues, hideDisabled),
    sortableCoinHeading("Reward", "reward", active, direction, showIssues, hideDisabled),
    sortableCoinHeading("Wallets", "wallets", active, direction, showIssues, hideDisabled),
    sortableCoinHeading("Pool", "pool", active, direction, showIssues, hideDisabled),
    sortableCoinHeading("World", "world", active, direction, showIssues, hideDisabled),
    sortableCoinHeading("Top height", "height", active, direction, showIssues, hideDisabled),
    sortableCoinHeading("PPLNS", "pplns", active, direction, showIssues, hideDisabled),
    sortableCoinHeading("Notes", "notes", active, direction, showIssues, hideDisabled)
  ];
}

function sortableCoinHeading(label, key, active, direction, showIssues, hideDisabled) {
  const selected = active === key;
  const next = nextSortDirectionForKey(active, direction, key, COIN_TEXT_SORT_KEYS);
  const arrow = selected ? (direction === "asc" ? " ↑" : " ↓") : "";
  return { html: `<a class="sort" href="${coinsRoute(key, next, showIssues, hideDisabled)}">${cellHtml(label)}${escapeHtml(arrow)}</a>` };
}

function coinsRoute(sort, dir, showIssues = false, hideDisabled = false) {
  const params = new URLSearchParams();
  if (showIssues) params.set("i", "1");
  if (hideDisabled) params.set("h", "1");
  params.set("s", coinSortKey(sort));
  params.set("d", sortDirection(dir));
  return `#/coins?${params.toString()}`;
}

function coinRow(row, cells) {
  if (!row.disabled) return cells;
  return cells.map((cell) => ({ html: `<span class="ci" title="Coin is not active for mining">${cellHtml(cell)}</span>` }));
}

function rewardPercent(pool, port) {
  const reward = Number(pool.minBlockRewards?.[port] ?? pool.minBlockRewards?.[Number(port)]);
  const base = Number(pool.minBlockRewards?.[XMR_PORT] ?? pool.minBlockRewards?.[Number(XMR_PORT)]);
  return reward && base ? (100 * reward) / base : NaN;
}

function isIssueExemptCoin(port) {
  return ["18144", "18146", "18148"].includes(String(port));
}
