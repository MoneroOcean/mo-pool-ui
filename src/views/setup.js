import { api } from "../api.js";
import { isXmrAddress } from "../routes.js";
import { SETUP_GPU_VENDORS, SETUP_HASHRATE_UNITS, SETUP_OS, setupAddress, setupAlgoOptions, setupConfiguredPorts, setupHashrateDefaults, setupPlan, setupProfileOptions } from "../setup.js";
import { state } from "../state.js";
import { escapeHtml, optionMarkup } from "./common.js";
import { byId, on, qs, tog } from "../dom.js";

const SETUP_STEPS = [
  ["Download", "sd", "d", "dn"],
  ["Run TLS", "srt", "rt", "rtn", "srtw"],
  ["Run", "sr", "r", "rn", "srw"],
  ["Tor", "sto", "to", "ton", "stow"],
  ["Point workers at proxy", "sl", "l", "ln", "slw"]
];

export async function setupView() {
  const address = setupWalletAddress();
  const query = state.r.q || {};
  state.s = setupConfiguredPorts(await api.poolPorts().catch(() => ({})));
  const plan = setupPlan({
    address,
    os: query.o,
    profile: query.p,
    gpu: query.g,
    algo: query.al,
    hashrate: query.h,
    hashrateUnit: query.u,
    ports: state.s
  });
  if (!plan.s.p) return `<section class=pn><div class=cd><h1>${escapeHtml(plan.tt)}</h1><p class=red>${escapeHtml(plan.sm)}</p></div></section>`;
  const showGpu = setupShowsGpu(plan.s.pr);
  const showAlgo = setupShowsAlgo(plan.s.pr);
  return `
    <div class="gd spg">
      <section class="pn scp">
        <div class="cd sc" title="${escapeHtml(plan.nt)}">
          ${setupTopTabs(plan)}
          <label class=sw>XMR wallet<input id=sw value="${escapeHtml(address)}" autocomplete=off></label>
          <div class="sfr">
            ${setupSelect("sg", "GPU", SETUP_GPU_VENDORS, plan.s.g, `sfg ${showGpu ? "" : "hd"}`)}
            ${setupSelect("sa", "Algorithm", setupAlgoOptions(plan.s.pr), plan.s.al, `sfa ${showAlgo ? "" : "hd"}`)}
            <label class=shc>XMR h/r<input id=shr value="${escapeHtml(String(plan.s.hr))}" inputmode=decimal autocomplete=off></label>
            <label class="su">Unit<select id="shu">${optionMarkup(SETUP_HASHRATE_UNITS.map(([id, label]) => [id, label]), plan.s.hu)}</select></label>
          </div>
          <p id="sn" class="ex dx">${escapeHtml(plan.nt)}</p>
        </div>
      </section>
      ${SETUP_STEPS.map(([title, id, textKey, noteKey, wrapId]) => setupStep(title, id, plan[textKey], plan[noteKey], wrapId, wrapId && !plan[textKey])).join("")}
    </div>`;
}

function setupWalletAddress() {
  return setupAddress({
    queryAddress: isXmrAddress(state.r.q?.a) ? state.r.q.a : "",
    activeAddress: isXmrAddress(state.a) ? state.a : "",
    watchlist: state.w.filter((row) => isXmrAddress(row.address))
  });
}

function setupStep(tt, id, text, note = "", wrapId = "", hidden = false) {
  return `<section${wrapId ? ` id="${escapeHtml(wrapId)}"` : ""} class="pn ss ${hidden ? "hd" : ""}"><div class=cd><h2 id="${id}-tt" title="${escapeHtml(note)}">${escapeHtml(tt)}</h2><p id="${id}-note" class="ex dx ${note ? "" : "hd"}">${escapeHtml(note)}</p><div class=cbx><button class=cpy data-c="#${id}">Copy</button><pre id="${id}">${escapeHtml(text || "")}</pre></div></div></section>`;
}

function setupSelect(id, label, options, selected, className) {
  return `<label class="${className}">${label}<select id="${id}">${optionMarkup(options, selected)}</select></label>`;
}

function setupTopTabs(plan) {
  return `<div class="sf stf">
    <input id="so" type="hidden" value="${escapeHtml(plan.s.os)}">
    <input id="sp" type="hidden" value="${escapeHtml(plan.s.pr)}">
    <div id="stt" class="sts" title="${escapeHtml(plan.nt)}">${setupTopButtons(plan)}</div>
  </div>`;
}

function setupTopButtons(plan) {
  const profileOptions = setupProfileOptions(plan.s.os).map((row) => [
    row[0],
    row[1],
    row[0] === plan.s.pr ? plan.nt : row[2]
  ]);
  return `<span class="stg">${setupTabs("so", SETUP_OS, plan.s.os)}</span><span class="stg">${setupTabs("sp", profileOptions, plan.s.pr)}</span>`;
}

function setupTabs(id, options, selected) {
  return options.map(([value, text, tt = text]) => `<button class="st" data-si="${id}" data-v="${escapeHtml(value)}" aria-pressed="${value === selected ? "true" : "false"}" title="${escapeHtml(tt)}">${escapeHtml(text)}</button>`).join("");
}

export function bindSetupEvents() {
  ["sa", "sw", "shr", "shu"].forEach((id) => {
    on(byId(id), "input", updateSetupCommand);
  });
  ["sa", "shu"].forEach((id) => {
    on(byId(id), "change", updateSetupCommand);
  });
  on(byId("sg"), "change", () => {
    resetSetupHashrate();
    updateSetupCommand();
  });
  on(qs(".sc"), "click", (event) => {
    const button = event.target.closest("[data-si]");
    if (!button) return;
    const input = byId(button.dataset.si);
    if (!input) return;
    input.value = button.dataset.v || "";
    resetSetupHashrate();
    updateSetupCommand();
  });
}

function updateSetupCommand() {
  const plan = setupPlan({
    os: byId("so")?.value,
    profile: byId("sp")?.value,
    gpu: byId("sg")?.value,
    algo: byId("sa")?.value,
    address: byId("sw")?.value,
    hashrate: byId("shr")?.value,
    hashrateUnit: byId("shu")?.value,
    ports: state.s
  });
  syncSetupCommand(plan);
  syncSetupRoute(plan);
}

function syncSetupCommand(plan) {
  const nt = byId("sn");
  const controls = qs(".sc");
  SETUP_STEPS.forEach(([, id, textKey, noteKey, wrapId]) => syncSetupStep(id, plan[textKey], plan[noteKey], wrapId));
  if (nt) {
    nt.textContent = plan.nt;
  }
  if (controls) controls.title = plan.nt;
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
    tog(noteNode, "hd", !note);
  }
  if (wrapId) tog(byId(wrapId), "hd", !text);
}

function syncSetupInputs(plan) {
  const os = byId("so");
  const profile = byId("sp");
  const algo = byId("sa");
  const hashrate = byId("shr");
  const hashrateUnit = byId("shu");
  if (os) os.value = plan.s.os;
  if (profile) profile.value = plan.s.pr;
  if (hashrate) hashrate.value = String(plan.s.hr);
  if (hashrateUnit) hashrateUnit.value = plan.s.hu;
  if (algo) {
    algo.innerHTML = optionMarkup(setupAlgoOptions(plan.s.pr), plan.s.al);
    algo.value = plan.s.al;
  }
  const tabs = byId("stt");
  if (tabs) {
    tabs.innerHTML = setupTopButtons(plan);
    tabs.title = plan.nt;
  }
  tog(qs(".sfg"), "hd", !setupShowsGpu(plan.s.pr));
  tog(qs(".sfa"), "hd", !setupShowsAlgo(plan.s.pr));
}

function syncSetupRoute(plan) {
  if (state.r.n !== "setup") return;
  const query = { o: plan.s.os, p: plan.s.pr, h: String(plan.s.hr), u: plan.s.hu };
  if (isXmrAddress(plan.s.a)) query.a = plan.s.a;
  if (setupShowsGpu(plan.s.pr)) query.g = plan.s.g;
  if (setupShowsAlgo(plan.s.pr)) query.al = plan.s.al;
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
    os: byId("so")?.value,
    profile: byId("sp")?.value,
    gpu: byId("sg")?.value
  });
  const defaults = setupHashrateDefaults(plan.s.pr, plan.s.g);
  const hashrate = byId("shr");
  const unit = byId("shu");
  if (hashrate) hashrate.value = String(defaults.value);
  if (unit) unit.value = defaults.unit;
}
