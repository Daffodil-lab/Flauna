import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
    // Vitest handles unit + integration suites; Playwright owns tests/e2e/.
    include: ["tests/unit/**/*.{test,spec}.{ts,tsx}", "tests/integration/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["tests/e2e/**", "tests/fixtures/**", "node_modules"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
