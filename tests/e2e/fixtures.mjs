import { expect } from "@playwright/test";

export const VALID_WALLET = "4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const now = Math.floor(Date.now() / 1000);

export function chartRows(count = 18, base = 100_000) {
  return Array.from({ length: count }, (_, index) => ({
    tme: now - (count - index) * 120,
    hsh: base + index * 1000,
    hsh2: base * 1.1 + index * 1200
  }));
}

export const fixtures = {
  config: {
    payout_policy: {
      minimumThreshold: 0.003,
      defaultThreshold: 0.3,
      denomination: 0.0001,
      feeFormula: { maxFee: 0.0004, zeroFeeThreshold: 4 }
    }
  },
  poolPorts: {
    configured: [
      { port: 10002, tlsPort: 20002, difficulty: 20_000, targetHashrate: 700, description: "Small CPU" },
      { port: 10008, tlsPort: 20008, difficulty: 80_000, targetHashrate: 2500, description: "Desktop CPU" },
      { port: 10016, tlsPort: 20016, difficulty: 160_000, targetHashrate: 5000, description: "Fast CPU" },
      { port: 18192, tlsPort: 28192, difficulty: 81_920_000, targetHashrate: 1_000_000, description: "Proxy/farm" }
    ]
  },
  poolStats: {
    miners: 4664,
    hashRate: 221_000_000,
    totalPayments: 95402,
    totalBlocksFound: 42,
    pplnsWindowTime: 14904,
    currentEfforts: { 18081: 54_120_000_000, 9998: 160_000 },
    minBlockRewards: { 18081: 600_000_000_000, 9998: 200_000_000 },
    price: { usd: 400, eur: 350 },
    coins: {
      18081: { port: 18081, symbol: "XMR", displayName: "XMR", algo: "rx/0", profit: 1, pplnsShare: 0.7, active: true, exchangeConfigured: true, hashrate: 200_000_000, miners: 4000, blockTime: 120, atomicUnits: 1_000_000_000_000 },
      9998: { port: 9998, symbol: "RTM", displayName: "Raptoreum", algo: "ghostrider", profit: 0.5, pplnsShare: 0.3, active: false, exchangeConfigured: false, disabledReason: "no exchange", hashrate: 21_000_000, miners: 664, blockTime: 60, atomicUnits: 100_000_000, altBlocksFound: 7 }
    }
  },
  networkStats: {
    18081: { difficulty: 300_000_000_000, time: 120, height: 3_000_000 },
    9998: { difficulty: 100_000, time: 60, height: 900_000 }
  },
  motd: { subject: "Pool notice", body: "Exchange migration is stable.", created: "1777734000" },
  uptime: { data: [{ name: "Backend: API server", statusClass: "success" }, { name: "Backend: Node XMR", statusClass: "success" }] },
  payments: Array.from({ length: 15 }, (_, index) => ({ ts: now - index * 600, payees: 2 + index, value: 100_000_000_000 + index, fee: 1_000_000_000, hash: `txhash${index}` })),
  blocks: Array.from({ length: 15 }, (_, index) => ({ ts: now - index * 900, shares: index % 2 ? 150 : 50, diff: 100, value: 600_000_000_000, height: 2_999_990 - index, hash: `blockhash${index}`, unlocked: index % 3 === 0 })),
  altBlocks: Array.from({ length: 15 }, (_, index) => ({ ts: now - index * 700, shares: index % 2 ? 160 : 60, diff: 100, value: 200_000_000, pay_value: 300_000_000_000, height: 899_990 - index, hash: `altblockhash${index}` })),
  walletStats: { hash: 90_000, hash2: 120_000, amtDue: 450_000_000_000, amtPaid: 900_000_000_000, lastHash: now - 60, totalHash: 123456789, validShares: 42, invalidShares: 1 },
  walletWorkers: {
    alpha: { hash: 80_000, hash2: 100_000, lastHash: now - 60, totalHash: 1000, validShares: 20, invalidShares: 0 },
    beta: { hash: 0, hash2: 0, lastHash: now - 900, totalHash: 200, validShares: 4, invalidShares: 2 }
  },
  workerCharts: {
    alpha: chartRows(8, 80_000),
    beta: chartRows(8, 20_000)
  },
  walletPayments: Array.from({ length: 15 }, (_, index) => ({ ts: now - index * 500, value: 10_000_000_000, fee: 1_000_000_000, hash: `walletpay${index}` })),
  walletBlocks: Array.from({ length: 15 }, (_, index) => ({ ts: now - index * 500, amount: 3_000_000_000, hash: `walletblock${index}`, height: 2_999_900 - index })),
  userSettings: { payout_threshold: 300_000_000_000, email: "miner@example.com", email_enabled: false }
};

export async function mockApi(page, overrides = {}) {
  const data = { ...fixtures, ...overrides };
  const calls = new Map();
  const seenConsole = [];
  page.on("console", (message) => {
    if (message.type() === "error") seenConsole.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => seenConsole.push(`pageerror: ${error.message}`));

  await page.route("https://stats.uptimerobot.com/**", (route) => json(route, data.uptime));
  await page.route("https://api.moneroocean.stream/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/+/, "");
    calls.set(path, (calls.get(path) || 0) + 1);
    if (route.request().method() === "POST") return json(route, { msg: "Saved." });
    if (path === "config") return json(route, data.config);
    if (path === "pool/ports") return json(route, data.poolPorts);
    if (path === "pool/stats") return json(route, { pool_statistics: data.poolStats });
    if (path === "network/stats") return json(route, data.networkStats);
    if (path === "pool/chart/hashrate") return json(route, data.poolChart || chartRows(24, 221_000_000));
    if (path === "pool/motd") return json(route, data.motd);
    if (path === "pool/payments") return json(route, data.payments);
    if (path === "pool/blocks") return json(route, data.blocks);
    if (path.startsWith("pool/coin_altblocks/")) return json(route, data.altBlocks);
    if (path.startsWith("miner/") && path.endsWith("/stats/allWorkers")) return json(route, data.walletWorkers);
    if (path.startsWith("miner/") && path.endsWith("/chart/hashrate/allWorkers")) return json(route, data.workerCharts);
    if (path.startsWith("miner/") && path.endsWith("/chart/hashrate")) return json(route, data.walletChart || chartRows(18, 100_000));
    if (path.startsWith("miner/") && path.endsWith("/payments")) return json(route, data.walletPayments);
    if (path.startsWith("miner/") && path.endsWith("/block_payments")) return json(route, data.walletBlocks);
    if (path.startsWith("miner/") && path.endsWith("/stats")) return json(route, data.walletStats);
    if (path.startsWith("user/")) return json(route, data.userSettings);
    return json(route, {});
  });
  return {
    calls,
    consoleMessages: seenConsole,
    assertNoConsoleErrors: () => expect(seenConsole, seenConsole.join("\n")).toEqual([])
  };
}

export async function openApp(page, route = "#/") {
  await page.goto(`/${route}`);
  await expect(page.locator("#view")).not.toHaveAttribute("aria-busy", "true");
  await expect(page.locator(".skeleton")).toHaveCount(0, { timeout: 5000 });
}

export async function expectHashParams(page, params) {
  await expect.poll(() => page.evaluate(() => {
    const query = location.hash.split("?")[1] || "";
    return Object.fromEntries(new URLSearchParams(query));
  })).toMatchObject(params);
}

export async function expectHashParamKeys(page, keys) {
  await expect.poll(() => page.evaluate(() => {
    const query = location.hash.split("?")[1] || "";
    const params = new URLSearchParams(query);
    return [...params.keys()];
  })).toEqual(expect.arrayContaining(keys));
}

export async function expectHashPath(page, path) {
  await expect.poll(() => page.evaluate(() => location.hash.split("?")[0])).toBe(path);
}

export async function expectUsablePage(page) {
  await expect(page.locator("#view")).toBeVisible();
  await expect(page.locator("#view")).not.toContainText(/undefined|NaN/);
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
}

export async function waitForStableMicrotasks(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

export async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

export async function expectHeaderActionsRightAligned(page) {
  const gap = await page.locator(".top-actions").evaluate((node) => Math.round(innerWidth - node.getBoundingClientRect().right));
  expect(gap).toBeLessThanOrEqual(24);
}

export async function expectScreenshotHasContent(page) {
  const png = await page.screenshot();
  expect(png.byteLength).toBeGreaterThan(10_000);
}

export async function assertInternalLinksNavigate(page) {
  const hrefs = await page.locator('a[href^="#/"]').evaluateAll((links) => [...new Set(links.map((link) => link.getAttribute("href")).filter(Boolean))]);
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs.slice(0, 12)) {
    await page.evaluate((hash) => { location.hash = hash; }, href);
    await expect(page.locator("#view")).not.toHaveAttribute("aria-busy", "true");
    await expect(page.locator("#view")).not.toContainText(/Data unavailable|Invalid wallet address|undefined|NaN/);
  }
}

async function json(route, body) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body)
  });
}
