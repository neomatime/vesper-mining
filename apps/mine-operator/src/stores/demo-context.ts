import { create } from "zustand";
import type { DemoContext } from "@vesper/api-contracts";
import { defaultContext } from "@/lib/demo-data";

type Connectivity = "online" | "offline";

type DemoContextStore = {
  context: DemoContext;
  connectivity: Connectivity;
  sidebarCollapsed: boolean;
  setContext: (update: Partial<DemoContext>) => void;
  setConnectivity: (value: Connectivity) => void;
  toggleSidebar: () => void;
  resetControls: () => void;
};

export const useDemoContext = create<DemoContextStore>((set) => ({
  context: defaultContext,
  connectivity: "online",
  sidebarCollapsed: false,
  setContext: (update) =>
    set((current) => ({ context: { ...current.context, ...update } })),
  setConnectivity: (connectivity) => set({ connectivity }),
  toggleSidebar: () =>
    set((current) => ({ sidebarCollapsed: !current.sidebarCollapsed })),
  resetControls: () =>
    set({ context: defaultContext, connectivity: "online", sidebarCollapsed: false }),
}));
