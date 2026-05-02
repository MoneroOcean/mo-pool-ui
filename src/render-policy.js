import { minerEndpoint, POOL_CHART, WALLET_CHART, WALLET_WORKER_CHARTS } from "./api.js";
import { isXmrAddress } from "./routes.js";
import { state } from "./state.js";

export function isSameViewNavigation(previous, next) {
  if (!previous || previous.n !== next.n) return false;
  if (next.n === "wallet") return previous.a === next.a && previous.t === next.t;
  if (next.n === "blocks") return previous.c === next.c;
  return ["home", "coins", "payments", "calc"].includes(next.n);
}

export function isStaticRoute(route) {
  return ["calc", "setup", "help"].includes(route.n);
}

export function shouldScrollToTop(previous, next, keepCurrentView, background) {
  return !background && !keepCurrentView && previous?.n === "home" && next.n === "wallet";
}

export function shouldShowLoading(previousRoute, nextRoute, { background = false, appState = state } = {}) {
  const keepCurrentView = isSameViewNavigation(previousRoute, nextRoute);
  return !background && !keepCurrentView && hasColdGraphLoad(nextRoute, appState);
}

export function hasColdGraphLoad(route, appState = state) {
  // Cold-cache checks use API endpoint keys rather than route names because the
  // loading decision is about expected latency. Same-view controls and cached
  // graph paths keep the current UI visible so the critical route-change path
  // does not flash a loader for work that should already be instant.
  if (route.n === "home") {
    const keys = [
      POOL_CHART,
      ...(appState.w || []).map((row) => minerEndpoint(row.address, WALLET_CHART))
    ];
    return hasColdCache(keys, appState.c);
  }
  if (route.n === "wallet" && (route.t || "overview") === "overview" && isXmrAddress(route.a)) {
    return hasColdCache([
      minerEndpoint(route.a, WALLET_CHART),
      minerEndpoint(route.a, WALLET_WORKER_CHARTS)
    ], appState.c);
  }
  return false;
}

function hasColdCache(keys, cache) {
  return keys.some((key) => !cache?.has(key));
}
