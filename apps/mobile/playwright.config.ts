/**
 * Browser test configuration for VESPER Mobile: a Pixel 7 phone, one test at a time, against a production build served on
 * 127.0.0.1:3001. Build first (next build); scripts/run-e2e.mjs starts the server and runs the tests.
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
    baseURL: "http://127.0.0.1:3001",
    trace: "on-first-retry",
  },
  projects: [{ name: "phone", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "node node_modules/next/dist/bin/next start --port 3001",
    url: "http://127.0.0.1:3001/sign-in",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
