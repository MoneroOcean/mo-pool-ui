import { BLOCK_SHARE_DUMP_BASE, COIN_EXPLORERS, COIN_HEIGHT_EXPLORERS, GRAPH_WINDOWS, UPTIME_URL } from "../constants.js";
import { PAGE_SIZES } from "../paging.js";
import { atomicXmr, encodeUrlPart, escapeHtml, formatAge, formatDate, formatNumber, isFiniteNumber } from "../format.js";
import { coinName } from "../pool.js";
import { uptimeToneClass } from "../uptime.js";

const EXTERNAL_LINK = "rel=noopener target=_blank";

export function skel(label = "Loading") {
  return `<div class=skeleton role=status aria-label="${escapeHtml(label)}"><span class=skeleton-text aria-hidden=true>${glyphLines()}</span></div>`;
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
  return `<section class=panel><div class=card><h2>Data unavailable</h2><p class=red>${escapeHtml(error.message || error)}</p></div></section>`;
}

export function recover(promise, fallback) {
  return promise.catch(() => fallback);
}

export function kpi(label, value, explain) {
  return `<div title="${escapeHtml(explain)}"><span class=value>${escapeHtml(value)}</span><span class=label>${cellHtml(label)}</span><p class="explanation comments-controlled">${escapeHtml(explain)}</p></div>`;
}

export function linkLabel(label, href) {
  return { html: `<a href="${href}">${escapeHtml(label)}</a>` };
}

export function activeAttr(active) {
  return active ? " aria-current=page" : "";
}

export function chipLink(label, href, active = false, attrs = "") {
  return `<a class=chip href="${href}"${activeAttr(active)}${attrs ? ` ${attrs}` : ""}>${escapeHtml(label)}</a>`;
}

export function graphControls(routeFor, graphWindow, graphMode, className = "bar sbr") {
  return `<div class="${className}"><div class="bar">${GRAPH_WINDOWS.map((win) => chipLink(win[1], routeFor(win[0], graphMode), graphWindow === win[0])).join("")}</div><div class="bar bar-right">${chipLink("XMR", routeFor(graphWindow, "xmr"), graphMode === "xmr")}${chipLink("Raw", routeFor(graphWindow, "raw"), graphMode === "raw")}</div></div>`;
}

export function uptimeLabel(label, uptime) {
  // summarizeUptimeRobot returns semantic tones; this view maps them to status
  // dot classes so tests can stay focused on the tone contract.
  return { html: `<a id=up class="status-link ${uptimeToneClass(uptime.tone)}" href="${UPTIME_URL}" ${EXTERNAL_LINK} title="${escapeHtml(uptime.detail)}"><span class=status-dot aria-hidden=true></span><span>${escapeHtml(label)}</span></a>` };
}

export function tablePage(title, intro, headings, rows, controls = "", tableLabel = "", emptyText = "") {
  const header = title ? `<div class=panel-header><div><h1>${title}</h1>${intro ? `<p class=muted>${intro}</p>` : ""}</div></div>` : "";
  const emptyRow = emptyText ? `<tr><td colspan=${headings.length} class=muted>${escapeHtml(emptyText)}</td></tr>` : "";
  return `<section class=panel>${header}${controls ? `<div class=card>${controls}</div>` : ""}<div class="card table-wrap"><table${tableLabel ? ` aria-label="${escapeHtml(tableLabel)}"` : ""}><thead><tr>${headings.map((h) => `<th class="${hashHeadingClass(h)}">${cellHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cellHtml(cell)}</td>`).join("")}</tr>`).join("") || emptyRow}</tbody></table></div></section>`;
}

export function cellHtml(cell) {
  return cell && typeof cell === "object" && "html" in cell ? cell.html : escapeHtml(cell);
}

function hashHeadingClass(heading) {
  const text = typeof heading === "string" ? heading : "";
  return /^(hash|block hash|tx hash|transaction|transaction or block)$/i.test(text) ? "hash-heading" : "";
}

export function coinCell(value) {
  return { html: `<span class=coin-cell>${cellHtml(value)}</span>` };
}

export function explorerHeightLink(port, height) {
  const value = height || "--";
  const url = explorerHeightUrl(port, value);
  if (!url || value === "--") return value;
  return { html: `<a href="${url}" ${EXTERNAL_LINK} title="Open ${escapeHtml(coinName({}, port))} block ${escapeHtml(value)}">${escapeHtml(value)}</a>` };
}

function explorerHeightUrl(port, height) {
  const template = COIN_HEIGHT_EXPLORERS[port] || COIN_HEIGHT_EXPLORERS[Number(port)];
  if (template) return template.replace("{height}", encodeUrlPart(height));
  return COIN_EXPLORERS[port] || COIN_EXPLORERS[Number(port)] || "";
}

export function blockHashLink(hash) {
  if (!hash) return "--";
  const href = `${BLOCK_SHARE_DUMP_BASE}/${encodeUrlPart(hash)}.cvs.xz`;
  return { html: `<span class=hash-cell><a href="${href}" ${EXTERNAL_LINK} title="Download share dump CSV">${escapeHtml(hash)}</a></span>` };
}

export function paymentHashLink(hash) {
  if (!hash) return "--";
  return { html: `<span class=hash-cell><a href="https://xmrchain.net/tx/${encodeUrlPart(hash)}" ${EXTERNAL_LINK} title="Open transaction on xmrchain">${escapeHtml(hash)}</a></span>` };
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
  return `<label class=page-picker><span class=muted>Page</span><input id="${id}" type=number min=1 ${hasTotal ? `max=${pageCount}` : ""} value="${value}" inputmode=numeric autocomplete=off>${hasTotal ? `<span class=muted>of ${formatNumber(pageCount)}</span>` : ""}</label>`;
}

export function pageSizeSelect(id, limit) {
  return `<label class=field>Rows<select id="${id}">${PAGE_SIZES.map((size) => `<option value=${size} ${size === limit ? "selected" : ""}>${size}</option>`).join("")}</select></label>`;
}

function pagerArrow(label, href, enabled, ariaLabel) {
  return `<a class="chip pager-arrow" aria-label="${ariaLabel}" ${enabled ? `href="${href}"` : `aria-disabled=true`}>${label}</a>`;
}

export function pagerNav(ariaLabel, inputId, page, pageCount, hasNext, routeFor, limit, canEditPage = true) {
  return `<nav class=bar aria-label="${ariaLabel}">
        ${pagerArrow("‹", routeFor(page - 1, limit), page > 1, "Previous page")}
        ${canEditPage ? pagePicker(inputId, page, pageCount) : `<span class=muted>Page ${formatNumber(page)}</span>`}
        ${pagerArrow("›", routeFor(page + 1, limit), hasNext, "Next page")}
      </nav>`;
}

export function blockRewardAmountCell(label, unlocked) {
  return { html: `<span class="${unlocked ? "green" : ""}" title="${unlocked ? "Unlocked" : "Pending or unlocking"}">${escapeHtml(label)}</span>` };
}

export function optionMarkup(options, selected = "") {
  return options.map(([value, text]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${escapeHtml(text)}</option>`).join("");
}

export { escapeHtml };
