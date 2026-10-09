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
  await page.locator("#blocks-coin-filter").selectOption("XTM-C");
  await expectHashPath(page, "#/blocks/XTM-C");

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
  await expect(page.locator("#setup-gpu")).toHaveValue("intel");
  await expect(page.locator("#setup-miner")).toHaveValue("mom");
  await expect(page.locator("#setup-run-plain")).toContainText(/^MOM_GPU_BACKEND=intel \.\/mom mine /);
  await expect(page.locator("#setup-run-plain")).toContainText(/ --job\.algo autolykos2 --bench_algo_params 0$/);

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

test("GPU multi miner choices update commands and survive route reloads", async ({ page }) => {
  const api = await mockApi(page);
  for (const os of ["linux", "windows"]) {
    await openApp(page, `#/setup?os=${os}&profile=multi-miner&gpu=intel`);
    const miner = page.locator("#setup-miner");
    const command = page.locator("#setup-run-plain");
    await expect(miner).toBeVisible();
    await expect(miner).toHaveValue("multi-miner");
    await expect(page.locator("#setup-algo")).toBeHidden();
    await expect(page.locator('#setup-gpu option[value="intel"]')).toHaveText("Intel");
    await expect(page.locator("#setup-gpu option")).toHaveText(["Intel", "NVIDIA", "AMD"]);
    await expect(page.locator('#setup-gpu option[value="intel_igpu"]')).toHaveCount(0);
    for (const gpu of ["intel", "nvidia", "amd"]) {
      await page.locator("#setup-gpu").selectOption(gpu);
      await expect(miner).toHaveValue("multi-miner");
      await expect(miner.locator("option")).toHaveText(["MoM", "Multi-Miner"]);
      await page.locator("#setup-hashrate-input").fill("7");
      await miner.selectOption("mom");
      await expectHashParams(page, { os, profile: "multi-miner", gpu, miner: "mom", rate: "7" });
      await expect.poll(() => page.evaluate(() => new URLSearchParams(location.hash.split("?")[1]).has("algo"))).toBe(false);
      await expect(command).toContainText(new RegExp(`MOM_GPU_BACKEND[^\\n]*${gpu}`));
      await expect(command).not.toContainText(/--job\.algo|--bench_algo_params 0/);
      await page.reload();
      await expect(miner).toHaveValue("mom");
      await expect(page.locator("#setup-hashrate-input")).toHaveValue("7");
      await expect(command).toContainText(new RegExp(`MOM_GPU_BACKEND[^\\n]*${gpu}`));
      await miner.selectOption("multi-miner");
      await expectHashParams(page, { miner: "multi-miner" });
      await expect(command).not.toContainText("MOM_GPU_BACKEND");
      await expect(page.locator("#setup-hashrate-input")).toHaveValue("7");
      await page.reload();
      await expect(miner).toHaveValue("multi-miner");
    }
    await openApp(page, `#/setup?os=${os}&profile=multi-miner&gpu=invalid&miner=mom`);
    await expect(page.locator("#setup-gpu")).toHaveValue("gpu");
    await expect(command).not.toContainText("MOM_GPU_BACKEND");
    await page.locator("#setup-gpu").selectOption("intel");
    await miner.selectOption("mom");
    await page.locator(`[data-setup-input="setup-os"][data-setup-value="${os === "linux" ? "windows" : "linux"}"]`).click();
    await expect(miner).toHaveValue("multi-miner");
    await page.locator('[data-setup-value="srb-gpu"]').click();
    await expect(miner).toHaveValue("mom");
    await expect(page.locator("#setup-algo")).toBeVisible();
    await expect(page.locator('#setup-algo option[value="pearlhash"]')).toHaveText("pearlhash");
    await expect(command).toContainText("--job.algo autolykos2");
    await expectUsablePage(page);
  }
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
