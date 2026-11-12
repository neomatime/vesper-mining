"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { exit, useAccount } from "@/stores/session";

/** Sends anyone who is not signed in to the sign-in screen, then back to where they were going. */
export function RequireSession({ children }: { children: React.ReactNode }) {
  const account = useAccount();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!account && !exit.explicit) router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`);
  }, [account, pathname, router]);

  return account ? <>{children}</> : null;
}
