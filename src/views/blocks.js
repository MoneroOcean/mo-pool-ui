import { PAGE_SIZES, blockPageSize, pageBounds, pageCountFor, pageQuery, routePageNumber } from "../paging.js";
import { averageBlockEffort, blockCoinPort, blockEffortPercent, coinAtomicUnits, coinBlockCount, coinName, coinStatsRows, effortTone, hasBlockHistory, isXmrPort } from "../pool.js";
import { routeCoinId } from "../routes.js";
import { api } from "../api.js";
import { EXPLANATIONS, XMR_PORT } from "../constants.js";
import { atomicXmr, encodeUrlPart, formatNumber, formatPercent, isFiniteNumber, recordTimestamp } from "../format.js";
import { blockRewardAmountCell, dateCell, escapeHtml, explorerBlockHashLink, pageSizeSelect, pagerNav, tablePage } from "./common.js";

export async function blocksView(route) {
  let page = routePageNumber(route.q?.page);
  const limit = blockPageSize(route.q?.limit);
  const [pool, network] = await Promise.all([api.poolStats(), api.networkStats()]);
  const coin = blockCoinPort(pool, route.c || route.q?.coin || "");
  page = Math.min(page, pageCountFor(coinBlockCount(pool, coin), limit));
  const xmrCoin = isXmrPort(coin);
  const blocks = xmrCoin ? await api.blocks(page - 1, limit) : await api.coinBlocks(coin, page - 1, limit);
  const coins = blockCoinOptions(pool, coin);
  const controls = blockControls(pool, coin, coins, page, limit, blocks?.length || 0, blocks || []);
  const headings = ["Found time", "Effort", "Reward (XMR)",
    ...(xmrCoin ? [] : [`Reward (${coinName(pool, coin)})`]),
    "Height", "Block hash"];
  const rows = (blocks || []).map((block) => blockRow(block, coin, pool, network, xmrCoin));
  const emptyText = Array.isArray(blocks) && blocks.length === 0 ? "No blocks found for this coin." : "";
  return tablePage("", "", headings, rows, controls, "", emptyText);
}

function blockRow(block, coin, pool, network, xmrCoin) {
  const commonCells = [
    dateCell(recordTimestamp(block)),
    blockEffortCell(block),
    blockXmrRewardCell(block, coin, pool, network)
  ];
  const coinCells = xmrCoin ? commonCells : [...commonCells, blockNativeRewardCell(block, coin, pool)];
  return [
    ...coinCells,
    blockHeightCell(block),
    explorerBlockHashLink(coin, block.hash || block.blockHash)
  ];
}

function blockHeightCell(block) {
  const height = block.height ?? block.blockHeight;
  if (height === undefined || height === null || height === "") return "--";
  if (!["number", "string", "bigint"].includes(typeof height)) return "--";
  return height;
}

function blockControls(pool, coin, coins, page, limit, rowCount, blocks = []) {
  const { pageCount, hasNext } = pageBounds(coinBlockCount(pool, coin), limit, page, rowCount);
  return `<div class="block-controls block-filters">
    <div class="block-controls-left">
      <label class=field>Coin<select id=blocks-coin-filter>${coins.map((item) => `<option value="${escapeHtml(item.id)}" ${String(item.port) === String(coin) ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></label>
      ${blockLuck(blocks)}
    </div>
    <div class="page-tools">
      ${pageSizeSelect("bps", limit)}
      ${pagerNav("blocks pages", "bpi", page, pageCount, hasNext, (nextPage, nextLimit) => blockRoute(coin, nextPage, nextLimit, pool), limit)}
    </div>
  </div>`;
}

function blockLuck(blocks) {
  const effort = averageBlockEffort(blocks);
  return `<div class="block-summary" title="${escapeHtml(EXPLANATIONS.luck)}"><strong>Block effort here</strong><span class="${effortTone(effort)}">${formatPercent(effort)}</span><p class="explanation comments-controlled">${EXPLANATIONS.luck}</p></div>`;
}

function blockEffortCell(block) {
  const effort = blockEffortPercent(block);
  return { html: `<span class="${effortTone(effort)}" title="${escapeHtml(`${block.shares || 0} / ${block.diff || 0}`)}">${formatPercent(effort, 2)}</span>` };
}

export function effortCell(effort) {
  return { html: `<span class="${effortTone(effort)}">${formatPercent(effort, 2)}</span>` };
}

function blockXmrRewardCell(block, coin, pool, network) {
  if (isInvalidBlock(block)) return invalidBlockCell();
  const value = isXmrPort(coin) ? block.value : block.pay_value;
  const amount = atomicXmr(value || 0);
  const payment = formatNumber(amount, 8);
  if (block.unlocked === true && amount) return blockRewardAmountCell(payment, true);
  return blockPaymentStage(block, coin, pool, network);
}

function blockNativeRewardCell(block, coin, pool) {
  if (isInvalidBlock(block)) return invalidBlockCell();
  return blockRewardAmountCell(formatCoinReward(block.value, coin, pool), block.unlocked === true);
}

export function blockPaymentStage(block, coin, pool, network) {
  const port = block.port || coin;
  const pending = block.pay_stage || block.payStage || block.pay_status || block.payStatus || "Pending";
  if (!isXmrPort(port)) return String(pending);
  // Backend returns either a port-keyed network map or a single flat network object;
  // the bare `|| network` handles the flat shape.
  const net = network[port] || network[Number(port)] || network || {};
  const height = Number(net.height);
  const blockHeight = Number(block.height || block.blockHeight);
  const blockTime = Number(pool.coins?.[port]?.blockTime || pool.coins?.[Number(port)]?.blockTime || net.time || 120);
  const blocksLeft = 30 - (height - blockHeight);
  if (!isFiniteNumber(blocksLeft)) return String(pending);
  if (blocksLeft > 0) return `${formatNumber((blocksLeft * blockTime) / 60)} Mins Left`;
  if (blocksLeft > -10) return "Soon";
  return "Delayed";
}

function isInvalidBlock(block) {
  return block.valid === false || block.valid === 0 || block.valid === "0" || block.orphan === true || block.orphaned === true;
}

function invalidBlockCell() {
  return { html: `<span class=red title="Orphan block">Orphaned</span>` };
}

function formatCoinReward(value, port, pool) {
  const number = Number(value);
  const divisor = coinAtomicUnits(pool, port);
  if (!isFiniteNumber(number) || !isFiniteNumber(divisor) || divisor <= 0) return "--";
  return formatNumber(number / divisor, 8);
}

export function blockRoute(coin, page = 1, pageSize = PAGE_SIZES[0], pool) {
  const suffix = `/${encodeUrlPart(routeCoinId(coin, pool))}`;
  return `#/blocks${suffix}?${pageQuery(page, pageSize)}`;
}

function blockCoinOptions(pool, selectedCoin) {
  const ports = new Set(coinStatsRows(pool).map((coin) => coin.p));
  if (Number(pool.totalBlocksFound) > 0) ports.add(String(XMR_PORT));
  return [...ports]
    .filter((port) => String(port) === String(selectedCoin) || hasBlockHistory(pool, port))
    .map((port) => ({ port, name: coinName(pool, port), id: routeCoinId(port, pool) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
