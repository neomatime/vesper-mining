/**
 * Lint rules for the shared foundation: the same Next.js and TypeScript presets as the apps.
 */
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  { settings: { next: { rootDir: "../../apps/mine-operator" } } },
  globalIgnores(["coverage/**"]),
]);
