import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { demoSend } from "@/lib/api";
import type { Account } from "@/lib/accounts";
import { useDemoContext } from "./demo-context";

export type AuthResult = { account: Account | null; mustChangePassword: boolean };

type SessionStore = {
  account: Account | null;
  /** Checks the credentials against the organisation's people. Rejects with an ApiError when they are refused. */
  signIn: (email: string, password: string) => Promise<AuthResult>;
  /** Signs in with a work Microsoft account. Rejects with an ApiError when the address has no VESPER access. */
  signInWithMicrosoft: (email: string) => Promise<AuthResult>;
  /** Replaces a temporary password with one the person chose, then signs them in. */
  changePassword: (email: string, current: string, next: string) => Promise<AuthResult>;
  signOut: () => void;
};

/** Set when someone signs out on purpose, so the guard does not send them back to the page they left. */
export const exit = { explicit: false };

export const useSession = create<SessionStore>()(
  persist(
    (set) => ({
      account: null,
      signIn: async (email, password) => {
        const result = await demoSend<AuthResult>("/session", "POST", { email, password });
        if (result.account) {
          useDemoContext.getState().setContext({ persona: result.account.name, role: result.account.role });
          set({ account: result.account });
        }
        return result;
      },
      signInWithMicrosoft: async (email) => {
        const result = await demoSend<AuthResult>("/session/sso", "POST", { email });
        if (result.account) {
          useDemoContext.getState().setContext({ persona: result.account.name, role: result.account.role });
          set({ account: result.account });
        }
        return result;
      },
      changePassword: async (email, current, next) => {
        const result = await demoSend<AuthResult>("/session/password", "POST", { email, current, next });
        if (result.account) {
          useDemoContext.getState().setContext({ persona: result.account.name, role: result.account.role });
          set({ account: result.account });
        }
        return result;
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
