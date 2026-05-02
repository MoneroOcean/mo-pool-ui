import { test, expect } from "@playwright/test";
import { assertInternalLinksNavigate, expectNoHorizontalOverflow, expectUsablePage, mockApi, openApp, VALID_WALLET } from "./fixtures.mjs";

test("built bundle loads only deployable assets without console errors", async ({ page }) => {
  const api = await mockApi(page);
  const failed = [];
  page.on("response", (response) => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
  });
  await openApp(page);

  const resources = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name));
  expect(resources.some((url) => /script\.js\?v=/.test(url))).toBe(true);
  expect(resources.some((url) => /style\.css\?v=/.test(url))).toBe(true);
  expect(resources.some((url) => /script\.js$/.test(url) || /style\.css$/.test(url))).toBe(false);
  expect(failed).toEqual([]);
  api.assertNoConsoleErrors();
});

test("main route matrix renders usable pages with valid internal links", async ({ page }) => {
  const api = await mockApi(page);
  for (const route of [
    "#/",
    "#/coins?issues=1",
    "#/blocks/XMR",
    "#/blocks/RTM",
    "#/blocks?coin=XMR",
    "#/blocks?coin=RTM",
    "#/payments",
    "#/calc?rate=2&unit=kh",
    "#/setup?profile=xmrig-mo",
    "#/help",
    `#/wallet/${VALID_WALLET}`,
    `#/wallet/${VALID_WALLET}/withdrawals`,
    `#/wallet/${VALID_WALLET}/rewards`,
    `#/wallet/${VALID_WALLET}/payout`,
    `#/wallet/${VALID_WALLET}/alerts`
  ]) {
    await openApp(page, route);
    await expectUsablePage(page);
    await expectNoHorizontalOverflow(page);
  }
  await assertInternalLinksNavigate(page);
  api.assertNoConsoleErrors();
});

test("malformed and empty API fixtures degrade without broken output", async ({ page }) => {
  const api = await mockApi(page, {
    poolStats: { coins: {}, miners: undefined, totalPayments: 0, totalBlocksFound: 0 },
    networkStats: {},
    payments: [],
    blocks: [],
    walletWorkers: {},
    workerCharts: {},
    walletChart: [],
    userSettings: {}
  });

  for (const route of ["#/coins", "#/blocks", "#/payments", `#/wallet/${VALID_WALLET}`]) {
    await openApp(page, route);
    await expectUsablePage(page);
    await expect(page.locator("#view")).not.toContainText(/undefined|NaN/);
  }
  api.assertNoConsoleErrors();
});
