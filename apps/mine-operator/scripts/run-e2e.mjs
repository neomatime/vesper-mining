import { spawn } from "node:child_process";
import path from "node:path";

const appRoot = path.resolve(import.meta.dirname, "..");
const nextCli = path.join(appRoot, "node_modules", "next", "dist", "bin", "next");
const playwrightCli = path.join(appRoot, "node_modules", "@playwright", "test", "cli.js");
const demoUrl = "http://127.0.0.1:3000/demo";

function runNode(script, args = []) {
  return spawn(process.execPath, [script, ...args], {
    cwd: appRoot,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
}

async function waitForServer(server, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`VESPER preview exited before E2E startup (code ${server.exitCode}).`);
    }
    try {
      const response = await fetch(demoUrl);
      if (response.ok) return;
    } catch {
      // The preview is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`VESPER preview did not become ready at ${demoUrl}.`);
}

async function stopServer(server) {
  if (server.exitCode !== null) return;
  server.kill("SIGTERM");
  await Promise.race([
    waitForExit(server),
    new Promise((resolve) => setTimeout(resolve, 3_000)),
  ]);
  if (server.exitCode === null) server.kill("SIGKILL");
}

const server = runNode(nextCli, ["start", "--hostname", "127.0.0.1", "--port", "3000"]);

try {
  await waitForServer(server);
  const tests = runNode(playwrightCli, ["test"]);
  const result = await waitForExit(tests);
  process.exitCode = result.code ?? 1;
} finally {
  await stopServer(server);
}
