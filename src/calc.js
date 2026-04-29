import { XMR_PORT } from "./constants.js";
import { isFiniteNumber } from "./format.js";
import { coinProfitValue } from "./pool.js";

export const HASHRATE_UNITS = [
  ["h", "H/s", 1],
  ["kh", "KH/s", 1_000],
  ["mh", "MH/s", 1_000_000]
];

export const CALC_PERIODS = [
  ["day", "Day", 1],
  ["week", "Week", 7],
  ["month", "Month", 30],
  ["year", "Year", 365]
];

export function fiatForTimezone(timezone = detectedTimezone()) {
  const zone = String(timezone || "");
  // This is only a display currency hint for the calculator, so a broad Europe
  // check is preferable to shipping a long exact timezone allowlist.
  return (zone.startsWith("Europe/") || /^Atlantic\/(Azores|Canary|Madeira)$/.test(zone)) ? { code: "eur", label: "EUR", symbol: "EUR" } : { code: "usd", label: "USD", symbol: "USD" };
}

export function hashrateFromInput(value, unit = "h") {
  const number = Number(String(value ?? "").replace(",", "."));
  const selected = HASHRATE_UNITS.find((row) => row[0] === unit) || HASHRATE_UNITS[0];
  return isFiniteNumber(number) && number > 0 ? number * selected[2] : 0;
}

export function hashrateInputFromHashrate(hashrate) {
  const number = Number(hashrate);
  if (!isFiniteNumber(number) || number <= 0) return { value: "1", unit: "kh" };
  // Keep the input readable by selecting the closest mining unit exposed by the calculator.
  const unit = number >= 1_000_000 ? HASHRATE_UNITS[2] : number >= 1_000 ? HASHRATE_UNITS[1] : HASHRATE_UNITS[0];
  return { value: trimCalcNumber(number / unit[2]), unit: unit[0] };
}

export function calcProfitRows(value, unit, poolStats = {}, timezone) {
  const hashrate = hashrateFromInput(value, unit);
  const fiat = fiatForTimezone(timezone);
  const phDay = coinProfitValue(poolStats, XMR_PORT);
  const price = Number(poolStats.price?.[fiat.code]);
  // HASHRATE_UNITS and CALC_PERIODS use tuples to avoid shipping repeated
  // object property names; calculator display rows expand them back to named
  // fields because the rest of the view is easier to read that way.
  return CALC_PERIODS.map(([id, label, days]) => {
    const xmr = hashrate * phDay * days;
    return {
      id,
      label,
      days,
      xmr: isFiniteNumber(xmr) ? xmr : 0,
      fiat: isFiniteNumber(xmr) && isFiniteNumber(price) ? xmr * price : null,
      fiatCode: fiat.label
    };
  });
}

export function formatFiat(value, code = "USD") {
  const number = Number(value);
  if (!isFiniteNumber(number)) return "--";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: code.toUpperCase(), maximumFractionDigits: number >= 1 ? 2 : 4 }).format(number);
}

function detectedTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "";
  }
}

function trimCalcNumber(value) {
  return Number(value).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}
