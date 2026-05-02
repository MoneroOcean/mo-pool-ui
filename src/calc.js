import { HASHRATE_UNITS, XMR_PORT } from "./constants.js";
import { isFiniteNumber, trimFixed } from "./format.js";
import { coinProfitValue } from "./pool.js";

export { HASHRATE_UNITS };

const CALC_PERIODS = [
  ["Day", 1],
  ["Week", 7],
  ["Month", 30],
  ["Year", 365]
];

export function fiatForTimezone(timezone = detectedTimezone()) {
  const zone = String(timezone || "");
  // This is only a display currency hint for the calculator, so a broad Europe
  // check is preferable to shipping a long exact timezone allowlist.
  return (zone.startsWith("Europe/") || /^Atlantic\/(Azores|Canary|Madeira)$/.test(zone)) ? { code: "eur", label: "EUR" } : { code: "usd", label: "USD" };
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
  return { value: trimFixed(number / unit[2], 3), unit: unit[0] };
}

export function calcProfitRows(value, unit, poolStats = {}, timezone) {
  const fiat = fiatForTimezone(timezone);
  const phDay = coinProfitValue(poolStats, XMR_PORT);
  const price = Number(poolStats.price?.[fiat.code]);
  return calcRowsForDisplay(value, unit, phDay, price, fiat.label);
}

export function calcRowsForDisplay(value, unit, phDay, price, fiatLabel) {
  const hashrate = hashrateFromInput(value, unit);
  return CALC_PERIODS.map(([label, days]) => {
    const xmr = hashrate * phDay * days;
    return {
      label,
      days,
      xmr: isFiniteNumber(xmr) ? xmr : 0,
      fiat: isFiniteNumber(xmr) && isFiniteNumber(price) ? xmr * price : null,
      fiatLabel
    };
  });
}

export function formatFiat(value, code = "USD") {
  const number = Number(value);
  if (!isFiniteNumber(number)) return "--";
  return number.toLocaleString("en-US", { style: "currency", currency: code.toUpperCase(), maximumFractionDigits: number >= 1 ? 2 : 4 });
}

function detectedTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "";
  }
}
