import { test, expect } from "@playwright/test";
import { expectHashParams, expectHashPath, expectUsablePage, mockApi, openApp, VALID_WALLET } from "./fixtures.mjs";

test("table sorting, paging, and graph controls produce visible effects", async ({ page }) => {
  const api = await mockApi(page);

  await openApp(page, "#/coins?issues=1");
  await page.getByRole("link", { name: "Coin", exact: true }).click();
  await expectHashPath(page, "#/coins");
  await expectHashParams(page, { issues: "1", sort: "name", dir: "asc" });
  await expect(page.getByRole("link", { name: /Coin ↑/ })).toBeVisible();
  await page.getByRole("link", { name: /^Hash scalar/ }).click();
  await expectHashParams(page, { sort: "profit", dir: "desc" });

  await openApp(page, "#/blocks/XMR");
  await page.locator("#bps").selectOption("50");
  await expectHashPath(page, "#/blocks/XMR");
  await expectHashParams(page, { limit: "50" });
  await page.locator("#blocks-coin-filter").selectOption("RTM");
  await expectHashPath(page, "#/blocks/RTM");

  await openApp(page, "#/payments");
  await page.locator("#pps").selectOption("50");
  await expectHashPath(page, "#/payments");
  await expectHashParams(page, { limit: "50" });

  await openApp(page, "#/");
  await page.getByRole("link", { name: "12h" }).click();
  await expectHashParams(page, { window: "12h" });
  await page.getByRole("link", { name: "Raw" }).click();
  await expectHashParams(page, { mode: "raw" });
  const chart = page.getByRole("img", { name: "Pool-wide hashrate chart" });
  await expect(chart).toBeVisible();
  await chart.hover();
  await expect(page.locator(".chart-readout").first()).not.toHaveText("Point: move over graph");

  await openApp(page, "#/setup?os=linux&profile=xmrig-mo");
  await page.locator('[data-setup-value="srb-gpu"]').click();
  await expect(page.locator("#setup-run-plain")).toContainText(/SRBMiner/i);

  await openApp(page, "#/calc?rate=2&unit=kh");
  await page.locator("#ch").fill("4");
  await expectHashPath(page, "#/calc");
  await expectHashParams(page, { rate: "4", unit: "kh" });
  await expect(page.locator(".xmr-output").first()).not.toHaveText("0 XMR");

  await openApp(page, `#/wallet/${VALID_WALLET}?view=list`);
  await page.getByLabel("Workers").getByRole("link", { name: "XMR", exact: true }).click();
  await expectHashParams(page, { sort: "xmr" });
  await expectUsablePage(page);
  api.assertNoConsoleErrors();
});

test("wallet settings and copy buttons report visible results", async ({ page, context }) => {
  const api = await mockApi(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  await openApp(page, "#/help");
  await page.getByText("Help the pool").click();
  await page.getByRole("button", { name: "Copy" }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("89Txfr");

  await openApp(page, `#/wallet/${VALID_WALLET}/payout`);
  await page.locator("#payout-input").fill("0.05");
  await expect(page.locator("#payout-submit")).toBeEnabled();
  await page.locator("#payout-form").evaluate((form) => form.requestSubmit());
  await expect(page.locator("#payout-status")).toHaveText("Saved.");

  await openApp(page, `#/wallet/${VALID_WALLET}/alerts`);
  await page.locator("#email-toggle").click();
  await expect(page.locator("#email-status")).toHaveText("Saved.");
  await expect(page.locator("#email-toggle")).toHaveAttribute("aria-pressed", "true");
  api.assertNoConsoleErrors();
});
