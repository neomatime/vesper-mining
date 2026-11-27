/**
 * Install as an app, from a button inside VESPER.
 *
 * Browsers that can install web apps (Chrome, Edge and Android browsers) announce it with a `beforeinstallprompt` event, once per
 * page load and usually before any component has mounted. This module listens from the moment it is imported, keeps the event, and
 * lets a button use it later. The event is the browser's own consent step: calling prompt() shows the browser's install dialog.
 * Safari and Firefox never send the event, so there the button simply does not appear.
 *
 * The page must also have a web app manifest (app/manifest.ts); without one the browser sends no event.
 */

/** The browser's install event. It is not in TypeScript's built-in types. */
export type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallState = { available: boolean; installed: boolean };

let deferred: InstallEvent | null = null;
let installed = false;
let snapshot: InstallState = { available: false, installed: false };
const listeners = new Set<() => void>();

function publish() {
  snapshot = { available: deferred !== null && !installed, installed };
  listeners.forEach((listener) => listener());
}

/** True when VESPER is already running as an installed app (its own window), so there is nothing to install. */
export function isRunningInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return Boolean(standalone || iosStandalone);
}

if (typeof window !== "undefined") {
  installed = isRunningInstalled();
  snapshot = { available: false, installed };
  window.addEventListener("beforeinstallprompt", (event) => {
    // Hold the event instead of letting the browser show its own small banner; the button decides when to ask.
    event.preventDefault();
    deferred = event as InstallEvent;
    publish();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    publish();
  });
}

export function subscribeInstall(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const installSnapshot = () => snapshot;
export const installServerSnapshot: InstallState = { available: false, installed: false };

/**
 * Shows the browser's install dialog. Resolves with what the person chose, or null when there was nothing to show. The event can
 * only be used once, so it is dropped afterwards: a dismissed prompt returns only when the browser decides to send it again.
 */
export async function promptInstall(): Promise<"accepted" | "dismissed" | null> {
  const event = deferred;
  if (!event) return null;
  deferred = null;
  publish();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome;
}
