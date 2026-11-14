/**
 * Browser test configuration: two projects (desktop Chrome and a Pixel 7 phone), run one at a time against a production
 * build served on 127.0.0.1:3000. Build first (next build); scripts/run-e2e.mjs starts the server and runs the tests.
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "node node_modules/next/dist/bin/next start",
    url: "http://127.0.0.1:3000/demo",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
