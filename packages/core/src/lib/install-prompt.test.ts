/**
 * Unit tests (Vitest). The install button's logic: it holds the browser's install event, offers it once, and hides itself when
 * VESPER is installed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

/** A stand-in for the browser's event, with a prompt() and a user choice. */
function installEvent(outcome: "accepted" | "dismissed") {
  const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
  event.prompt = vi.fn(async () => {});
  event.userChoice = Promise.resolve({ outcome });
  return event;
}

/** The module keeps its state for the page's life, so each test loads a fresh copy. */
async function load() {
  vi.resetModules();
  return import("./install-prompt");
}

describe("install prompt", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
  });

  it("is not available until the browser says the app can be installed", async () => {
    const prompt = await load();
    expect(prompt.installSnapshot().available).toBe(false);
    expect(await prompt.promptInstall()).toBeNull();
  });

  it("holds the browser's event instead of letting it show its own banner, and tells listeners", async () => {
    const prompt = await load();
    const listener = vi.fn();
    prompt.subscribeInstall(listener);
    const event = installEvent("accepted");
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(prompt.installSnapshot().available).toBe(true);
    expect(listener).toHaveBeenCalled();
  });

  it("asks once, reports the choice, and is then unavailable until the browser sends the event again", async () => {
    const prompt = await load();
    const event = installEvent("dismissed");
    window.dispatchEvent(event);
    expect(await prompt.promptInstall()).toBe("dismissed");
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(prompt.installSnapshot().available).toBe(false);
    expect(await prompt.promptInstall()).toBeNull();
  });

  it("hides the button once the app is installed", async () => {
    const prompt = await load();
    window.dispatchEvent(installEvent("accepted"));
    window.dispatchEvent(new Event("appinstalled"));
    expect(prompt.installSnapshot()).toEqual({ available: false, installed: true });
  });

  it("offers nothing when VESPER is already running as an installed app", async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    const prompt = await load();
    window.dispatchEvent(installEvent("accepted"));
    expect(prompt.installSnapshot().available).toBe(false);
  });
});
