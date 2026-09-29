import { defineConfig } from "vitest/config";


/**
 * Deterministic backend unit tests.
 *
 * Only test/unit is included. Agent evaluation and
 * infrastructure/integration suites are intentionally
 * kept out of this configuration.
 */
export default defineConfig({
  test: {
    environment: "node",

    include: [
      "test/unit/**/*.test.ts"
    ],

    restoreMocks: true,
    unstubEnvs: true,

    coverage: {
      provider: "v8",

      include: [
        "src/**/*.ts"
      ],

      exclude: [
        "src/server.ts",
        "src/tests/**"
      ],

      reporter: [
        "text",
        "json-summary",
        "html"
      ]
    }
  }
});
