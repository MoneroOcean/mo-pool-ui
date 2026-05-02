import { api } from "../api.js";
import { EXPLANATIONS, XMR_PORT } from "../constants.js";
import { formatHashrate, formatNumber, formatPercent, formatTinyPercent } from "../format.js";
import { coinHashScalar, coinStatsRows, effortPercent, worldHashrateForPort } from "../pool.js";
import { state } from "../state.js";
import { nextSortDirectionForKey, sortDirection, sortRows } from "../table-sort.js";
import { cellHtml, chipLink, coinCell, escapeHtml, explorerHeightLink, tablePage } from "./common.js";
import { blockRoute, effortCell } from "./blocks.js";

const COIN_COLUMNS = [
  ["Coin", "name"],
  ["Algo", "algo"],
  ["Hash scalar", "profit"],
  ["Effort", "effort"],
  ["Reward", "reward"],
  ["Wallets", "wallets"],
  ["Pool", "pool"],
  ["World", "world"],
  ["Top height", "height"],
  ["PPLNS", "pplns"],
  ["Notes", "notes"]
];
const COIN_SORT_KEYS = COIN_COLUMNS.map(([, key]) => key);
const COIN_TEXT_SORT_KEYS = { name: "asc", algo: "asc", notes: "asc" };

export async function coinsView() {
  const [pool, network] = await Promise.all([api.poolStats(), api.networkStats()]);
  const query = state.r.q || {};
  const showIssues = query.issues === "1";
  const hideDisabled = query.inactive === "0";
  const sortKey = coinSortKey(query.sort);
  const direction = sortDirection(query.dir);
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
      symbol: coin.s,
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
  return `<div title="${escapeHtml(EXPLANATIONS.hashScalar)}"><div class=bar>${inactive}${issues}</div><p class="explanation comments-controlled">${EXPLANATIONS.hashScalar}</p></div>`;
}

function coinTableRow(row) {
  return coinRow(row, [
    linkedBlockCoin(row.symbol, row.name),
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

function linkedBlockCoin(symbol, name) {
  return coinCell({ html: `<a href="${blockRoute(symbol)}">${escapeHtml(name)}</a>` });
}

function coinSortKey(value) {
  return COIN_SORT_KEYS.includes(value) ? value : "pplns";
}

function coinHeadings(active, direction, showIssues, hideDisabled) {
  return COIN_COLUMNS.map(([label, key]) => sortableCoinHeading(key === "profit" ? { html: `<span title="${escapeHtml(EXPLANATIONS.hashScalar)}">${label}</span>` } : label, key, active, direction, showIssues, hideDisabled));
}

function sortableCoinHeading(label, key, active, direction, showIssues, hideDisabled) {
  const selected = active === key;
  const next = nextSortDirectionForKey(active, direction, key, COIN_TEXT_SORT_KEYS);
  const arrow = selected ? (direction === "asc" ? " ↑" : " ↓") : "";
  return { html: `<a class="sortable" href="${coinsRoute(key, next, showIssues, hideDisabled)}">${cellHtml(label)}${escapeHtml(arrow)}</a>` };
}

function coinsRoute(sortable, dir, showIssues = false, hideDisabled = false) {
  const params = [];
  if (showIssues) params.push("issues=1");
  if (hideDisabled) params.push("inactive=0");
  params.push(`sort=${coinSortKey(sortable)}`, `dir=${sortDirection(dir)}`);
  return `#/coins?${params.join("&")}`;
}

function coinRow(row, cells) {
  if (!row.disabled) return cells;
  return cells.map((cell) => ({ html: `<span class=inactive-coin title="Coin is not active for mining">${cellHtml(cell)}</span>` }));
}

function rewardPercent(pool, port) {
  const reward = Number(pool.minBlockRewards?.[port] ?? pool.minBlockRewards?.[Number(port)]);
  const base = Number(pool.minBlockRewards?.[XMR_PORT] ?? pool.minBlockRewards?.[Number(XMR_PORT)]);
  return reward && base ? (100 * reward) / base : NaN;
}

function isIssueExemptCoin(port) {
  return ["18144", "18146", "18148"].includes(String(port));
}
