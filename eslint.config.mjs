import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Lets `const { secret: _secret, ...rest } = obj` (destructure a
      // field out in order to omit it from `rest`) pass without requiring
      // the discarded binding to be "used" — the standard option for this
      // exact pattern, which this codebase relies on to strip fields
      // (e.g. passwordHash) before objects cross the Server -> Client
      // Component boundary.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { ignoreRestSiblings: true },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
