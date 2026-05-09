import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

// §12-4 Playwright config. Phase 3 smoke + Phase 5 main flows live in
// tests/e2e/, sharing the MockWSServer fixture. Phase 9 long-session and edge
// specs run with the same config but extend their own timeouts inline.
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  retries: isCI ? 2 : 1,
  workers: isCI ? 2 : 1,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  webServer: {
    // Use the production build for stability — dev mode + StrictMode double-
    // mount + HMR caused locator detachment in CI. The `e2e` script chains
    // `pnpm build` before invoking playwright so dist/ is always fresh.
    command: "pnpm preview --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: !isCI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
