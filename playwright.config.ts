import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:5198",
    actionTimeout: 10000,
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: process.env.CAMPUS_CHROME || "/opt/google/chrome/chrome",
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "npm exec -- vite --host 127.0.0.1 --port 5198 --strictPort",
    env: {
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-public-key",
    },
    url: "http://127.0.0.1:5198",
    reuseExistingServer: false,
  },
  timeout: 60000,
});
