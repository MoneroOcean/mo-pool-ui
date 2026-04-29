export const isFiniteNumber = Number.isFinite;

export function formatNumber(value, digits = 0) {
  const number = Number(value);
  if (!isFiniteNumber(number)) return "--";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(number);
}

export function formatHashrate(value, unit = "H/s") {
  const number = Number(value);
  if (!isFiniteNumber(number) || number <= 0) return "0 H/s";
  const units = ["H/s", "KH/s", "MH/s", "GH/s", "TH/s", "PH/s"];
  let scaled = number;
  let index = 0;
  while (scaled >= 1000 && index < units.length - 1) {
    scaled /= 1000;
    index += 1;
  }
  return `${scaled >= 100 ? scaled.toFixed(0) : scaled >= 10 ? scaled.toFixed(1) : scaled.toFixed(2)} ${unit === "H/s" ? units[index] : unit}`;
}

export function formatXmr(value, digits = 6) {
  const number = Number(value);
  if (!isFiniteNumber(number)) return "-- XMR";
  return `${number.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "")} XMR`;
}

export function atomicXmr(value) {
  const number = Number(value);
  return isFiniteNumber(number) ? number / 1_000_000_000_000 : 0;
}

export function formatPercent(value, digits = 2) {
  const number = Number(value);
  if (!isFiniteNumber(number)) return "--";
  return `${number.toFixed(digits)}%`;
}

export function formatTinyPercent(value, digits = 2, maxDigits = 8) {
  const number = Number(value);
  if (!isFiniteNumber(number)) return "--";
  if (number === 0) return `${number.toFixed(digits)}%`;
  if (Math.abs(number) >= 10 ** -digits) return `${number.toFixed(digits)}%`;
  return `${number.toFixed(maxDigits).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

export function formatAge(timestampSeconds, now = Date.now()) {
  const ts = normalizeTimestampSeconds(timestampSeconds);
  if (!isFiniteNumber(ts) || ts <= 0) return "--";
  const seconds = Math.max(0, Math.floor((now - ts * 1000) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 365) return `${days}d ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function formatDate(timestampSeconds) {
  const ts = normalizeTimestampSeconds(timestampSeconds);
  if (!isFiniteNumber(ts) || ts <= 0) return "--";
  return new Date(ts * 1000).toLocaleString();
}

export function normalizeTimestampSeconds(value) {
  const number = Number(value);
  if (!isFiniteNumber(number)) return 0;
  return number > 10_000_000_000 ? Math.floor(number / 1000) : number;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function shortAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}
