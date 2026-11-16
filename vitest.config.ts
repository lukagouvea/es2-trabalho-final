import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: [
      "tests/e2e/**",
      ...(process.env.CAMPUS_INTEGRATION ? [] : ["tests/integration/**"]),
    ],
    testTimeout: 30000,
  },
});
