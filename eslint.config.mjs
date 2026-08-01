import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // eslint-config-next hardcodes `settings.react.version: "detect"`, which makes
    // eslint-plugin-react call the `context.getFilename()` API that ESLint 10 removed,
    // crashing the whole run. Pinning the React version explicitly skips that detection
    // path entirely. No rules are disabled, and eslint-plugin-react documents setting
    // this explicitly as the preferred option anyway (detection is slower).
    // Revert to "detect" once eslint-plugin-react ships ESLint 10 support.
    // Keep in sync with the `react` version in package.json.
    settings: { react: { version: "19.2" } },
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
