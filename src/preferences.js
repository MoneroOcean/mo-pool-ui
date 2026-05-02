import { tog } from "./dom.js";
import { encodeUrlPart } from "./format.js";

const THEME_COOKIE = "mo.theme";
const EXPLAIN_COOKIE = "mo.explain";
const MAX_AGE = 180 * 24 * 60 * 60;
const MULTILINE_KPI_MEDIA = "(max-width: 620px)";

export function parseCookieValue(cookieText = "", key) {
  const prefix = `${key}=`;
  return cookieText.split(";").map((item) => item.trim()).find((item) => item.startsWith(prefix))?.slice(prefix.length) || "";
}

export function readPreferences(cookieText = typeof document === "undefined" ? "" : document.cookie) {
  const theme = parseCookieValue(cookieText, THEME_COOKIE) === "light" ? "light" : "dark";
  const explainCookie = parseCookieValue(cookieText, EXPLAIN_COOKIE);
  const explanations = explainCookie === "off" || explainCookie === "on" ? explainCookie : defaultExplanations();
  return { theme, explanations };
}

function defaultExplanations() {
  if (typeof window === "undefined" || !window.matchMedia) return "on";
  return window.matchMedia(MULTILINE_KPI_MEDIA).matches ? "off" : "on";
}

function writePreference(key, value) {
  if (typeof document === "undefined") return;
  document.cookie = `${key}=${encodeUrlPart(value)}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax; Secure`;
}

function clearPreference(key) {
  if (typeof document === "undefined") return;
  document.cookie = `${key}=; Max-Age=0; Path=/; SameSite=Lax; Secure`;
}

export function clearPreferenceStorage() {
  clearPreference(THEME_COOKIE); clearPreference(EXPLAIN_COOKIE);
}

export function saveTheme(theme, { persist = true } = {}) {
  const next = theme === "light" ? "light" : "dark";
  if (persist) writePreference(THEME_COOKIE, next);
  return next;
}

export function saveExplanations(explanations, { persist = true } = {}) {
  const next = explanations === "off" ? "off" : "on";
  if (persist) writePreference(EXPLAIN_COOKIE, next);
  return next;
}

export function applyPreferences(preferences = readPreferences()) {
  tog(document.body, "theme-light", preferences.theme === "light");
  tog(document.body, "comments-off", preferences.explanations === "off");
  return preferences;
}

export function toggleTheme(current) { return current === "light" ? "dark" : "light"; }

export function toggleExplanations(current) { return current === "off" ? "on" : "off"; }
