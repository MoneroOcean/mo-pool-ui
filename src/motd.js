const DISMISSED_KEY = "mo.motd.dismissed.v1";
const sessionDismissed = new Set();

export function normalizeMotd(payload = {}) {
  const source = payload?.motd && typeof payload.motd === "object" ? payload.motd : payload;
  const subject = String(source?.subject || source?.title || "").trim();
  const body = String(source?.body || source?.message || source?.text || "").trim();
  const created = String(source?.created || source?.updated || source?.time || "").trim();
  if (!body) return null;
  const key = [created, subject, body].filter(Boolean).join("|");
  return { subject, body, created, key };
}

export function shouldShowMotd(motd, { persist = true } = {}) {
  if (!motd?.key) return false;
  if (sessionDismissed.has(motd.key)) return false;
  if (!persist) return true;
  return localStorage.getItem(DISMISSED_KEY) !== motd.key;
}

export function dismissMotd(key, { persist = true } = {}) {
  if (!key) return;
  sessionDismissed.add(key);
  if (persist) localStorage.setItem(DISMISSED_KEY, key);
}

export function clearStoredMotdDismissal() { localStorage.removeItem(DISMISSED_KEY); }

export function resetMotdDismissalsForTest() {
  sessionDismissed.clear(); clearStoredMotdDismissal();
}
