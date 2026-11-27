"use client";

/**
 * React hook over lib/install-prompt.ts: whether VESPER can be installed from this browser right now, and a function to start it.
 */
import { useSyncExternalStore } from "react";
import { installServerSnapshot, installSnapshot, promptInstall, subscribeInstall } from "../lib/install-prompt";

export function useInstallApp() {
  const state = useSyncExternalStore(subscribeInstall, installSnapshot, () => installServerSnapshot);
  return { canInstall: state.available, install: promptInstall };
}
