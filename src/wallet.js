import { isXmrAddress } from "./routes.js";

export function trackWalletState(watchlist, address, now = Date.now()) {
  if (!isXmrAddress(address)) return { watchlist, nextHash: null, clearInput: false };
  const next = [...watchlist.filter((row) => row.address !== address), { address, time: now }].slice(-10);
  return { watchlist: next, nextHash: `#/?tracked=${now}`, clearInput: true };
}

export function workerSortMode(value) {
  return value === "name" ? "name" : "h";
}

export function workerSortDirection(value) {
  return value === "asc" ? "asc" : "desc";
}

export function workerGraphColumns(value, width = globalThis.innerWidth || 1300) {
  const cols = Number(value);
  return cols > 0 && cols < 4 ? cols : width >= 760 ? 2 : 1;
}

export function sortWorkerRows(workers, sort = "h", direction = "desc") {
  const rows = [...workers];
  const dir = workerSortDirection(direction) === "asc" ? 1 : -1;
  const name = (row) => row.n ?? row.name;
  const rate = (row) => row.r ?? row.rate;
  if (workerSortMode(sort) === "name") return rows.sort((a, b) => name(a).localeCompare(name(b)) * dir);
  return rows.sort((a, b) => (rate(a) - rate(b)) * dir || name(a).localeCompare(name(b)));
}
