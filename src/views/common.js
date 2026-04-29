import { BLOCK_SHARE_DUMP_BASE, COIN_EXPLORERS, COIN_HEIGHT_EXPLORERS, GRAPH_WINDOWS, UPTIME_URL } from "../constants.js";
import { PAGE_SIZES } from "../paging.js";
import { atomicXmr, escapeHtml, formatAge, formatDate, formatNumber, isFiniteNumber } from "../format.js";
import { coinName } from "../pool.js";

export function skel(label = "Loading") {
  return `<div class="sk" role="status" aria-label="${escapeHtml(label)}"><span class="skx" aria-hidden="true">${glyphLines()}</span></div>`;
}

function glyphLines() {
  let html = "";
  // Generate matrix-like crawl text instead of shipping a long hard-coded art
  // string. The animation cares about motion and density, not exact characters,
  // and random base36 chunks keep the source and build smaller.
  const run = length => Math.random().toString(36).slice(2, length + 2).toUpperCase();
  for (let index = 0; index < 4; index += 1) html += `<span>${run(2)}/${run(4)} :: ${run(6)}-${run(4)} ${run(4)}</span>`;
  return html;
}

export function errorPanel(error) {
  return `<section class="pn"><div class="cd"><h2>Data unavailable</h2><p class="red">${escapeHtml(error.message || error)}</p></div></section>`;
}

export function settledValue(result, fallback) {
  return result.status === "fulfilled" ? result.value : fallback;
}

export function kpi(label, value, explain) {
  return `<div title="${escapeHtml(explain)}"><span class="vl">${escapeHtml(value)}</span><span class="lb">${cellHtml(label)}</span><p class="ex dx">${escapeHtml(explain)}</p></div>`;
}

export function linkLabel(label, href) {
  return { html: `<a href="${href}">${escapeHtml(label)}</a>` };
}

export function activeAttr(active) {
  return active ? " aria-current='page'" : "";
}

export function chipLink(label, href, active = false, attrs = "") {
  return `<a class="cp" href="${href}"${activeAttr(active)}${attrs ? ` ${attrs}` : ""}>${escapeHtml(label)}</a>`;
}

export function graphControls(routeFor, graphWindow, graphMode, className = "br sbr") {
  return `<div class="${className}"><div class="br">${GRAPH_WINDOWS.map((win) => chipLink(win[1], routeFor(win[0], graphMode), graphWindow === win[0])).join("")}</div><div class="br brr">${chipLink("XMR", routeFor(graphWindow, "normalized"), graphMode === "normalized")}${chipLink("Raw", routeFor(graphWindow, "raw"), graphMode === "raw")}</div></div>`;
}

export function uptimeLabel(label, uptime) {
  // summarizeUptimeRobot returns semantic tones for tests and business logic;
  // the DOM uses short private class hooks documented in style.css.
  const tone = { green: "sgn", yellow: "syo", red: "srd" }[uptime.tone] || "syo";
  return { html: `<a class="ks ${tone}" href="${UPTIME_URL}" rel="noopener" target="_blank" title="${escapeHtml(uptime.detail)}"><span class="sdot" aria-hidden="true"></span><span>${escapeHtml(label)}</span></a>` };
}

export function tablePage(title, intro, headings, rows, controls = "", tableLabel = "", emptyText = "") {
  const header = title ? `<div class="ph"><div><h1>${title}</h1>${intro ? `<p class="mt">${intro}</p>` : ""}</div></div>` : "";
  const emptyRow = emptyText ? `<tr><td colspan="${headings.length}" class="mt">${escapeHtml(emptyText)}</td></tr>` : "";
  return `<section class="pn">${header}${controls ? `<div class="cd">${controls}</div>` : ""}<div class="cd tw"><table${tableLabel ? ` aria-label="${escapeHtml(tableLabel)}"` : ""}><thead><tr>${headings.map((h) => `<th class="${hashHeadingClass(h)}">${cellHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cellHtml(cell)}</td>`).join("")}</tr>`).join("") || emptyRow}</tbody></table></div></section>`;
}

export function cellHtml(cell) {
  return cell && typeof cell === "object" && "html" in cell ? cell.html : escapeHtml(cell);
}

function hashHeadingClass(heading) {
  const text = typeof heading === "string" ? heading : "";
  return /^(hash|block hash|tx hash|transaction|transaction or block)$/i.test(text) ? "hh" : "";
}

export function coinCell(value) {
  return { html: `<span class="ccell">${cellHtml(value)}</span>` };
}

export function explorerHeightLink(port, height) {
  const value = height || "--";
  const url = explorerHeightUrl(port, value);
  if (!url || value === "--") return value;
  return { html: `<a href="${url}" rel="noopener" target="_blank" title="Open ${escapeHtml(coinName({}, port))} block ${escapeHtml(value)}">${escapeHtml(value)}</a>` };
}

function explorerHeightUrl(port, height) {
  const template = COIN_HEIGHT_EXPLORERS[port] || COIN_HEIGHT_EXPLORERS[Number(port)];
  if (template) return template.replace("{height}", encodeURIComponent(height));
  return COIN_EXPLORERS[port] || COIN_EXPLORERS[Number(port)] || "";
}

export function blockHashLink(hash) {
  if (!hash) return "--";
  const href = `${BLOCK_SHARE_DUMP_BASE}/${encodeURIComponent(hash)}.cvs.xz`;
  return { html: `<span class="hcell"><a href="${href}" rel="noopener" target="_blank" title="Download block reward shares CVS">${escapeHtml(hash)}</a></span>` };
}

export function paymentHashLink(hash) {
  if (!hash) return "--";
  return { html: `<span class="hcell"><a href="https://xmrchain.net/tx/${encodeURIComponent(hash)}" rel="noopener" target="_blank" title="Open transaction on xmrchain">${escapeHtml(hash)}</a></span>` };
}

export function dateCell(timestamp) {
  return { html: `<span title="${escapeHtml(formatDate(timestamp))}">${escapeHtml(formatAge(timestamp))}</span>` };
}

export function formatAtomicXmrValue(value, digits = 8) {
  return formatNumber(atomicXmr(value), digits);
}

function pagePicker(id, page, pageCount = 0) {
  const hasTotal = isFiniteNumber(Number(pageCount)) && Number(pageCount) > 0;
  const value = hasTotal ? Math.min(page, pageCount) : page;
  // The page input is intentionally capped only when the backend gives a known
  // total. Wallet block rewards can have an unknown/stale tail, so those views
  // use non-editable page text or an open-ended next arrow instead.
  return `<label class="pp"><span class="mt">Page</span><input id="${id}" type="number" min="1" ${hasTotal ? `max="${pageCount}"` : ""} value="${value}" inputmode="numeric" autocomplete="off">${hasTotal ? `<span class="mt">of ${formatNumber(pageCount)}</span>` : ""}</label>`;
}

export function pageSizeSelect(id, limit) {
  return `<label class="fd">Rows<select id="${id}">${PAGE_SIZES.map((size) => `<option value="${size}" ${size === limit ? "selected" : ""}>${size}</option>`).join("")}</select></label>`;
}

function pagerArrow(label, href, enabled, ariaLabel) {
  return `<a class="cp pa" aria-label="${ariaLabel}" ${enabled ? `href="${href}"` : `aria-disabled="true"`}>${label}</a>`;
}

export function pagerNav(ariaLabel, inputId, page, pageCount, hasNext, routeFor, limit, canEditPage = true) {
  return `<nav class="br" aria-label="${ariaLabel}">
        ${pagerArrow("‹", routeFor(page - 1, limit), page > 1, "Previous page")}
        ${canEditPage ? pagePicker(inputId, page, pageCount) : `<span class="mt">Page ${formatNumber(page)}</span>`}
        ${pagerArrow("›", routeFor(page + 1, limit), hasNext, "Next page")}
      </nav>`;
}

export function blockRewardAmountCell(label, unlocked) {
  return { html: `<span class="${unlocked ? "luck-green" : ""}" title="${unlocked ? "Unlocked" : "Pending or unlocking"}">${escapeHtml(label)}</span>` };
}

export function selectField(id, label, options, selected = "", className = "") {
  return `<label class="${escapeHtml(className)}">${label}<select id="${id}">${optionMarkup(options, selected)}</select></label>`;
}

export function optionMarkup(options, selected = "") {
  return options.map(([value, text]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${escapeHtml(text)}</option>`).join("");
}

export { escapeHtml };
