import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // The kinetic grid is kept exactly as supplied: its animation loop schedules itself from inside
  // its own callback, which this rule reads as use-before-declare. Only that file is exempt.
  {
    files: ["components/ui/kinetic-grid.tsx"],
    rules: { "react-hooks/immutability": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // macOS writes AppleDouble side files on this drive; they are not source.
    "**/._*",
  ]),
]);

export default eslintConfig;
