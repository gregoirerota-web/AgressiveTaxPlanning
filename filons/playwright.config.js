import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 45000,
  use: { baseURL: "http://127.0.0.1:4173", browserName: "chromium", headless: true },
  webServer: [
    { command: "node server/index.js", url: "http://127.0.0.1:3001/api/health", reuseExistingServer: !process.env.CI, timeout: 30000 },
    { command: "npm run dev -- --host 127.0.0.1 --port 4173", url: "http://127.0.0.1:4173", reuseExistingServer: !process.env.CI, timeout: 30000 }
  ],
  reporter: "list"
});
