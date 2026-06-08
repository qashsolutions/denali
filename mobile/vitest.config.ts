import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Vitest — node environment, no jsdom (matches the web's testing convention
 * per docs/reference/testing.md). React Native component tests will be added
 * by surface builders as needed; Pass 1 ships the runner only.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // expo-crypto's entry transitively imports react-native, which Vite's
      // Node SSR transform can't parse (Flow + JSX). Alias to a Node-CSPRNG
      // stub for tests; production keeps the real module.
      "expo-crypto": path.resolve(__dirname, "test/stubs/expo-crypto.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    globals: false,
  },
});
