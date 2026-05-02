import test from "node:test";
import assert from "node:assert/strict";
import { formatFiat } from "../src/calc.js";
import { DONATION_XMR } from "../src/constants.js";
import { formatXmr } from "../src/format.js";
import { payoutPolicyFromConfig } from "../src/settings.js";
import { api } from "../src/api.js";
import { state } from "../src/state.js";
import { setupConfiguredPorts } from "../src/setup.js";
import { bindSettingsForms } from "../src/views/wallet.js";
import { bindSetupEvents } from "../src/views/setup.js";
import { bindChartHover } from "../src/views/charts.js";
import { pagerNav } from "../src/views/common.js";
import { applyPreferences, saveExplanations, saveTheme, toggleExplanations, toggleTheme } from "../src/preferences.js";

class TestEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.key = options.key;
    this.submitter = options.submitter;
    this.clientX = options.clientX;
    this.defaultPrevented = false;
    this.target = null;
    this.currentTarget = null;
  }
  preventDefault() { this.defaultPrevented = true; }
}

class TestClassList {
  constructor(node) { this.node = node; }
  contains(name) { return classes(this.node).includes(name); }
  toggle(name, force) {
    const current = new Set(classes(this.node));
    const enabled = force === undefined ? !current.has(name) : Boolean(force);
    if (enabled) current.add(name);
    else current.delete(name);
    this.node.className = [...current].join(" ");
    return enabled;
  }
}

class TestNode {
  constructor(tagName = "div", attrs = {}) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.listeners = {};
    this.attributes = {};
    this.dataset = {};
    this.className = "";
    this.id = "";
    this.value = "";
    this.max = "";
    this.textContent = "";
    this.innerHTML = "";
    this.disabled = false;
    this.validationMessage = "";
    this.rect = { left: 0, width: 100, top: 0, height: 100 };
    this.classList = new TestClassList(this);
    for (const [name, value] of Object.entries(attrs)) this.setAttribute(name, value);
  }
  append(...nodes) {
    for (const node of nodes) {
      node.parentElement = this;
      this.children.push(node);
    }
  }
  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((node) => node !== this);
    this.parentElement = null;
  }
  setAttribute(name, value) {
    const text = String(value);
    this.attributes[name] = text;
    if (name === "id") this.id = text;
    if (name === "class") this.className = text;
    if (name === "max") this.max = text;
    if (name.startsWith("data-")) this.dataset[dataKey(name)] = text;
  }
  getAttribute(name) {
    if (name === "id") return this.id || null;
    if (name === "class") return this.className || null;
    return this.attributes[name] ?? null;
  }
  hasAttribute(name) { return this.getAttribute(name) !== null; }
  removeAttribute(name) {
    delete this.attributes[name];
    if (name === "id") this.id = "";
    if (name === "class") this.className = "";
  }
  setCustomValidity(message) { this.validationMessage = String(message); }
  getBoundingClientRect() { return this.rect; }
  addEventListener(type, handler) {
    this.listeners[type] ||= [];
    this.listeners[type].push(handler);
  }
  dispatchEvent(event) {
    event.target ||= this;
    event.currentTarget = this;
    const results = [];
    for (const handler of this.listeners[event.type] || []) results.push(handler(event));
    const promise = Promise.all(results);
    promise.defaultPrevented = event.defaultPrevented;
    return promise;
  }
  click() { this.dispatchEvent(new TestEvent("click")); }
  querySelector(selector) { return query(this, selector, true)[0] || null; }
  querySelectorAll(selector) { return query(this, selector, false); }
  closest(selector) {
    let node = this;
    while (node) {
      if (matches(node, selector)) return node;
      node = node.parentElement;
    }
    return null;
  }
}

class TestDocument extends TestNode {
  constructor() {
    super("document");
    this.body = new TestNode("body");
    this.append(this.body);
  }
  getElementById(id) {
    return walk(this).find((node) => node.id === id) || null;
  }
}

function el(tagName, attrs = {}, children = []) {
  const node = new TestNode(tagName, attrs);
  for (const child of children) node.append(child);
  return node;
}

function classes(node) {
  return String(node.className || "").split(/\s+/).filter(Boolean);
}

function hasClasses(node, expected) {
  const actual = new Set(classes(node));
  return expected.every((name) => actual.has(name));
}

function dataKey(name) {
  return name.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

function walk(root) {
  return [root, ...root.children.flatMap(walk)];
}

function query(root, selector, first) {
  const selectors = selector.split(",").map((item) => item.trim()).filter(Boolean);
  const found = [];
  for (const node of walk(root).slice(1)) {
    if (selectors.some((item) => matches(node, item))) {
      found.push(node);
      if (first) break;
    }
  }
  return found;
}

function matches(node, selector) {
  if (selector.startsWith("#")) return node.id === selector.slice(1);
  if (selector.startsWith(".")) return classes(node).includes(selector.slice(1));
  const attr = selector.match(/^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/);
  if (attr) return attr[2] === undefined ? node.hasAttribute(attr[1]) : node.getAttribute(attr[1]) === attr[2];
  return node.tagName.toLowerCase() === selector.toLowerCase();
}

function installDom({ width = 800 } = {}) {
  const document = new TestDocument();
  const storage = new Map();
  const writes = [];
  global.document = document;
  global.window = {
    innerWidth: width,
    matchMedia: (query) => ({ matches: mediaMatches(query, width) })
  };
  global.matchMedia = global.window.matchMedia;
  global.location = { hash: "#/" };
  global.history = { replaceState: (state, title, url) => { global.location.hash = String(url); } };
  global.navigator = { clipboard: { writeText: (text) => { writes.push(text); return Promise.resolve(); } } };
  global.localStorage = {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key)
  };
  return { document, writes, storage };
}

function mediaMatches(query, width) {
  const max = query.match(/max-width:\s*(\d+)px/);
  const min = query.match(/min-width:\s*(\d+)px/);
  return (!max || width <= Number(max[1])) && (!min || width >= Number(min[1]));
}

const VALID_WALLET = DONATION_XMR;

async function bindViewEvents() {
  return (await import(`../src/views/events.js?interaction=${Date.now()}-${Math.random()}`)).bindViewEvents;
}

test.describe("settings and setup interactions", { concurrency: false }, () => {
  test("wallet threshold settings validate input and show save results", async () => {
    const { document } = installDom();
    const policy = payoutPolicyFromConfig({
      payout_policy: {
        minimumThreshold: 0.003,
        defaultThreshold: 0.3,
        denomination: 0.0001,
        feeFormula: { maxFee: 0.0004, zeroFeeThreshold: 4 }
      }
    });
    const input = el("input", { id: "payout-input" });
    input.value = "0.001";
    const button = el("button", { id: "payout-submit" });
    const fee = el("p", { id: "payout-fee" });
    const status = el("p", { id: "payout-status" });
    const form = el("form", { id: "payout-form", "data-wallet-address": "wallet1", "data-payout-policy": JSON.stringify(policy) }, [input, button, fee, status]);
    document.body.append(form);

    const originalUpdate = api.updateThreshold;
    const originalClear = api.clearUserSettings;
    const calls = [];
    api.updateThreshold = async (address, threshold) => {
      calls.push({ address, threshold });
      return { msg: "Saved threshold." };
    };
    api.clearUserSettings = () => {};
    try {
      bindSettingsForms();
      assert.equal(button.disabled, true);
      assert.match(status.textContent, /at least 0\.003 XMR/);

      input.value = "0.05";
      await input.dispatchEvent(new TestEvent("input"));
      assert.equal(button.disabled, false);
      assert.match(fee.textContent, /\+0\.0004/);

      await form.dispatchEvent(new TestEvent("submit"));
      assert.deepEqual(calls, [{ address: "wallet1", threshold: 0.05 }]);
      assert.equal(status.textContent, "Saved threshold.");
      assert.equal(hasClasses(status, ["settings-status", "green"]), true);
    } finally {
      api.updateThreshold = originalUpdate;
      api.clearUserSettings = originalClear;
    }
  });

  test("wallet settings forms show API errors without misleading success state", async () => {
    const { document } = installDom();
    const policy = payoutPolicyFromConfig({
      payout_policy: {
        minimumThreshold: 0.003,
        defaultThreshold: 0.3,
        denomination: 0.0001,
        feeFormula: { maxFee: 0.0004, zeroFeeThreshold: 4 }
      }
    });
    const input = el("input", { id: "payout-input" });
    input.value = "0.05";
    const thresholdForm = el("form", { id: "payout-form", "data-wallet-address": "wallet1", "data-payout-policy": JSON.stringify(policy) }, [
      input,
      el("button", { id: "payout-submit" }),
      el("p", { id: "payout-fee" }),
      el("p", { id: "payout-status" })
    ]);
    const toggle = el("button", { id: "email-toggle", "data-email-action": "toggle", "data-email-enabled": "1", "aria-pressed": "false" });
    toggle.textContent = "Email alerts: Disabled";
    const emailForm = el("form", { id: "email-form", "data-wallet-address": "wallet1" }, [toggle, el("p", { id: "email-status" })]);
    document.body.append(thresholdForm, emailForm);

    const originalUpdate = api.updateThreshold;
    const originalSubscribe = api.subscribeEmail;
    api.updateThreshold = async () => { throw new Error("Threshold failed."); };
    api.subscribeEmail = async () => { throw new Error("Email failed."); };
    try {
      bindSettingsForms();
      await thresholdForm.dispatchEvent(new TestEvent("submit"));
      assert.equal(document.getElementById("payout-status").textContent, "Threshold failed.");
      assert.equal(hasClasses(document.getElementById("payout-status"), ["settings-status", "red"]), true);

      await emailForm.dispatchEvent(new TestEvent("submit", { submitter: toggle }));
      assert.equal(document.getElementById("email-status").textContent, "Email failed.");
      assert.equal(hasClasses(document.getElementById("email-status"), ["settings-status", "red"]), true);
      assert.equal(toggle.textContent, "Email alerts: Disabled");
      assert.equal(toggle.getAttribute("aria-pressed"), "false");
    } finally {
      api.updateThreshold = originalUpdate;
      api.subscribeEmail = originalSubscribe;
    }
  });

  test("email alert form updates toggle text, pressed state, and status", async () => {
    const { document } = installDom();
    const toggle = el("button", { id: "email-toggle", "data-email-action": "toggle", "data-email-enabled": "1", "aria-pressed": "false" });
    toggle.textContent = "Email alerts: Disabled";
    const status = el("p", { id: "email-status" });
    const form = el("form", { id: "email-form", "data-wallet-address": "wallet1" }, [toggle, status]);
    document.body.append(form);

    const originalSubscribe = api.subscribeEmail;
    const originalClear = api.clearUserSettings;
    api.subscribeEmail = async () => ({ msg: "Email preferences updated." });
    api.clearUserSettings = () => {};
    try {
      bindSettingsForms();
      await form.dispatchEvent(new TestEvent("submit", { submitter: toggle }));

      assert.equal(status.textContent, "Email preferences updated.");
      assert.equal(toggle.textContent, "Email alerts: Enabled");
      assert.equal(toggle.dataset.emailEnabled, "0");
      assert.equal(toggle.getAttribute("aria-pressed"), "true");
    } finally {
      api.subscribeEmail = originalSubscribe;
      api.clearUserSettings = originalClear;
    }
  });

  test("setup profile buttons update visible command controls, copy text, and route", async () => {
    const { document, writes } = installDom();
    const setupControls = el("section", { class: "setup-controls" });
    const os = el("input", { id: "setup-os" });
    os.value = "linux";
    const profile = el("input", { id: "setup-profile" });
    profile.value = "xmrig";
    const wallet = el("input", { id: "setup-wallet" });
    wallet.value = "YOUR_XMR_ADDRESS";
    const gpuWrap = el("label", { class: "setup-gpu-field hidden" }, [el("select", { id: "setup-gpu" })]);
    gpuWrap.children[0].value = "amd";
    const algoWrap = el("label", { class: "setup-algo-field hidden" }, [el("select", { id: "setup-algo" })]);
    algoWrap.children[0].value = "rx/0";
    const rate = el("input", { id: "setup-hashrate-input" });
    rate.value = "4";
    const unit = el("select", { id: "setup-hashrate-unit" });
    unit.value = "kh";
    const tabs = el("div", { id: "setup-tabs-top" }, [el("button", { "data-setup-input": "setup-profile", "data-setup-value": "srb-gpu" })]);
    const note = el("p", { id: "setup-notes" });
    setupControls.append(os, profile, wallet, gpuWrap, algoWrap, rate, unit, tabs, note);
    document.body.append(setupControls);
    for (const [id, wrapId] of [["setup-download"], ["setup-run-tls", "setup-run-tls-wrap"], ["setup-run-plain", "setup-run-plain-wrap"], ["setup-run-tor", "setup-run-tor-wrap"], ["setup-run-local", "setup-run-local-wrap"]]) {
      document.body.append(
        el("section", { id: wrapId || `${id}-wrap` }, [
          el("h2", { id: `${id}-tt` }),
          el("p", { id: `${id}-note` }),
          el("button", { "data-copy-target": `#${id}` }),
          el("pre", { id })
        ])
      );
    }

    state.r = { n: "setup", q: {} };
    state.s = setupConfiguredPorts({
      configured: [{ port: 10008, tlsPort: 20008, targetHashrate: 4000, difficulty: 80000, description: "Desktop CPU" }]
    });

    bindSetupEvents();
    const click = new TestEvent("click");
    click.target = tabs.children[0];
    await setupControls.dispatchEvent(click);

    assert.equal(profile.value, "srb-gpu");
    assert.equal(gpuWrap.classList.contains("hidden"), false);
    assert.equal(algoWrap.classList.contains("hidden"), false);
    assert.match(document.getElementById("setup-run-plain").textContent, /SRBMiner-MULTI|SRBMiner/i);
    assert.match(location.hash, /#\/setup\?/);
    assert.match(location.hash, /profile=srb-gpu/);

    (await bindViewEvents())();
    await document.querySelector('[data-copy-target="#setup-run-plain"]').dispatchEvent(new TestEvent("click"));
    assert.equal(writes.length, 1);
    assert.match(writes[0], /SRBMiner-MULTI|SRBMiner/i);
  });
});
