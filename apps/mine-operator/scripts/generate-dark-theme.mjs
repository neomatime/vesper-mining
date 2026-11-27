/**
 * Regenerates packages/core/src/styles/dark.generated.css from globals.css and theme.css (the colour rules are mapped by dark-theme.mjs).
 * Run it after changing colours in those two files; never edit the generated file by hand.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { generateDarkTheme } from "./dark-theme.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "packages", "core", "src", "styles");
const read = (name) => readFileSync(join(root, name), "utf8").replace(/\r\n/g, "\n");
const output = generateDarkTheme([read("globals.css"), read("theme.css")]);
writeFileSync(join(root, "dark.generated.css"), output);
console.log(`dark.generated.css written (${output.split("\n").length} lines)`);
