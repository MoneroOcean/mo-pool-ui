import { api } from "../api.js";
import { CALC_PERIODS, HASHRATE_UNITS, calcProfitRows, fiatForTimezone, formatFiat, hashrateFromInput, hashrateInputFromHashrate } from "../calc.js";
import { XMR_PORT } from "../constants.js";
import { formatXmr, isFiniteNumber } from "../format.js";
import { coinProfitValue } from "../pool.js";
import { averageVisible, filterWindow } from "../charts.js";
import { state } from "../state.js";
import { escapeHtml } from "./common.js";
import { normalizeGraph } from "./charts.js";

export async function calcView(route = state.r) {
  const pool = await api.poolStats();
  const defaultHashrate = route.q?.h ? null : await trackedWalletHashrate();
  const defaultInput = hashrateInputFromHashrate(defaultHashrate);
  const unit = HASHRATE_UNITS.some((row) => row[0] === route.q?.u) ? route.q.u : defaultInput.unit;
  const value = route.q?.h ? calcInputValue(route.q.h) : defaultInput.value;
  const rows = calcProfitRows(value, unit, pool);
  const fiat = fiatForTimezone();
  const price = Number(pool.price?.[fiat.code]);
  const phDay = coinProfitValue(pool, XMR_PORT);
  return `<section class="pn">
    <div class="cd gd cg">
      <form id="cfm" class="cfm" data-ph="${escapeHtml(phDay)}" data-price="${escapeHtml(isFiniteNumber(price) ? price : "")}" data-fc="${escapeHtml(fiat.label)}">
        <label>Hashrate<input id="ch" inputmode="decimal" autocomplete="off" value="${escapeHtml(value)}"></label>
        <label>Unit<select id="cu">${HASHRATE_UNITS.map(([id, label]) => `<option value="${id}" ${id === unit ? "selected" : ""}>${label}</option>`).join("")}</select></label>
      </form>
      <div class="crs">
        ${rows.map((row) => `<article class="crc" title="${escapeHtml(row.label)} estimate">
          <span class="lb">${escapeHtml(row.label)}</span>
          <span class="vl cx" data-p="${row.days}">${escapeHtml(formatXmr(row.xmr, 8))}</span>
          <span class="mt cfi" data-p="${row.days}">${escapeHtml(formatFiat(row.fiat, row.fiatCode))}</span>
        </article>`).join("")}
      </div>
      <p class="mt cf">XMR ${isFiniteNumber(price) ? `${fiat.label} price ${formatFiat(price, fiat.label)}.` : `${fiat.label} price unavailable from API.`}</p>
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
  const params = new URLSearchParams();
  params.set("h", calcInputValue(value));
  params.set("u", HASHRATE_UNITS.some((row) => row[0] === unit) ? unit : "kh");
  return `#/calc?${params.toString()}`;
}

function calcInputValue(value) {
  const text = String(value ?? "1").replace(",", ".").trim();
  const number = Number(text);
  return isFiniteNumber(number) && number > 0 ? text : "1";
}

export function calcRowsForDisplay(value, unit, phDay, price, fc) {
  const hashrate = hashrateFromInput(value, unit);
  return CALC_PERIODS.map(([id, label, days]) => {
    const xmr = hashrate * phDay * days;
    return {
      id,
      label,
      days,
      xmr: isFiniteNumber(xmr) ? xmr : 0,
      fiat: isFiniteNumber(xmr) && isFiniteNumber(price) ? xmr * price : null,
      fc
    };
  });
}
