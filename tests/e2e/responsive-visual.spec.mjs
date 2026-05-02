import { test, expect } from "@playwright/test";
import { expectHeaderActionsRightAligned, expectNoHorizontalOverflow, expectScreenshotHasContent, mockApi, openApp } from "./fixtures.mjs";

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
