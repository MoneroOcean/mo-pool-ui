import { api } from "../api.js";
import { PAGE_SIZES, blockPageSize, pageCountFor, pageQuery, routePageNumber } from "../paging.js";
import { state } from "../state.js";
import { atomicXmr, formatNumber } from "../format.js";
import { dateCell, pageSizeSelect, pagerNav, paymentHashLink, tablePage } from "./common.js";

export async function paymentsView(route = state.r) {
  let page = routePageNumber(route.q?.page);
  const limit = blockPageSize(route.q?.limit);
  const pool = await api.poolStats();
  page = Math.min(page, pageCountFor(Number(pool.totalPayments) || 0, limit));
  const payments = await api.payments(page - 1, limit);
  const rows = (payments || []).map((pay) => [
    dateCell(pay.ts || pay.time || pay.timestamp),
    formatNumber(pay.payees || pay.mixin || 0),
    formatNumber(atomicXmr(pay.value ?? pay.amount ?? 0), 8),
    formatNumber(atomicXmr(pay.fee || 0), 8),
    paymentHashLink(pay.hash || pay.txHash)
  ]);
  return tablePage("", "", ["Sent time","Payees","Amount (XMR)","Fee (XMR)","Tx hash"], rows, paymentControls(page, limit, payments?.length || 0, Number(pool.totalPayments) || 0));
}

function paymentControls(page, limit, rowCount, totalCount = 0) {
  const pageCount = pageCountFor(totalCount, limit);
  const hasNext = page < pageCount || (!totalCount && rowCount >= limit);
  return `<div class=block-controls>
    <span></span>
    <div class="page-tools">
      ${pageSizeSelect("pps", limit)}
      ${pagerNav("payments pages", "ppi", page, pageCount, hasNext, paymentRoute, limit)}
    </div>
  </div>`;
}

export function paymentRoute(page = 1, pageSize = PAGE_SIZES[0]) {
  return `#/payments?${pageQuery(page, pageSize)}`;
}
