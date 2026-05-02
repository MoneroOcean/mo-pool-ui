import { api } from "../api.js";
import { HASHRATE_UNITS, calcProfitRows, calcRowsForDisplay, fiatForTimezone, formatFiat, hashrateInputFromHashrate } from "../calc.js";
import { XMR_PORT } from "../constants.js";
import { encodeUrlPart, formatXmr, isFiniteNumber } from "../format.js";
import { coinProfitValue } from "../pool.js";
import { averageVisible, filterWindow } from "../charts.js";
import { state } from "../state.js";
import { escapeHtml } from "./common.js";
import { normalizeGraph } from "./charts.js";

export async function calcView(route = state.r) {
  const pool = await api.poolStats();
  const defaultHashrate = route.q?.rate ? null : await trackedWalletHashrate();
  const defaultInput = hashrateInputFromHashrate(defaultHashrate);
  const unit = HASHRATE_UNITS.some((row) => row[0] === route.q?.unit) ? route.q.unit : defaultInput.unit;
  const value = route.q?.rate ? calcInputValue(route.q.rate) : defaultInput.value;
  const rows = calcProfitRows(value, unit, pool);
  const fiat = fiatForTimezone();
  const price = Number(pool.price?.[fiat.code]);
  const phDay = coinProfitValue(pool, XMR_PORT);
  return `<section class=panel>
    <div class="card grid calc-grid">
      <form id="calc-form" class="calc-form" data-profit-per-hash="${escapeHtml(phDay)}" data-price="${escapeHtml(isFiniteNumber(price) ? price : "")}" data-fiat-code="${escapeHtml(fiat.label)}">
        <label>Hashrate<input id=ch inputmode=decimal autocomplete=off value="${escapeHtml(value)}"></label>
        <label>Unit<select id="cu">${HASHRATE_UNITS.map(([id, label]) => `<option value="${id}" ${id === unit ? "selected" : ""}>${label}</option>`).join("")}</select></label>
      </form>
      <div class="calc-results">
        ${rows.map((row) => `<article class="calc-result-card" title="${escapeHtml(row.label)} estimate">
          <span class="label">${escapeHtml(row.label)}</span>
          <span class="value xmr-output" data-period="${row.days}">${escapeHtml(formatXmr(row.xmr, 8))}</span>
          <span class="muted fiat-output" data-period="${row.days}">${escapeHtml(formatFiat(row.fiat, row.fiatLabel))}</span>
        </article>`).join("")}
      </div>
      <p class="muted calc-footnote">XMR ${isFiniteNumber(price) ? `${fiat.label} price ${formatFiat(price, fiat.label)}.` : `${fiat.label} price unavailable from API.`}</p>
    </div>
  </section>`;
}

async function trackedWalletHashrate() {
  const addresses = state.w.map((row) => row.address).filter(Boolean);
  if (!addresses.length) return 0;
  const rows = await Promise.allSettled(addresses.map((address) => trackedWalletAverage(address)));
  return rows.reduce((sum, row) => sum + (row.status === "fulfilled" ? Number(row.value) || 0 : 0), 0);
}

async function trackedWalletAverage(address) {
  try {
    const chartRows = await api.walletChart(address);
    const points = filterWindow(normalizeGraph(chartRows), "24h");
    const average = averageVisible(points, "hsh2");
    if (average > 0) return average;
  } catch {
    // Fall back to current wallet stats below when chart history is unavailable.
  }
  try {
    const walletStats = await api.wallet(address);
    return Number(walletStats?.hash2 || walletStats?.hash || 0);
  } catch {
    return 0;
  }
}

export function calcRoute(value, unit) {
  return `#/calc?rate=${encodeUrlPart(calcInputValue(value))}&unit=${HASHRATE_UNITS.some((row) => row[0] === unit) ? unit : "kh"}`;
}

function calcInputValue(value) {
  const text = String(value ?? "1").replace(",", ".").trim();
  const number = Number(text);
  return isFiniteNumber(number) && number > 0 ? text : "1";
}

export { calcRowsForDisplay };
