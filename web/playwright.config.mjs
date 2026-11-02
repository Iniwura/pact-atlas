import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export default defineConfig({
  testDir: path.resolve(projectRoot, "web/tests"),
  testMatch: "**/*.spec.mjs",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: true,
  retries: 1,
  reporter: [["list"], ["html", { outputFolder: path.resolve(projectRoot, "web/test-results/report"), open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: { command: "node web/server.mjs", cwd: projectRoot, url: "http://127.0.0.1:4173", reuseExistingServer: true, timeout: 10_000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
