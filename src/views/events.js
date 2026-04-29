import { formatFiat } from "../calc.js";
import { formatXmr, isFiniteNumber } from "../format.js";
import { dismissMotd } from "../motd.js";
import { appendWallet, rmWallet, loadWatchlist, localHistoryEnabled, setConsent } from "../privacy.js";
import { state } from "../state.js";
import { trackWalletState } from "../wallet.js";
import { blockRoute } from "./blocks.js";
import { calcRoute, calcRowsForDisplay } from "./calc.js";
import { bindChartHover } from "./charts.js";
import { bindSettingsForms, syncWalletTabsAlignment, walletPaymentRoute } from "./wallet.js";
import { paymentRoute } from "./payments.js";
import { bindSetupEvents, syncSetupLayout } from "./setup.js";
import { syncWalletTrackButtonLabels } from "./home.js";
import { attr, off, on, byId, qs, qsa } from "../dom.js";

export function bindViewEvents() {
  on(qs("#af"), "submit", (event) => {
    event.preventDefault();
    const address = qs("#ai").value.trim();
    const tracked = trackWalletState(state.w, address);
    if (tracked.nextHash) {
      state.w = appendWallet(address);
      location.hash = tracked.nextHash;
    }
    else qs("#ai").setCustomValidity("Enter a complete XMR address");
  });
  qsa("[data-rw]").forEach((button) => on(button, "click", () => {
    const address = button.dataset.rw;
    state.w = rmWallet(address);
    byId(`wallet-${address}`)?.remove();
    if (!state.w.length) {
      const walletList = byId("wl");
      if (walletList) walletList.innerHTML = `<div class="cd mt">No wallets tracked yet.</div>`;
      qs(".gs")?.closest(".cd")?.remove();
    }
    if (state.r.n === "wallet" && state.r.a === address) location.hash = "#/";
  }));
  bindBlockControls();
  bindPaymentControls();
  bindWalletPaymentControls();
  bindSettingsForms();
  bindCopyButtons();
  bindMotdDismiss();
  bindCalcEvents();
  bindLocalHistoryControls();
  bindSetupEvents();
  syncViewLayout();
  off(window, "resize", syncViewLayout);
  on(window, "resize", syncViewLayout);
  bindChartHover();
}

function syncViewLayout() {
  syncWalletTabsAlignment();
  syncSetupLayout();
}

function bindBlockControls() {
  on(qs("#bcx"), "change", (event) => {
    location.hash = blockRoute(event.target.value, 1, pageSize("#bps"));
  });
  bindPagedRoute("#bps", "#bpi", (page, size) => blockRoute(selectedValue("#bcx"), page, size));
}

function bindPaymentControls() {
  bindPagedRoute("#pps", "#ppi", paymentRoute);
}

function bindWalletPaymentControls() {
  bindWalletPager("ww", "withdrawalPage", "withdrawalLimit");
  bindWalletPager("wr", "blockRewardPage", "blockRewardLimit");
}

function bindPagedRoute(sizeSelector, inputSelector, routeFor) {
  on(qs(sizeSelector), "change", (event) => {
    location.hash = routeFor(1, event.target.value);
  });
  bindPageInput(inputSelector, (page) => routeFor(page, pageSize(sizeSelector)));
}

function bindWalletPager(kind, pageKey, limitKey) {
  on(qs(`#${kind}-page-size`), "change", (event) => {
    location.hash = walletPaymentRoute({ [pageKey]: 1, [limitKey]: event.target.value });
  });
  bindPageInput(`#${kind}-page-input`, (page) => walletPaymentRoute({ [pageKey]: page }));
}

function bindCopyButtons() {
  qsa("[data-c]").forEach((button) => on(button, "click", () => {
    const target = qs(button.dataset.c);
    navigator.clipboard?.writeText(target?.textContent || "");
  }));
}

function bindMotdDismiss() {
  on(qs("[data-dm]"), "click", (event) => {
    dismissMotd(event.currentTarget.dataset.dm, { persist: localHistoryEnabled() });
    event.currentTarget.closest(".mc")?.remove();
  });
}

function bindCalcEvents() {
  const hashrate = qs("#ch");
  const unit = qs("#cu");
  const form = qs("#cfm");
  if (!hashrate || !unit || !form) return;
  on(form, "submit", (event) => event.preventDefault());
  const update = () => {
    const phDay = Number(form.dataset.ph);
    const price = Number(form.dataset.price);
    const fc = form.dataset.fc || "USD";
    const rows = calcRowsForDisplay(hashrate.value, unit.value, phDay, price, fc);
    qsa(".cx").forEach((node) => {
      const row = rows.find((item) => String(item.days) === node.dataset.p);
      if (row) node.textContent = formatXmr(row.xmr, 8);
    });
    qsa(".cfi").forEach((node) => {
      const row = rows.find((item) => String(item.days) === node.dataset.p);
      if (row) node.textContent = formatFiat(row.fiat, row.fc);
    });
    history.replaceState(null, "", calcRoute(hashrate.value, unit.value));
  };
  on(hashrate, "input", update);
  on(unit, "change", update);
}

function bindLocalHistoryControls() {
  const button = qs("[data-lh]");
  if (!button) return;
  const sync = () => {
    const enabled = localHistoryEnabled();
    button.textContent = `${enabled ? "Disable" : "Enable"} local wallet history`;
    attr(button, "aria-pressed", String(enabled));
  };
  sync();
  on(button, "click", () => {
    const enabled = setConsent(!localHistoryEnabled());
    state.w = enabled ? loadWatchlist() : [];
    qs(".cns")?.remove();
    sync();
    syncWalletTrackButtonLabels();
  });
}

function bindPageInput(selector, routeForPage) {
  const input = qs(selector);
  if (!input) return;
  const go = () => {
    const value = Number(input.value);
    const max = input.hasAttribute("max") ? Number(input.max) || 1 : Infinity;
    if (!isFiniteNumber(value) || value < 1) return;
    const page = Math.max(1, Math.floor(value));
    location.hash = routeForPage(isFiniteNumber(max) ? Math.min(max, page) : page);
  };
  on(input, "change", go);
  on(input, "keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      go();
    }
  });
}

function selectedValue(selector, fallback = "") {
  return qs(selector)?.value || fallback;
}

function pageSize(selector) {
  return selectedValue(selector, "15");
}
