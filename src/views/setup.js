import { api } from "../api.js";
import { isXmrAddress } from "../routes.js";
import { SETUP_GPU_VENDORS, SETUP_HASHRATE_UNITS, SETUP_OS, setupAddress, setupAlgoOptions, setupConfiguredPorts, setupHashrateDefaults, setupPlan, setupProfileOptions } from "../setup.js";
import { state } from "../state.js";
import { escapeHtml, optionMarkup } from "./common.js";
import { byId, on, qs, tog } from "../dom.js";

const SETUP_STEPS = [
  ["Download", "setup-download", "downloadCommand", "downloadNote"],
  ["Run TLS", "setup-run-tls", "tlsRunCommand", "tlsRunNote", "setup-run-tls-wrap"],
  ["Run", "setup-run-plain", "plainRunCommand", "plainRunNote", "setup-run-plain-wrap"],
  ["Tor", "setup-run-tor", "torCommand", "torNote", "setup-run-tor-wrap"],
  ["Point workers at proxy", "setup-run-local", "localCommand", "localNote", "setup-run-local-wrap"]
];

export async function setupView() {
  const address = setupWalletAddress();
  const query = state.r.q || {};
  state.s = setupConfiguredPorts(await api.poolPorts().catch(() => ({})));
  const plan = setupPlan({
    address,
    os: query.os,
    profile: query.profile,
    gpu: query.gpu,
    algo: query.algo,
    hashrate: query.rate,
    hashrateUnit: query.unit,
    ports: state.s
  });
  if (!plan.selection.port) return `<section class=panel><div class=card><h1>${escapeHtml(plan.title)}</h1><p class=red>${escapeHtml(plan.summary)}</p></div></section>`;
  const showGpu = setupShowsGpu(plan.selection.profile);
  const showAlgo = setupShowsAlgo(plan.selection.profile);
  return `
    <div class="grid setup-page">
      <section class="panel setup-control-panel">
        <div class="card setup-controls" title="${escapeHtml(plan.notes)}">
          ${setupTopTabs(plan)}
          <label class=setup-wallet>XMR wallet<input id=setup-wallet value="${escapeHtml(address)}" autocomplete=off></label>
          <div class="setup-form-row">
            ${setupSelect("setup-gpu", "GPU", SETUP_GPU_VENDORS, plan.selection.gpu, `setup-gpu-field ${showGpu ? "" : "hidden"}`)}
            ${setupSelect("setup-algo", "Algorithm", setupAlgoOptions(plan.selection.profile), plan.selection.algo, `setup-algo-field ${showAlgo ? "" : "hidden"}`)}
            <label class=setup-hashrate>XMR h/r<input id=setup-hashrate-input value="${escapeHtml(String(plan.selection.hashrate))}" inputmode=decimal autocomplete=off></label>
            <label class="setup-unit">Unit<select id="setup-hashrate-unit">${optionMarkup(SETUP_HASHRATE_UNITS.map(([id, label]) => [id, label]), plan.selection.hashrateUnit)}</select></label>
          </div>
          <p id="setup-notes" class="explanation comments-controlled">${escapeHtml(plan.notes)}</p>
        </div>
      </section>
      ${SETUP_STEPS.map(([title, id, textKey, noteKey, wrapId]) => setupStep(title, id, plan[textKey], plan[noteKey], wrapId, wrapId && !plan[textKey])).join("")}
    </div>`;
}

function setupWalletAddress() {
  return setupAddress({
    queryAddress: isXmrAddress(state.r.q?.addr) ? state.r.q.addr : "",
    activeAddress: isXmrAddress(state.a) ? state.a : "",
    watchlist: state.w.filter((row) => isXmrAddress(row.address))
  });
}

function setupStep(tt, id, text, note = "", wrapId = "", hidden = false) {
  return `<section${wrapId ? ` id="${escapeHtml(wrapId)}"` : ""} class="panel setup-step ${hidden ? "hidden" : ""}"><div class=card><h2 id="${id}-tt" title="${escapeHtml(note)}">${escapeHtml(tt)}</h2><p id="${id}-note" class="explanation comments-controlled ${note ? "" : "hidden"}">${escapeHtml(note)}</p><div class=code-box><button class=copy-button data-copy-target="#${id}">Copy</button><pre id="${id}">${escapeHtml(text || "")}</pre></div></div></section>`;
}

function setupSelect(id, label, options, selected, className) {
  return `<label class="${className}">${label}<select id="${id}">${optionMarkup(options, selected)}</select></label>`;
}

function setupTopTabs(plan) {
  return `<div class="setup-field setup-full-field">
    <input id="setup-os" type="hidden" value="${escapeHtml(plan.selection.os)}">
    <input id="setup-profile" type="hidden" value="${escapeHtml(plan.selection.profile)}">
    <div id="setup-tabs-top" class="setup-tabs" title="${escapeHtml(plan.notes)}">${setupTopButtons(plan)}</div>
  </div>`;
}

function setupTopButtons(plan) {
  const profileOptions = setupProfileOptions(plan.selection.os).map((row) => [
    row[0],
    row[1],
    row[0] === plan.selection.profile ? plan.notes : row[2]
  ]);
  return `<span class="setup-tab-group">${setupTabs("setup-os", SETUP_OS, plan.selection.os)}</span><span class="setup-tab-group">${setupTabs("setup-profile", profileOptions, plan.selection.profile)}</span>`;
}

function setupTabs(id, options, selected) {
  return options.map(([value, text, tt = text]) => `<button class="setup-tab" data-setup-input="${id}" data-setup-value="${escapeHtml(value)}" aria-pressed="${value === selected ? "true" : "false"}" title="${escapeHtml(tt)}">${escapeHtml(text)}</button>`).join("");
}

export function bindSetupEvents() {
  ["setup-algo", "setup-wallet", "setup-hashrate-input", "setup-hashrate-unit"].forEach((id) => {
    on(byId(id), "input", updateSetupCommand);
  });
  ["setup-algo", "setup-hashrate-unit"].forEach((id) => {
    on(byId(id), "change", updateSetupCommand);
  });
  on(byId("setup-gpu"), "change", () => {
    resetSetupHashrate();
    updateSetupCommand();
  });
  on(qs(".setup-controls"), "click", (event) => {
    const button = event.target.closest("[data-setup-input]");
    if (!button) return;
    const input = byId(button.dataset.setupInput);
    if (!input) return;
    input.value = button.dataset.setupValue || "";
    resetSetupHashrate();
    updateSetupCommand();
  });
}

function updateSetupCommand() {
  const plan = setupPlan({
    os: byId("setup-os")?.value,
    profile: byId("setup-profile")?.value,
    gpu: byId("setup-gpu")?.value,
    algo: byId("setup-algo")?.value,
    address: byId("setup-wallet")?.value,
    hashrate: byId("setup-hashrate-input")?.value,
    hashrateUnit: byId("setup-hashrate-unit")?.value,
    ports: state.s
  });
  syncSetupCommand(plan);
  syncSetupRoute(plan);
}

function syncSetupCommand(plan) {
  const nt = byId("setup-notes");
  const controls = qs(".setup-controls");
  SETUP_STEPS.forEach(([, id, textKey, noteKey, wrapId]) => syncSetupStep(id, plan[textKey], plan[noteKey], wrapId));
  if (nt) {
    nt.textContent = plan.notes;
  }
  if (controls) controls.title = plan.notes;
  syncSetupInputs(plan);
}

function syncSetupStep(id, text = "", note = "", wrapId = "") {
  const node = byId(id);
  const noteNode = byId(`${id}-note`);
  const tt = byId(`${id}-tt`);
  if (node) node.textContent = text || "";
  if (tt) tt.title = note || "";
  if (noteNode) {
    noteNode.textContent = note || "";
    tog(noteNode, "hidden", !note);
  }
  if (wrapId) tog(byId(wrapId), "hidden", !text);
}

function syncSetupInputs(plan) {
  const os = byId("setup-os");
  const profile = byId("setup-profile");
  const algo = byId("setup-algo");
  const hashrate = byId("setup-hashrate-input");
  const hashrateUnit = byId("setup-hashrate-unit");
  if (os) os.value = plan.selection.os;
  if (profile) profile.value = plan.selection.profile;
  if (hashrate) hashrate.value = String(plan.selection.hashrate);
  if (hashrateUnit) hashrateUnit.value = plan.selection.hashrateUnit;
  if (algo) {
    algo.innerHTML = optionMarkup(setupAlgoOptions(plan.selection.profile), plan.selection.algo);
    algo.value = plan.selection.algo;
  }
  const tabs = byId("setup-tabs-top");
  if (tabs) {
    tabs.innerHTML = setupTopButtons(plan);
    tabs.title = plan.notes;
  }
  tog(qs(".setup-gpu-field"), "hidden", !setupShowsGpu(plan.selection.profile));
  tog(qs(".setup-algo-field"), "hidden", !setupShowsAlgo(plan.selection.profile));
}

function syncSetupRoute(plan) {
  if (state.r.n !== "setup") return;
  const query = { os: plan.selection.os, profile: plan.selection.profile, rate: String(plan.selection.hashrate), unit: plan.selection.hashrateUnit };
  if (isXmrAddress(plan.selection.address)) query.addr = plan.selection.address;
  if (setupShowsGpu(plan.selection.profile)) query.gpu = plan.selection.gpu;
  if (setupShowsAlgo(plan.selection.profile)) query.algo = plan.selection.algo;
  const params = Object.entries(query).map(([key, value]) => `${key}=${value}`).join("&");
  history.replaceState(null, "", `#/setup?${params}`);
  state.r.q = query;
}

function setupShowsGpu(profile) {
  return profile === "srb-gpu" || profile === "meta-miner";
}

function setupShowsAlgo(profile) {
  return profile === "srb-gpu";
}

function resetSetupHashrate() {
  const plan = setupPlan({
    os: byId("setup-os")?.value,
    profile: byId("setup-profile")?.value,
    gpu: byId("setup-gpu")?.value
  });
  const defaults = setupHashrateDefaults(plan.selection.profile, plan.selection.gpu);
  const hashrate = byId("setup-hashrate-input");
  const unit = byId("setup-hashrate-unit");
  if (hashrate) hashrate.value = String(defaults.value);
  if (unit) unit.value = defaults.unit;
}
