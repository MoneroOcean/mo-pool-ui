import { API_BASE, UPTIME_API } from "./constants.js";
import { setCache, getCache, setError, state } from "./state.js";

const inflight = new Map();
const TTL = {
  config: 300_000,
  "pool/ports": 60_000,
  "pool/stats": 60_000,
  "pool/motd": 120_000,
  "network/stats": 180_000,
  "pool/payments?page=0&limit=15": 120_000,
  default: 45_000
};

export function endpointKey(path) {
  return path.replace(/^\/+/, "");
}

export async function fetchJson(path, { ttl, force = false } = {}) {
  const key = endpointKey(path);
  return cachedJsonRequest({
    key,
    ttl: ttl ?? TTL[key] ?? TTL.default,
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

export async function fetchExternalJson(url, { key = url, ttl = TTL.default, force = false, timeout = 5000 } = {}) {
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

export const api = {
  config: (options) => fetchJson("config", { ttl: 300_000, ...options }),
  poolStats: async (options) => {
    const data = await fetchJson("pool/stats", options);
    return data.pool_statistics || data || {};
  },
  poolPorts: (options) => fetchJson("pool/ports", { ttl: 60_000, ...options }),
  networkStats: (options) => fetchJson("network/stats", { ttl: 180_000, ...options }),
  poolChart: (options) => fetchJson("pool/chart/hashrate", { ttl: 120_000, ...options }),
  motd: (options) => fetchJson("pool/motd", { ttl: 120_000, ...options }),
  payments: (page = 0, limit = 15, options) => fetchJson(`pool/payments?page=${page}&limit=${limit}`, { ttl: 120_000, ...options }),
  blocks: (page = 0, limit = 15, options) => fetchJson(`pool/blocks?page=${page}&limit=${limit}`, { ttl: 120_000, ...options }),
  coinBlocks: (port, page = 0, limit = 15, options) => fetchJson(`pool/coin_altblocks/${port}?page=${page}&limit=${limit}`, { ttl: 120_000, ...options }),
  wallet: (address, options) => fetchJson(`miner/${address}/stats`, { ttl: 30_000, ...options }),
  walletChart: (address, options) => fetchJson(`miner/${address}/chart/hashrate`, { ttl: 120_000, ...options }),
  walletWorkerCharts: (address, options) => fetchJson(`miner/${address}/chart/hashrate/allWorkers`, { ttl: 120_000, ...options }),
  walletWorkers: (address, options) => fetchJson(`miner/${address}/stats/allWorkers`, { ttl: 60_000, ...options }),
  walletPayments: (address, page = 0, limit = 15, options) => fetchJson(`miner/${address}/payments?page=${page}&limit=${limit}`, { ttl: 120_000, ...options }),
  walletBlockPayments: (address, page = 0, limit = 15, options) => fetchJson(`miner/${address}/block_payments?page=${page}&limit=${limit}`, { ttl: 120_000, ...options }),
  userSettings: (address, options) => fetchJson(`user/${address}`, { ttl: 30_000, ...options }),
  updateThreshold: (address, threshold) => postJson("user/updateThreshold", { username: address, threshold }),
  subscribeEmail: (address, enabled, from, to) => postJson("user/subscribeEmail", { username: address, enabled, from, to }),
  clearUserSettings: (address) => invalidateEndpoint(`user/${address}`),
  uptimeStatus: (options) => fetchExternalJson(UPTIME_API, { key: "uptimerobot/status", ttl: 60_000, ...options })
};
