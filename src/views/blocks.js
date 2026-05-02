import { PAGE_SIZES, blockPageSize, pageCountFor, pageQuery, routePageNumber } from "../paging.js";
import { averageBlockEffort, blockCoinPort, blockEffortPercent, coinAtomicUnits, coinBlockCount, coinName, coinStatsRows, coinSymbol, effortTone, hasBlockHistory } from "../pool.js";
import { routeCoinId } from "../routes.js";
import { api } from "../api.js";
import { EXPLANATIONS, XMR_PORT } from "../constants.js";
import { atomicXmr, encodeUrlPart, formatNumber, formatPercent, isFiniteNumber } from "../format.js";
import { blockHashLink, blockRewardAmountCell, dateCell, escapeHtml, explorerHeightLink, pageSizeSelect, pagerNav, tablePage } from "./common.js";

export async function blocksView(route) {
  let page = routePageNumber(route.q?.page);
  const limit = blockPageSize(route.q?.limit);
  const [pool, network] = await Promise.all([api.poolStats(), api.networkStats()]);
  const coin = blockCoinPort(pool, route.c || route.q?.coin || "");
  page = Math.min(page, pageCountFor(coinBlockCount(pool, coin), limit));
  const blocks = String(coin) === String(XMR_PORT) ? await api.blocks(page - 1, limit) : await api.coinBlocks(coin, page - 1, limit);
  const coins = blockCoinOptions(pool, coin);
  const controls = blockControls(pool, coin, coins, page, limit, blocks?.length || 0, blocks || []);
  const xmrCoin = String(coin) === String(XMR_PORT);
  const headings = xmrCoin
    ? ["Found time","Effort","Reward (XMR)","Height","Block hash"]
    : ["Found time","Effort","Reward (XMR)",`Reward (${coinName(pool, coin)})`,"Height","Block hash"];
  const rows = (blocks || []).map((block) => blockRow(block, coin, pool, network, xmrCoin));
  return tablePage("", "", headings, rows, controls);
}

function blockRow(block, coin, pool, network, xmrCoin) {
  const commonCells = [
    dateCell(block.ts || block.time || block.timestamp),
    blockEffortCell(block),
    blockXmrRewardCell(block, coin, pool, network)
  ];
  const coinCells = xmrCoin ? commonCells : [...commonCells, blockNativeRewardCell(block, coin, pool)];
  return [
    ...coinCells,
    explorerHeightLink(coin, block.height || block.blockHeight),
    blockHashLink(block.hash || block.blockHash)
  ];
}

function blockControls(pool, coin, coins, page, limit, rowCount, blocks = []) {
  const totalCount = coinBlockCount(pool, coin);
  const pageCount = pageCountFor(totalCount, limit);
  const hasNext = page < pageCount || (!totalCount && rowCount >= limit);
  return `<div class="block-controls block-filters">
    <div class="block-controls-left">
      <label class=field>Coin<select id=blocks-coin-filter>${coins.map((item) => `<option value="${escapeHtml(item.symbol)}" ${String(item.port) === String(coin) ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></label>
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
  const value = String(coin) === String(XMR_PORT) ? block.value : block.pay_value;
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
  if (String(port) !== String(XMR_PORT)) return String(block.pay_stage || block.payStage || "Pending");
  const net = network[port] || network[Number(port)] || network || {};
  const height = Number(net.height);
  const blockHeight = Number(block.height || block.blockHeight);
  const blockTime = Number(pool.coins?.[port]?.blockTime || pool.coins?.[Number(port)]?.blockTime || net.time || 120);
  const blocksLeft = 30 - (height - blockHeight);
  if (!isFiniteNumber(blocksLeft)) return String(block.pay_stage || block.payStage || block.pay_status || block.payStatus || "Pending");
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
    .filter((port) => hasBlockHistory(pool, port))
    .map((port) => ({ port, name: coinName(pool, port), symbol: coinSymbol(pool, port) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
