import { averageVisible, chartModel, filterWindow, isWithinPplnsWindow, pplnsWindowRect, svgLine } from "../charts.js";
import { formatDate, formatHashrate, normalizeTimestampSeconds } from "../format.js";
import { state } from "../state.js";
import { escapeHtml } from "./common.js";
import { attr, on, qs, qsa } from "../dom.js";

export function chartHtml(model, line, raw, average, label, detail = "") {
  // The chart is plain SVG plus a small data-pts payload so hover works without
  // shipping a charting library. Hover points keep named fields because the
  // cursor math below is easy to break when these are anonymous array indexes.
  const pointData = escapeHtml(JSON.stringify(model.r.map((row) => ({ x: row.x, y: row.z, t: row.tme, v: row.v }))));
  const pplns = pplnsWindowRect(model, state.p);
  const pplnsRect = pplns ? `<rect class="pw" x="${pplns.x.toFixed(1)}" width="${pplns.width.toFixed(1)}" height="${pplns.height}"></rect>` : "";
  const detailLine = (Array.isArray(detail) ? detail : detail ? [detail] : []).map((line) => `<small>${escapeHtml(line)}</small>`).join("");
  return `<div class="cs"><div class="ys">${scaleRows(model.n, model.x).map((value) => `<span>${formatHashrate(value)}</span>`).join("")}</div><div class="ca"><div class="cw"><div class="coo"><span class=csm><span>Average ${formatHashrate(average)} · PPLNS ${formatHashrate(pplnsAverage(model))}</span>${detailLine}</span><span class=cr>Point: move over graph</span></div><svg class="ctt hc" viewBox="0 0 700 220" preserveAspectRatio="none" role="img" aria-label="${escapeHtml(label)}" data-pts="${pointData}">${pplnsRect}<path class="rw" d="${raw}"></path><path class="smo" d="${line}"></path><line class="cur cv" x1="0" x2="0" y1="0" y2="220"></line><line class="cur chz" x1="0" x2="700" y1="0" y2="0"></line></svg></div><div class="xs">${timeTicks(model.s, model.e).map((tick) => `<span>${escapeHtml(tick)}</span>`).join("")}</div></div></div>`;
}

export function hashrateChart(rows, graphWindow, key = "hsh2") {
  return chartForPoints(filterWindow(normalizeGraph(rows), graphWindow), key);
}

function chartForPoints(points, key = "hsh2") {
  return {
    p: points,
    l: svgLine(points, key, 700, 220, true),
    r: svgLine(points, key),
    a: averageVisible(points, key),
    m: chartModel(points, key)
  };
}

function pplnsAverage(model) {
  const windowSeconds = Number(state.p) || 0;
  if (!windowSeconds || !model.r?.length) return 0;
  const minTime = model.e - windowSeconds;
  const rows = model.r.filter((row) => row.tme >= minTime);
  if (!rows.length) return 0;
  return rows.reduce((sum, row) => sum + Number(row.v || 0), 0) / rows.length;
}

function scaleRows(min, max) {
  const span = Math.max(1, max - min);
  return [max, min + span * 0.75, min + span * 0.5, min + span * 0.25, min];
}

function timeTicks(minTime, maxTime) {
  const ticks = 3;
  const span = Math.max(1, maxTime - minTime);
  return Array.from({ length: ticks }, (_, index) => {
    const ts = minTime + span * (index / (ticks - 1));
    const date = new Date(ts * 1000);
    return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  });
}

export function bindChartHover() {
  qsa(".hc").forEach((chart) => {
    if (chart.dataset.hb) return;
    chart.dataset.hb = "1";
    const points = JSON.parse(chart.dataset.pts || "[]");
    const maxTime = Math.max(...points.map((point) => Number(point.t) || 0));
    const readout = qs(".cr", chart.closest(".cd"));
    const vertical = qs(".cv", chart);
    const horizontal = qs(".chz", chart);
    const update = (event) => {
      if (!points.length) return;
      const rect = chart.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 700;
      // Cursor lines form the "aim" marker: one vertical and one horizontal
      // solid line pinned to the nearest real backend sample, not interpolated.
      const point = points.reduce((best, item) => Math.abs(item.x - x) < Math.abs(best.x - x) ? item : best, points[0]);
      attr(vertical, "x1", point.x);
      attr(vertical, "x2", point.x);
      attr(horizontal, "y1", point.y);
      attr(horizontal, "y2", point.y);
      chart.classList.add("has-cursor");
      const pplns = isWithinPplnsWindow(point.t, maxTime, state.p) ? " · PPLNS" : "";
      if (readout) readout.textContent = `${formatDate(point.t)} · ${formatHashrate(point.v)}${pplns}`;
    };
    on(chart, "pointermove", update);
    on(chart, "pointerleave", () => {
      chart.classList.remove("has-cursor");
      if (readout) readout.textContent = "Point: move over graph";
    });
  });
}

export function normalizeGraph(stats) {
  const rows = Array.isArray(stats) ? stats : Array.isArray(stats?.stats) ? stats.stats : Array.isArray(stats?.charts) ? stats.charts : [];
  if (!rows.length) return [];
  return rows.map(normalizeGraphRow).filter((row) => row.tme > 0).sort((a, b) => a.tme - b.tme);
}

function normalizeGraphRow(row) {
  return {
    tme: normalizeTimestampSeconds(row.tme ?? row.ts ?? row.time),
    hsh: Number(row.hsh ?? row.hs ?? row.hash ?? 0),
    hsh2: Number(row.hsh2 ?? row.hs2 ?? row.hash2 ?? row.hsh ?? row.hs ?? 0)
  };
}
