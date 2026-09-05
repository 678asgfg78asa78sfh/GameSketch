import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./web/e2e",
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:4339",
    channel: process.env.GS_BROWSER_CHANNEL || undefined,
    locale: "de-DE",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node tools/test-server.js",
    url: "http://127.0.0.1:4339/api/health",
    reuseExistingServer: false,
  },
});
