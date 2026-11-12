import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { demoSend } from "@/lib/api";
import type { Account } from "@/lib/accounts";
import { useDemoContext } from "./demo-context";

type SessionStore = {
  account: Account | null;
  /** Checks the credentials against the organisation's people. Rejects with an ApiError when they are refused. */
  signIn: (email: string, password: string) => Promise<Account>;
  signOut: () => void;
};

/** Set when someone signs out on purpose, so the guard does not send them back to the page they left. */
export const exit = { explicit: false };

export const useSession = create<SessionStore>()(
  persist(
    (set) => ({
      account: null,
      signIn: async (email, password) => {
        const account = await demoSend<Account>("/session", "POST", { email, password });
        useDemoContext.getState().setContext({ persona: account.name, role: account.role });
        set({ account });
        return account;
      },
      signOut: () => {
        exit.explicit = true;
        set({ account: null });
      },
    }),
    {
      name: "vesper-session-v2",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ account: state.account }),
    },
  ),
);

/** The signed-in account, or undefined when nobody is signed in. */
export function useAccount() {
  return useSession((state) => state.account) ?? undefined;
}
