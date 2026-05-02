import { defineConfig, devices } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testsDir, "..");

export default defineConfig({
  testDir: resolve(testsDir, "e2e"),
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: "node tests/e2e/server.mjs",
    cwd: repoRoot,
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 10_000
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } }
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 5"], viewport: { width: 393, height: 851 } }
    }
  ]
});
