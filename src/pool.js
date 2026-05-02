import { XMR_PORT } from "./constants.js";
import { isFiniteNumber } from "./format.js";

function byPort(values, port) {
  if (!values || typeof values !== "object") return undefined;
  if (Object.hasOwn(values, port)) return values[port];
  if (Object.hasOwn(values, String(port))) return values[String(port)];
  if (Object.hasOwn(values, Number(port))) return values[Number(port)];
  return undefined;
}

function coinMetadata(poolStats = {}, port) {
  return byPort(poolStats.coins, port) || null;
}

function normalizedCoinRow(key, coin = {}) {
  const port = String(coin.port ?? key);
  const name = coin.displayName || coin.symbol || String(port);
  return {
    p: port,
    n: name,
    s: coin.symbol || name,
    a: coin.algo || "--",
    ac: coin.active === true,
    c: coin.comment || "",
    dr: coin.disabledReason || "",
    ec: String(port) === String(XMR_PORT) || coin.exchangeConfigured === true,
    h: Number(coin.hashrate) || 0,
    m: Number(coin.miners) || 0,
    ps: Number(coin.pplnsShare) || 0
  };
}

export function coinStatsRows(poolStats = {}) {
  return poolStats.coins && typeof poolStats.coins === "object"
    ? Object.entries(poolStats.coins).map(([key, coin]) => normalizedCoinRow(key, coin))
    : [];
}

function bestCoinPort(poolStats, includeCoin) {
  let winner = "";
  let best = -1;
  for (const coin of coinStatsRows(poolStats)) {
    if (!includeCoin(coin)) continue;
    const value = Number(coin.ps) || 0;
    if (value > best) {
      winner = coin.p;
      best = value;
    }
  }
  return best > 0 ? winner : "";
}

export function topCoinPort(poolStats = {}) {
  return bestCoinPort(poolStats, () => true) || String(XMR_PORT);
}

export function blockCoinPort(poolStats = {}, requestedPort = "") {
  if (requestedPort) return requestedBlockCoinPort(poolStats, requestedPort);
  return defaultBlockCoinPort(poolStats);
}

function defaultBlockCoinPort(poolStats = {}) {
  const top = topCoinPort(poolStats);
  if (hasBlockHistory(poolStats, top)) return top;
  const ports = coinStatsRows(poolStats).map((coin) => coin.p).filter((port) => hasBlockHistory(poolStats, port));
  return ports[0] || top;
}

function requestedBlockCoinPort(poolStats = {}, requested = "") {
  const wanted = coinRouteSlug(requested);
  if (!wanted) return "";
  const match = coinStatsRows(poolStats).find((coin) => {
    const metadata = coinMetadata(poolStats, coin.p) || {};
    return coinRouteSlug(metadata.symbol || coin.s) === wanted;
  });
  return match?.p || "";
}

export function coinRouteSlug(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function coinName(poolStats = {}, port) {
  const coin = coinMetadata(poolStats, port);
  return coin?.displayName || coin?.symbol || String(port);
}

export function coinSymbol(poolStats = {}, port) {
  const coin = coinMetadata(poolStats, port);
  return coin?.symbol || coin?.displayName || String(port);
}

export function coinHashScalar(poolStats = {}, port, basePort = XMR_PORT) {
  const profit = coinProfitValue(poolStats, port);
  const base = coinProfitValue(poolStats, basePort);
  return base > 0 ? profit / base * 100 : 0;
}

export function coinProfitValue(poolStats = {}, port) {
  return Number(coinMetadata(poolStats, port)?.profit) || 0;
}

export function hasBlockHistory(poolStats = {}, port) {
  return coinBlockCount(poolStats, port) > 0;
}

export function coinBlockCount(poolStats = {}, port) {
  if (String(port) === String(XMR_PORT)) return Number(poolStats.totalBlocksFound) || 0;
  return Number(coinMetadata(poolStats, port)?.altBlocksFound) || 0;
}

export function currentEffort(poolStats = {}, port) {
  return Number(poolStats.currentEfforts?.[port] ?? poolStats.currentEfforts?.[Number(port)] ?? 0);
}

export function effortPercent(poolStats = {}, networkStats = {}, port) {
  const effort = currentEffort(poolStats, port);
  const network = networkStats?.[port] || networkStats?.[Number(port)] || {};
  const difficulty = Number(network.difficulty);
  if (isFiniteNumber(effort) && isFiniteNumber(difficulty) && difficulty > 0) return effort / difficulty * 100;
  return effort > 0 && effort < 10_000 ? effort : NaN;
}

export function blockEffortPercent(block = {}) {
  const shares = Number(block.shares);
  const difficulty = Number(block.diff);
  return isFiniteNumber(shares) && isFiniteNumber(difficulty) && difficulty > 0 ? shares / difficulty * 100 : NaN;
}

export function averageBlockEffort(blocks = []) {
  const efforts = blocks.map(blockEffortPercent).filter(isFiniteNumber);
  return efforts.length ? efforts.reduce((sum, effort) => sum + effort, 0) / efforts.length : NaN;
}

export function effortTone(effort) {
  return Number(effort) > 100 ? "red" : "green";
}

export function coinAtomicUnits(poolStats = {}, port) {
  return Number(coinMetadata(poolStats, port)?.atomicUnits) || 0;
}

export function worldHashrateForPort(networkStats = {}, port, poolStats = {}) {
  const network = byPort(networkStats, port) || networkStats || {};
  const difficulty = Number(network.difficulty);
  const time = Number(network.time || network.value?.time || coinMetadata(poolStats, port)?.blockTime || 0);
  return isFiniteNumber(difficulty) && difficulty > 0 && isFiniteNumber(time) && time > 0 ? difficulty / time : 0;
}
