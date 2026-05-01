import { loadWatchlist, localHistoryEnabled, setConsent, shouldAskConsent } from "./privacy.js";
import { minerEndpoint, POOL_CHART, WALLET_CHART, WALLET_WORKER_CHARTS } from "./api.js";
import { isXmrAddress, parseRoute } from "./routes.js";
import { RefreshScheduler } from "./scheduler.js";
import { setTitle, updateCanonical } from "./seo.js";
import { state } from "./state.js";
import { applyPreferences, readPreferences, saveExplanations, saveTheme, toggleExplanations, toggleTheme } from "./preferences.js";
import { supportEmail } from "./constants.js";
import { walletView } from "./views/wallet.js";
import { blocksView } from "./views/blocks.js";
import { calcView } from "./views/calc.js";
import { coinsView } from "./views/coins.js";
import { errorPanel, skel } from "./views/common.js";
import { bindViewEvents } from "./views/events.js";
import { helpView } from "./views/help.js";
import { homeView, syncWalletTrackButtonLabels } from "./views/home.js";
import { paymentsView } from "./views/payments.js";
import { setupView } from "./views/setup.js";
import { attr, byId, on, qs, qsa, tog } from "./dom.js";

const view = byId("view");
const refreshLabel = byId("rst");
const themeToggle = byId("th");
const commentsToggle = byId("ct");
let preferences = readPreferences();
let lastRefreshAt = 0;

const routeViews = {
  wallet: walletView,
  coins: coinsView,
  blocks: blocksView,
  payments: paymentsView,
  calc: calcView,
  setup: setupView,
  help: helpView
};

export function startApp() {
  applyPreferences(preferences);
  syncPreferenceButtons();
  state.w = loadWatchlist();
  on(window, "hashchange", render);
  on(byId("rnw"), "click", () => scheduler.refreshNow());
  on(themeToggle, "click", () => {
    preferences.theme = saveTheme(toggleTheme(preferences.theme), { persist: localHistoryEnabled() });
    applyPreferences(preferences);
    syncPreferenceButtons();
  });
  on(commentsToggle, "click", () => {
    preferences.explanations = saveExplanations(toggleExplanations(preferences.explanations), { persist: localHistoryEnabled() });
    applyPreferences(preferences);
    syncPreferenceButtons();
  });
  maybeShowConsent();
  render();
}

const scheduler = new RefreshScheduler({
  interval: 60_000,
  onState: (label) => {
    if (refreshLabel) {
      refreshLabel.textContent = label;
      tog(refreshLabel.parentElement, "upd", label === "Updating");
      attr(refreshLabel.parentElement, "title", `Refresh visible data. ${label}`);
      attr(refreshLabel.parentElement, "aria-label", `Refresh visible data. ${label}`);
    }
  },
  onTick: () => render({ background: true })
});

async function render({ background = false } = {}) {
  const previousRoute = state.r;
  const nextRoute = parseRoute(location.hash || "#/");
  if (background && isStaticRoute(nextRoute)) return;
  const keepCurrentView = !background && isSameViewNavigation(previousRoute, nextRoute);
  state.r = nextRoute;
  setTitle(state.r);
  updateCanonical(state.r);
  updateNav();
  view.toggleAttribute("aria-busy", true);
  if (shouldScrollToTop(previousRoute, state.r, keepCurrentView, background)) window.scrollTo(0, 0);
  // The cyberpunk glyph skeleton is intentionally narrow: it appears only for
  // cold graph-heavy views where the user is likely to wait on network and
  // chart data. Fast tab switches and cached graph views keep the current UI in
  // place so there is no visual flash for instant navigation.
  const showLoading = !background && !keepCurrentView && hasColdGraphLoad(state.r);
  if (showLoading) view.innerHTML = skel("Loading dashboard");
  try {
    const html = await routeHtml(state.r);
    if (background && isStaticRoute(parseRoute(location.hash || "#/"))) return;
    view.innerHTML = html;
    bindViewEvents();
    if (!isStaticRoute(state.r)) lastRefreshAt = Date.now();
  } catch (error) {
    if (!background && !keepCurrentView) view.innerHTML = errorPanel(error);
    throw error;
  } finally {
    view.toggleAttribute("aria-busy", false);
    syncScheduler();
  }
}

function routeHtml(route) {
  return (routeViews[route.n] || homeView)(route);
}

function isSameViewNavigation(previous, next) {
  if (!previous || previous.n !== next.n) return false;
  if (next.n === "wallet") return previous.a === next.a && previous.t === next.t;
  if (next.n === "blocks") return previous.c === next.c;
  return ["coins", "payments", "calc"].includes(next.n);
}

function isStaticRoute(route) {
  return ["calc", "setup", "help"].includes(route.n);
}

function shouldScrollToTop(previous, next, keepCurrentView, background) {
  return !background && !keepCurrentView && previous?.n === "home" && next.n === "wallet";
}

// Cold-cache checks use API endpoint keys rather than route names because the
// loading decision is about expected latency. The home route can include many
// watched wallets, while the wallet overview needs both wallet-level and worker
// graphs; other tabs are table/settings views and should not show the glyph
// skeleton.
function hasColdGraphLoad(route) {
  if (route.n === "home") {
    const keys = [
      POOL_CHART,
      ...state.w.map((row) => minerEndpoint(row.address, WALLET_CHART))
    ];
    return hasColdCache(keys);
  }
  if (route.n === "wallet" && (route.t || "overview") === "overview" && isXmrAddress(route.a)) {
    return hasColdCache([
      minerEndpoint(route.a, WALLET_CHART),
      minerEndpoint(route.a, WALLET_WORKER_CHARTS)
    ]);
  }
  return false;
}

function hasColdCache(keys) {
  return keys.some((key) => !state.c.has(key));
}

function syncScheduler() {
  if (isStaticRoute(state.r)) {
    scheduler.stop("Auto refresh off");
    return;
  }
  const nextDelay = Math.max(250, scheduler.interval - (Date.now() - lastRefreshAt));
  scheduler.start("Auto refresh on", nextDelay);
}

function updateNav() {
  qsa(".nv a").forEach((link) => {
    const route = parseRoute(link.getAttribute("href"));
    const active = route.n === state.r.n && route.n !== "wallet";
    if (active) attr(link, "aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function syncPreferenceButtons() {
  if (themeToggle) {
    const light = preferences.theme === "light";
    themeToggle.textContent = light ? "☀" : "☾";
    themeToggle.title = light ? "Light theme; switch dark" : "Dark theme; switch light";
    attr(themeToggle, "aria-label", themeToggle.title);
    attr(themeToggle, "aria-pressed", String(light));
  }
  if (commentsToggle) {
    const enabled = preferences.explanations !== "off";
    attr(commentsToggle, "aria-pressed", String(enabled));
    commentsToggle.title = enabled ? "Hide comments" : "Show comments";
  }
}

function maybeShowConsent() {
  if (!shouldAskConsent()) return;
  const panel = document.createElement("section");
  panel.className = "cns";
  const email = supportEmail();
  // The prompt copy must stay explicit about what is local browser history and
  // what requires server-side support. supportEmail() obfuscates the address in
  // source while still rendering a usable contact in the browser.
  panel.innerHTML = `<h2>Local wallet history</h2><p class=mt>Store up to 10 recent XMR addresses here for 180 days. They are sent only when opened. Use trash to clear saved wallets. For server-side deletion, email ${email}.</p><div class=br><button id=cok>Allow local history</button><button id=cno>Do not store</button></div>`;
  document.body.append(panel);
  on(qs("#cok", panel), "click", () => {
    setConsent(true);
    syncWalletTrackButtonLabels();
    panel.remove();
  });
  on(qs("#cno", panel), "click", () => {
    setConsent(false);
    state.w = [];
    syncWalletTrackButtonLabels();
    panel.remove();
  });
}
