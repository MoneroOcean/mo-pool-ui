import { clearStoredMotdDismissal } from "./motd.js";
import { clearPreferenceStorage } from "./preferences.js";
import { isXmrAddress } from "./routes.js";

const KEY = "mo.wallets.v1";
const CONSENT = "mo.consent.v1";
const MAX = 10;
const MAX_AGE = 180 * 24 * 60 * 60 * 1000;

// Ask only in EU/UK-like environments. Everyone else keeps the historical
// default behavior until they explicitly change local history from Help. The
// locale and timezone checks are deliberately broad, not legal advice; they are
// a conservative UX gate around browser-local wallet history.
export function shouldAskConsent(locale = browserLocale(), timezone = browserTimezone()) {
  if (readConsent() !== null) return false;
  return /^(de|fr|es|it|nl|pl|pt|sv|da|fi|el|cs|sk|sl|hu|ro|bg|hr|lt|lv|et|ga|mt|en-GB|en-IE)/i.test(locale) ||
    /^(Europe|Atlantic\/Canary|Atlantic\/Madeira)/.test(timezone);
}

export function localHistoryEnabled() { return canStoreHistory(); }

export function setConsent(value) {
  const allowed = Boolean(value);
  localStorage.setItem(CONSENT, JSON.stringify({ value: allowed, time: Date.now() }));
  if (!allowed) {
    // In no-history mode the denial marker is the only intentionally retained
    // flag. Wallets, MOTD dismissal, theme, and comments settings are cleared so
    // temporary tracking behaves like a fresh non-persistent session.
    clearWalletHistoryStorage();
    clearStoredMotdDismissal();
    clearPreferenceStorage();
  }
  return allowed;
}

export function loadWatchlist() {
  if (!canStoreHistory()) return [];
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) || "[]");
    return rows.filter((row) => isXmrAddress(row.address) && Date.now() - row.time < MAX_AGE).slice(0, MAX);
  } catch {
    return [];
  }
}

export function saveWallet(address) {
  if (!isXmrAddress(address)) return loadWatchlist();
  const next = [{ address, time: Date.now() }, ...loadWatchlist().filter((row) => row.address !== address)].slice(0, MAX);
  return saveWatchlist(next);
}

export function appendWallet(address) {
  if (!isXmrAddress(address)) return loadWatchlist();
  const existing = loadWatchlist().filter((row) => row.address !== address);
  const next = [...existing, { address, time: Date.now() }].slice(-MAX);
  return saveWatchlist(next);
}

export function rmWallet(address) {
  const next = loadWatchlist().filter((row) => row.address !== address);
  return saveWatchlist(next);
}

function saveWatchlist(next) {
  if (canStoreHistory()) localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

function clearWalletHistoryStorage() {
  localStorage.removeItem(KEY);
}

function canStoreHistory() { return readConsent() !== false; }

function readConsent() {
  try {
    const marker = localStorage.getItem(CONSENT);
    if (!marker) return null;
    return Boolean(JSON.parse(marker).value);
  } catch {
    return null;
  }
}

function browserLocale() { return typeof navigator === "undefined" ? "" : navigator.language; }

function browserTimezone() {
  try { return typeof Intl === "undefined" ? "" : Intl.DateTimeFormat().resolvedOptions().timeZone || ""; }
  catch { return ""; }
}
