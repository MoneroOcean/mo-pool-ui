import { GRAPH_WINDOWS } from "./constants.js";
import { isFiniteNumber } from "./format.js";

export function graphWindow(id) {
  const row = GRAPH_WINDOWS.find((item) => item[0] === id) || GRAPH_WINDOWS.find((item) => item[0] === "12h") || GRAPH_WINDOWS[0];
  return { id: row[0], label: row[1], seconds: row[2] };
}

export function filterWindow(points, windowId, nowSeconds = Date.now() / 1000) {
  const win = graphWindow(windowId);
  if (!isFiniteNumber(win.seconds)) return points;
  return points.filter((point) => nowSeconds - point.tme <= win.seconds);
}

export function averageVisible(points, key = "hsh2") {
  const values = points.map((point) => Number(point[key])).filter(isFiniteNumber);
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function svgLine(points, key, width = 700, height = 220, smooth = false) {
  const bounds = chartBounds(points, key);
  const rows = points.map((point) => {
    const x = ((point.tme - bounds.minTime) / bounds.span) * width;
    const y = chartY(Number(point[key]) || 0, bounds.min, bounds.max, height);
    return { x, y };
  });
  if (smooth && rows.length > 2) return smoothLine(rows);
  return rows.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
}

function smoothLine(rows) {
  let px = rows[0].x;
  let py = rows[0].y;
  return rows.reduce((path, point, index) => {
    if (!index) return `M${px},${py}`;
    const y = py += (point.y - py) * 0.2;
    const mid = (px + point.x) / 2;
    path += ` C${mid},${y} ${mid},${y} ${point.x},${y}`;
    px = point.x;
    return path;
  }, "");
}

export function chartModel(points, key) {
  const bounds = chartBounds(points, key);
  const rows = points.map((point) => {
    const x = ((point.tme - bounds.minTime) / bounds.span) * 700;
    const y = chartY(Number(point[key]) || 0, bounds.min, bounds.max);
    return { ...point, x, y, v: Number(point[key]) || 0 };
  });
  let z = rows[0]?.y || 0;
  for (const row of rows) row.z = z += (row.y - z) * 0.2;
  // Chart models are internal and carried through every graph render, so they
  // use compact keys: n/x min/max value, s/e start/end time, r rendered rows,
  // and row.v value. Public API point names remain untouched.
  return { n: bounds.min, x: bounds.max, s: bounds.minTime, e: bounds.maxTime, r: rows };
}

function chartBounds(points, key) {
  const values = points.map((point) => Number(point[key]) || 0);
  const max = Math.max(1, ...values);
  const min = Math.min(...values, max);
  const minTime = Math.min(...points.map((point) => point.tme));
  const maxTime = Math.max(...points.map((point) => point.tme));
  return { min, max, minTime, maxTime, span: Math.max(1, maxTime - minTime) };
}

export function pplnsWindowRect(model, pplnsSeconds) {
  const seconds = Number(pplnsSeconds);
  if (!model || !isFiniteNumber(seconds) || seconds <= 0) return null;
  const minTime = Number(model.s);
  const maxTime = Number(model.e);
  if (!isFiniteNumber(minTime) || !isFiniteNumber(maxTime) || maxTime <= minTime) return null;
  const span = maxTime - minTime;
  const start = Math.max(0, 700 * ((maxTime - seconds - minTime) / span));
  return { x: start, y: 0, width: 700 - start, height: 220 };
}

export function isWithinPplnsWindow(timestamp, maxTimestamp, pplnsSeconds) {
  const pointTime = Number(timestamp);
  const latestTime = Number(maxTimestamp);
  const seconds = Number(pplnsSeconds);
  if (!isFiniteNumber(pointTime) || !isFiniteNumber(latestTime) || !isFiniteNumber(seconds) || seconds <= 0) return false;
  return latestTime - pointTime <= seconds;
}

function chartY(value, min, max) {
  const span = Math.max(1, max - min);
  return 30.8 + (1 - Math.min(1, Math.max(0, (value - min) / span))) * 154;
}
