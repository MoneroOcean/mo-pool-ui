import { test, expect } from "@playwright/test";
import { expectHeaderActionsRightAligned, expectNoHorizontalOverflow, expectScreenshotHasContent, mockApi, openApp, VALID_WALLET } from "./fixtures.mjs";

for (const width of [320, 375, 430, 768, 1280]) {
  test(`responsive layout has no overflow or broken controls at ${width}px`, async ({ page }) => {
    const api = await mockApi(page);
    await page.setViewportSize({ width, height: width < 600 ? 900 : 820 });
    await openApp(page, "#/");

    await expectNoHorizontalOverflow(page);
    await expectHeaderActionsRightAligned(page);
    await expect(page.locator(".top-actions button")).toHaveCount(2);
    await expect(page.locator(".pool-kpi-grid")).toBeVisible();
    await expect(page.locator(".pool-kpi-grid .explanation").first()).toBeAttached();
    await expectScreenshotHasContent(page);
    api.assertNoConsoleErrors();
  });
}

test("narrow screens default comments off but allow the help toggle", async ({ page }) => {
  const api = await mockApi(page);
  await page.setViewportSize({ width: 375, height: 900 });
  await openApp(page, "#/");

  await expect(page.locator("body")).toHaveClass(/comments-off/);
  await page.locator("#comments-toggle").click();
  await expect(page.locator("body")).not.toHaveClass(/comments-off/);
  await expect(page.locator(".pool-kpi-grid .explanation").first()).toBeVisible();
  api.assertNoConsoleErrors();
});

test("wallet five-column worker graph mode avoids horizontal overflow", async ({ page }) => {
  const api = await mockApi(page);
  for (const width of [393, 1280]) {
    await page.setViewportSize({ width, height: width < 600 ? 900 : 820 });
    await openApp(page, `#/wallet/${VALID_WALLET}/overview?view=5`);
    await expect(page.locator(".worker-graph-grid.w5")).toBeVisible();
    await expect(page.getByRole("link", { name: "5", exact: true })).toHaveAttribute("aria-current", "page");
    const chart = await page.locator(".worker-graph-grid.w5 .chart-svg").first().evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });
    expect(chart.height).toBeLessThanOrEqual(181);
    expect(chart.width).toBeGreaterThanOrEqual(chart.height * 2 - 1);
    await expectNoHorizontalOverflow(page);
  }
  await page.setViewportSize({ width: 1280, height: 820 });
  await openApp(page, `#/wallet/${VALID_WALLET}/overview?view=1`);
  const wideChart = await page.locator(".worker-graph-grid.w1 .chart-wrap").first().evaluate((node) => node.getBoundingClientRect().height);
  expect(wideChart).toBeGreaterThan(170);
  api.assertNoConsoleErrors();
});
