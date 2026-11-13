import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { generateDarkTheme } from "./dark-theme.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "app");
const read = (name) => readFileSync(join(root, name), "utf8").replace(/\r\n/g, "\n");
const output = generateDarkTheme([read("globals.css"), read("theme.css")]);
writeFileSync(join(root, "dark.generated.css"), output);
console.log(`dark.generated.css written (${output.split("\n").length} lines)`);
