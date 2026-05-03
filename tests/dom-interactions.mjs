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
  Object.defineProperty(global, "navigator", {
    configurable: true,
    value: { clipboard: { writeText: (text) => { writes.push(text); return Promise.resolve(); } } }
  });
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

test.describe("DOM interactions and controls", { concurrency: false }, () => {
  test("calculator controls update visible results and URL as values change", async () => {
    const { document } = installDom();
    const input = el("input", { id: "ch" });
    input.value = "2";
    const unit = el("select", { id: "cu" });
    unit.value = "kh";
    const form = el("form", { id: "calc-form", "data-profit-per-hash": "0.00000008", "data-price": "400", "data-fiat-code": "USD" }, [input, unit]);
    const xmr = el("span", { class: "xmr-output", "data-period": "1" });
    const fiat = el("span", { class: "fiat-output", "data-period": "1" });
    document.body.append(form, xmr, fiat);

    (await bindViewEvents())();
    input.value = "4";
    input.dispatchEvent(new TestEvent("input"));

    assert.equal(xmr.textContent, formatXmr(0.00032, 8));
    assert.equal(fiat.textContent, formatFiat(0.128, "USD"));
    assert.equal(location.hash, "#/calc?rate=4&unit=kh");
  });

  test("theme and comments controls apply visible preference state across widths", () => {
    for (const width of [360, 800]) {
      const { document } = installDom({ width });
      let preferences = { theme: "dark", explanations: width <= 620 ? "off" : "on" };
      applyPreferences(preferences);
      assert.equal(document.body.classList.contains("comments-off"), width <= 620);

      preferences.explanations = saveExplanations(toggleExplanations(preferences.explanations), { persist: false });
      applyPreferences(preferences);
      assert.equal(document.body.classList.contains("comments-off"), width > 620);

      preferences.theme = saveTheme(toggleTheme(preferences.theme), { persist: false });
      applyPreferences(preferences);
      assert.equal(document.body.classList.contains("theme-light"), true);
    }
  });

  test("wallet add and remove controls update routes and visible cards", async () => {
    const { document, storage } = installDom();
    storage.set("mo.consent.v1", JSON.stringify({ value: true, time: Date.now() }));
    const input = el("input", { id: "ai" });
    input.value = "not-a-wallet";
    const form = el("form", { id: "af" }, [input]);
    const list = el("div", { id: "wallet-list" });
    const graphControls = el("div", { class: "card" }, [el("div", { class: "graph-switches" })]);
    const walletCard = el("article", { id: `wallet-${VALID_WALLET}` }, [el("button", { "data-remove-wallet": VALID_WALLET })]);
    list.append(walletCard);
    document.body.append(form, list, graphControls);
    state.r = { n: "wallet", a: VALID_WALLET };

    (await bindViewEvents())();
    await form.dispatchEvent(new TestEvent("submit"));
    assert.equal(input.validationMessage, "Enter a complete XMR address");

    input.value = VALID_WALLET;
    await form.dispatchEvent(new TestEvent("submit"));
    assert.match(location.hash, /^#\/\?tracked=/);

    await walletCard.querySelector("[data-remove-wallet]").dispatchEvent(new TestEvent("click"));
    assert.equal(walletCard.parentElement, null);
    assert.match(list.innerHTML, /No wallets tracked yet/);
    assert.equal(graphControls.parentElement, null);
    assert.equal(location.hash, "#/");
  });

  test("copy and dismiss buttons produce visible side effects", async () => {
    const { document, writes, storage } = installDom();
    const code = el("pre", { id: "cmd" });
    code.textContent = "xmrig --config=config.json";
    const copy = el("button", { "data-copy-target": "#cmd" });
    const notice = el("section", { class: "motd-card" }, [el("button", { "data-dismiss-motd": "notice-v1" })]);
    document.body.append(code, copy, notice);

    (await bindViewEvents())();
    copy.click();
    notice.querySelector("[data-dismiss-motd]").click();

    assert.deepEqual(writes, ["xmrig --config=config.json"]);
    assert.equal(notice.parentElement, null);
    assert.equal(storage.get("mo.motd.dismissed.v1"), "notice-v1");
  });

  test("chart hover updates readout and cursor visibility", async () => {
    const { document } = installDom();
    state.p = 60;
    const readout = el("span", { class: "chart-readout" });
    readout.textContent = "Point: move over graph";
    const vertical = el("line", { class: "cursor-vertical" });
    const horizontal = el("line", { class: "cursor-horizontal" });
    const chart = el("svg", {
      class: "hashrate-chart",
      "data-chart-points": JSON.stringify([
        { x: 0, y: 100, t: 100, v: 10 },
        { x: 700, y: 40, t: 120, v: 20 }
      ])
    }, [vertical, horizontal]);
    chart.rect = { left: 0, width: 100, top: 0, height: 50 };
    document.body.append(el("div", { class: "card" }, [el("div", { class: "chart-wrap" }, [readout, chart])]));

    bindChartHover();
    await chart.dispatchEvent(new TestEvent("pointermove", { clientX: 100 }));

    assert.equal(chart.classList.contains("hcu"), true);
    assert.equal(vertical.getAttribute("x1"), "700");
    assert.equal(horizontal.getAttribute("y1"), "40");
    assert.match(readout.textContent, /20\.0 H\/s/);
    assert.match(readout.textContent, /PPLNS/);

    await chart.dispatchEvent(new TestEvent("pointerleave"));
    assert.equal(chart.classList.contains("hcu"), false);
    assert.equal(readout.textContent, "Point: move over graph");
  });

  test("paging controls change routes on select, change, and enter", async () => {
    const { document } = installDom();
    const paymentSize = el("select", { id: "pps" });
    paymentSize.value = "50";
    const paymentPage = el("input", { id: "ppi", max: "7" });
    paymentPage.value = "9";
    const blockCoin = el("select", { id: "blocks-coin-filter" });
    blockCoin.value = "XMR";
    const blockSize = el("select", { id: "bps" });
    blockSize.value = "100";
    const blockPage = el("input", { id: "bpi" });
    blockPage.value = "3";
    document.body.append(paymentSize, paymentPage, blockCoin, blockSize, blockPage);

    (await bindViewEvents())();
    paymentSize.dispatchEvent(new TestEvent("change"));
    assert.equal(location.hash, "#/payments?limit=50");

    paymentPage.dispatchEvent(new TestEvent("change"));
    assert.equal(location.hash, "#/payments?page=7&limit=50");

    blockCoin.dispatchEvent(new TestEvent("change"));
    assert.equal(location.hash, "#/blocks/XMR?limit=100");

    blockPage.dispatchEvent(new TestEvent("keydown", { key: "Enter" }));
    assert.equal(location.hash, "#/blocks/XMR?page=3&limit=100");
  });

  test("disabled pager arrows are inert links with disabled semantics", () => {
    const html = pagerNav("pages", "pi", 1, 1, false, (page, size) => `#/items?page=${page}&limit=${size}`, 15);
    assert.match(html, /aria-label="Previous page" aria-disabled=true>‹/);
    assert.match(html, /aria-label="Next page" aria-disabled=true>›/);
    assert.doesNotMatch(html, /aria-label="Previous page" href=/);
    assert.doesNotMatch(html, /aria-label="Next page" href=/);
  });

  test("local history button toggles visible state and wallet track button labels", async () => {
    const { document, storage } = installDom();
    storage.set("mo.consent.v1", JSON.stringify({ value: true, time: Date.now() }));
    const historyButton = el("button", { "data-local-history": "", "aria-pressed": "true" });
    const trackButton = el("button", { "data-wallet-submit": "" });
    const consentPanel = el("section", { class: "local-history-consent" });
    document.body.append(historyButton, trackButton, consentPanel);

    (await bindViewEvents())();
    assert.equal(historyButton.textContent, "Disable local wallet history");
    historyButton.click();

    assert.equal(historyButton.textContent, "Enable local wallet history");
    assert.equal(historyButton.getAttribute("aria-pressed"), "false");
    assert.equal(trackButton.textContent, "Temporary track wallet");
    assert.equal(consentPanel.parentElement, null);
  });
});
