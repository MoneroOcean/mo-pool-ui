import { tog } from "./dom.js";
import { encodeUrlPart } from "./format.js";

const THEME_COOKIE = "mo.theme";
const EXPLAIN_COOKIE = "mo.explain";
const MAX_AGE = 180 * 24 * 60 * 60;

export function parseCookieValue(cookieText = "", key) {
  const prefix = `${key}=`;
  return cookieText.split(";").map((item) => item.trim()).find((item) => item.startsWith(prefix))?.slice(prefix.length) || "";
}

export function readPreferences(cookieText = typeof document === "undefined" ? "" : document.cookie) {
  const theme = parseCookieValue(cookieText, THEME_COOKIE) === "light" ? "light" : "dark";
  const explanations = parseCookieValue(cookieText, EXPLAIN_COOKIE) === "off" ? "off" : "on";
  return { theme, explanations };
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
  tog(document.body, "tl", preferences.theme === "light");
  tog(document.body, "cof", preferences.explanations === "off");
  return preferences;
}

export function toggleTheme(current) { return current === "light" ? "dark" : "light"; }

export function toggleExplanations(current) { return current === "off" ? "on" : "off"; }
