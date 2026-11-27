/**
 * The phone's outbox: reports and pre-start checks recorded while offline. They stay on this device (localStorage), marked
 * Pending Synchronisation, and are not received centrally until they are sent. Sending happens when the person is back online
 * (see components/use-outbox-sync.ts), or when they press Send now; each item is sent as the person who recorded it.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type OutboxKind = "report" | "prestart";

export type OutboxItem = {
  id: string;
  kind: OutboxKind;
  /** What the person sees in the list, for example the report title or "Pre-start check, EX-204". */
  title: string;
  path: string;
  body: Record<string, unknown>;
  /** Who recorded it: only sent while that person is signed in. */
  by: string;
  savedAt: string;
  lastError: string | null;
};

type OutboxStore = {
  items: OutboxItem[];
  add: (item: Omit<OutboxItem, "id" | "savedAt" | "lastError">) => OutboxItem;
  remove: (id: string) => void;
  failed: (id: string, message: string) => void;
};

export const useOutbox = create<OutboxStore>()(
  persist(
    (set) => ({
      items: [],
      add: (item) => {
        const entry: OutboxItem = { ...item, id: `out-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, savedAt: new Date().toISOString(), lastError: null };
        set((current) => ({ items: [...current.items, entry] }));
        return entry;
      },
      remove: (id) => set((current) => ({ items: current.items.filter((item) => item.id !== id) })),
      failed: (id, message) => set((current) => ({ items: current.items.map((item) => (item.id === id ? { ...item, lastError: message } : item)) })),
    }),
    { name: "vesper-outbox-v1", storage: createJSONStorage(() => localStorage) },
  ),
);
