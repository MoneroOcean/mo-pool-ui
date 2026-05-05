import { isFiniteNumber, normalizeTimestampSeconds } from "./format.js";
import { isXmrAddress, walletRoute } from "./routes.js";
import { compareValues } from "./table-sort.js";

const STALE_WORKER_SECONDS = 10 * 60;
const WORKER_LIST_SORT_KEYS = ["name", "algo", "xmr", "raw", "avg", "avgraw", "last", "valid", "invalid", "hashes"];

export function trackWalletState(watchlist = [], address, now = Date.now()) {
  const rows = Array.isArray(watchlist) ? watchlist : [];
  if (!isXmrAddress(address)) return { watchlist: rows, nextHash: null, clearInput: false };
  const next = [...rows.filter((row) => row.address !== address), { address, time: now }].slice(-10);
  return { watchlist: next, nextHash: rows.length ? `#/?tracked=${now}` : walletRoute(address, "overview"), clearInput: true };
}

export function workerSortMode(value) {
  return value === "name" ? "name" : "h";
}

export function workerSortDirection(value) {
  return value === "asc" ? "asc" : "desc";
}

export function workerGraphColumns(value, width = globalThis.innerWidth || 1300) {
  const cols = Number(value);
  return cols > 0 && cols < 6 ? cols : width >= 760 ? 2 : 1;
}

export function workerDisplayMode(value, width = globalThis.innerWidth || 1300) {
  return value === "list" ? "list" : workerGraphColumns(value, width);
}

export function workerListSortMode(value) {
  return WORKER_LIST_SORT_KEYS.includes(value) ? value : "name";
}

export function sortWorkerRows(workers, sortable = "h", direction = "desc") {
  const rows = [...workers];
  const dir = workerSortDirection(direction) === "asc" ? 1 : -1;
  const name = (row) => row.n ?? row.name;
  const rate = (row) => row.r ?? row.rate;
  if (workerSortMode(sortable) === "name") return rows.sort((a, b) => name(a).localeCompare(name(b)) * dir);
  return rows.sort((a, b) => (rate(a) - rate(b)) * dir || name(a).localeCompare(name(b)));
}

export function sortWorkerListRows(workers, sortable = "name", direction) {
  const key = workerListSortMode(sortable);
  const defaultDirection = key === "name" ? "asc" : "desc";
  const dir = workerSortDirection(direction || defaultDirection) === "asc" ? 1 : -1;
  return [...workers].sort((a, b) => compareValues(workerListSortValue(a, key), workerListSortValue(b, key)) * dir || compareValues(a.n, b.n));
}

export function compactWorkerRows(data, charts = {}, now = Date.now()) {
  if (!data || typeof data !== "object") data = {};
  if (!charts || typeof charts !== "object") charts = {};
  const names = new Set([
    ...Object.keys(data).filter((name) => name !== "global"),
    ...Object.keys(charts).filter((name) => name !== "global")
  ]);
  return [...names].map((name) => compactWorkerRow(name, data[name], charts[name], now)).sort((a, b) => b.r - a.r || a.n.localeCompare(b.n));
}

export function workerStatus(hasCurrent, currentHashrate, lastSeen, now = Date.now()) {
  const last = normalizeTimestampSeconds(lastSeen);
  if (!hasCurrent || !last || Number(currentHashrate) <= 0) return "Dead";
  return now / 1000 - last > STALE_WORKER_SECONDS ? "Stale" : "Active";
}

function compactWorkerRow(name, stats, chartRows, now) {
  const stat = latestWorkerStat(stats);
  const hasCurrent = Boolean(stat);
  const chart = workerChartSummary(chartRows);
  const raw = statValue(stat?.row, stats, ["hsh", "hs", "hash"]);
  const xmr = statValue(stat?.row, stats, ["hsh2", "hs2", "hash2"]);
  const current = xmr || raw;
  const lastSeen = Math.max(stat?.last || 0, chart.last || 0);
  const validShares = statValue(stat?.row, stats, ["valid", "validShares", "shares", "s"]);
  return {
    n: name,
    r: current,
    xmr,
    raw,
    la: statText(stat?.row, stats, ["lastShareAlgo", "algo"]),
    ax: chart.xmr,
    ar: chart.raw,
    l: lastSeen,
    totalHashes: statValue(stat?.row, stats, ["totalHash", "totalHashes", "hashes"]),
    vs: validShares,
    is: statValue(stat?.row, stats, ["invalid", "invalidShares", "badShares", "bad_shares"]),
    status: workerStatus(hasCurrent, current, lastSeen, now)
  };
}

function latestWorkerStat(stats) {
  const rows = statRows(stats);
  if (!rows.length) return null;
  return rows.reduce((best, row) => {
    const last = statLastSeen(row, stats);
    if (!best || last > best.last) return { row, last };
    return best;
  }, null);
}

function statRows(stats) {
  return sourceRows(stats, true);
}

function workerChartSummary(source) {
  const rows = chartRows(source);
  let last = 0;
  let xmrTotal = 0;
  let rawTotal = 0;
  let count = 0;
  for (const row of rows) {
    const timestamp = normalizeTimestampSeconds(row.tme ?? row.ts ?? row.time);
    if (!timestamp) continue;
    const raw = statValue(row, null, ["hsh", "hs", "hash"]);
    const xmr = statValue(row, null, ["hsh2", "hs2", "hash2"]) || raw;
    last = Math.max(last, timestamp);
    xmrTotal += xmr;
    rawTotal += raw;
    count += 1;
  }
  return { last, xmr: count ? xmrTotal / count : 0, raw: count ? rawTotal / count : 0 };
}

function chartRows(source) {
  return sourceRows(source);
}

function sourceRows(source, includeObject = false) {
  if (Array.isArray(source)) return source.filter(isObject);
  const rows = Array.isArray(source?.stats) && source.stats.length ? source.stats : Array.isArray(source?.charts) && source.charts.length ? source.charts : [];
  if (rows.length) return rows.filter(isObject);
  return includeObject && isObject(source) && Object.keys(source).some((key) => key !== "stats" && key !== "charts") ? [source] : [];
}

function statLastSeen(row, parent) {
  return normalizeTimestampSeconds(firstValue(row, ["tme", "ts", "time", "lts", "lastShare", "lastHash", "last"]) ?? firstValue(parent, ["lastShare", "lastHash", "lts", "last"]));
}

function statValue(row, parent, keys) {
  const value = firstValue(row, keys) ?? firstValue(parent, keys);
  const number = Number(value);
  return isFiniteNumber(number) ? number : 0;
}

function statText(row, parent, keys) {
  const value = firstValue(row, keys) ?? firstValue(parent, keys);
  return value ? String(value) : "";
}

function firstValue(source, keys) {
  if (!isObject(source)) return undefined;
  for (const key of keys) {
    if (Object.hasOwn(source, key)) return source[key];
  }
  return undefined;
}

function workerListSortValue(row, key) {
  if (key === "name") return row.n;
  if (key === "algo") return row.la;
  if (key === "xmr") return row.xmr;
  if (key === "raw") return row.raw;
  if (key === "avg") return row.ax;
  if (key === "avgraw") return row.ar;
  if (key === "last") return row.l;
  if (key === "valid") return row.vs;
  if (key === "invalid") return row.is;
  if (key === "hashes") return row.totalHashes;
  return 0;
}

function isObject(value) {
  return value && typeof value === "object";
}
