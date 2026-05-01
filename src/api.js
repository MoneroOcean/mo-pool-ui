import { API_BASE, UPTIME_API } from "./constants.js";
import { setCache, getCache, setError, state } from "./state.js";

const inflight = new Map();
const CONFIG = "config";
const POOL_PORTS = "pool/ports";
const POOL_STATS = "pool/stats";
const POOL_MOTD = "pool/motd";
const NETWORK_STATS = "network/stats";
export const POOL_CHART = "pool/chart/hashrate";
export const WALLET_CHART = "chart/hashrate";
export const WALLET_WORKER_CHARTS = `${WALLET_CHART}/allWorkers`;
const POOL_PAYMENTS = "pool/payments";
const DEFAULT_TTL = 45_000;
const TTL = {
  [CONFIG]: 300_000,
  [POOL_PORTS]: 60_000,
  [POOL_STATS]: 60_000,
  [POOL_MOTD]: 120_000,
  [NETWORK_STATS]: 180_000,
  [`${POOL_PAYMENTS}?page=0&limit=15`]: 120_000
};

export function endpointKey(path) {
  return path.replace(/^\/+/, "");
}

export async function fetchJson(path, { ttl, force = false } = {}) {
  const key = endpointKey(path);
  return cachedJsonRequest({
    key,
    ttl: ttl ?? TTL[key] ?? DEFAULT_TTL,
    force,
    start: () => ({ promise: fetch(`${API_BASE}${key}`, jsonRequestOptions()) })
  });
}

export async function postJson(path, body = {}) {
  const key = endpointKey(path);
  state.q.set(key, Date.now());
  const response = await fetch(`${API_BASE}${key}`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.msg || json.error || `${response.status} ${response.statusText}`);
  }
  return json;
}

function invalidateEndpoint(path) {
  state.c.delete(endpointKey(path));
}

export async function fetchExternalJson(url, { key = url, ttl = DEFAULT_TTL, force = false, timeout = 5000 } = {}) {
  return cachedJsonRequest({
    key,
    ttl,
    force,
    start: () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      return {
        promise: fetch(url, jsonRequestOptions({ credentials: "omit", signal: controller.signal })),
        cleanup: () => clearTimeout(timer)
      };
    }
  });
}

function cachedJsonRequest({ key, ttl, force, start }) {
  const cached = freshCacheEntry(key, ttl, force);
  if (cached.hit) return cached.value;
  if (inflight.has(key)) return inflight.get(key);
  state.q.set(key, Date.now());
  const { promise, cleanup } = start();
  const request = promise
    .then(jsonResponse)
    .then((json) => {
      setCache(key, json);
      return json;
    })
    .catch((error) => cacheFallbackOrThrow(key, error))
    .finally(() => {
      cleanup?.();
      inflight.delete(key);
    });
  inflight.set(key, request);
  return request;
}

function freshCacheEntry(key, ttl, force) {
  if (force) return { hit: false };
  const cached = state.c.get(key);
  if (!cached) return { hit: false };
  return Date.now() - cached.time < ttl ? { hit: true, value: cached.value } : { hit: false };
}

function jsonRequestOptions(options = {}) {
  return { ...options, headers: { accept: "application/json", ...(options.headers || {}) } };
}

function jsonResponse(response) {
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

function cacheFallbackOrThrow(key, error) {
  setError(key, error);
  const fallback = getCache(key);
  if (fallback) return fallback;
  throw error;
}

function cachedEndpoint(path, options, ttl = 120_000) {
  return fetchJson(path, { ttl, ...options });
}

function pagedEndpoint(path, page, limit, options) {
  return cachedEndpoint(`${path}?page=${page}&limit=${limit}`, options);
}

export function minerEndpoint(address, suffix) {
  return `miner/${address}/${suffix}`;
}

export const api = {
  config: (options) => cachedEndpoint(CONFIG, options, 300_000),
  poolStats: async (options) => {
    const data = await fetchJson(POOL_STATS, options);
    return data.pool_statistics || data || {};
  },
  poolPorts: (options) => cachedEndpoint(POOL_PORTS, options, 60_000),
  networkStats: (options) => cachedEndpoint(NETWORK_STATS, options, 180_000),
  poolChart: (options) => cachedEndpoint(POOL_CHART, options),
  motd: (options) => cachedEndpoint(POOL_MOTD, options),
  payments: (page = 0, limit = 15, options) => pagedEndpoint(POOL_PAYMENTS, page, limit, options),
  blocks: (page = 0, limit = 15, options) => pagedEndpoint("pool/blocks", page, limit, options),
  coinBlocks: (port, page = 0, limit = 15, options) => pagedEndpoint(`pool/coin_altblocks/${port}`, page, limit, options),
  wallet: (address, options) => cachedEndpoint(minerEndpoint(address, "stats"), options, 30_000),
  walletChart: (address, options) => cachedEndpoint(minerEndpoint(address, WALLET_CHART), options),
  walletWorkerCharts: (address, options) => cachedEndpoint(minerEndpoint(address, WALLET_WORKER_CHARTS), options),
  walletWorkers: (address, options) => cachedEndpoint(minerEndpoint(address, "stats/allWorkers"), options, 60_000),
  walletPayments: (address, page = 0, limit = 15, options) => pagedEndpoint(minerEndpoint(address, "payments"), page, limit, options),
  walletBlockPayments: (address, page = 0, limit = 15, options) => pagedEndpoint(minerEndpoint(address, "block_payments"), page, limit, options),
  userSettings: (address, options) => cachedEndpoint(`user/${address}`, options, 30_000),
  updateThreshold: (address, threshold) => postJson("user/updateThreshold", { username: address, threshold }),
  subscribeEmail: (address, enabled, from, to) => postJson("user/subscribeEmail", { username: address, enabled, from, to }),
  clearUserSettings: (address) => invalidateEndpoint(`user/${address}`),
  uptimeStatus: (options) => fetchExternalJson(UPTIME_API, { key: "uptimerobot/status", ttl: 60_000, ...options })
};
