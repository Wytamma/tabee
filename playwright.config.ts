import { defineConfig, devices } from "@playwright/test";

/**
 * Two static apps on two different loopback origins. Different hostnames and
 * ports, so every transfer in these tests is genuinely cross-origin.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: [
    {
      command: "npm run dev -w @tabee/example-newick-sender",
      url: "http://127.0.0.1:5181/",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: "npm run dev -w @tabee/example-tree-viewer",
      url: "http://localhost:5182/",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: "npm run dev -w @tabee/example-isolated-sender",
      url: "http://127.0.0.1:5183/",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
