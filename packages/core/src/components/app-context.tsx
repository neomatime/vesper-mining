"use client";

/**
 * Which VESPER app is showing a shared screen, so its links go to the right place (see lib/app-links.ts). Each app's root layout
 * sets it once; screens call useAppLink() or render <AppLink>.
 */
import Link from "next/link";
import { createContext, useContext } from "react";
import { linkFor, type VesperApp } from "../lib/app-links";

const AppContext = createContext<VesperApp>("operations");

export function AppProvider({ app, children }: { app: VesperApp; children: React.ReactNode }) {
  return <AppContext.Provider value={app}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);

/** Turns an in-app path into this app's address for it (null: not reachable from this app). */
export function useAppLink() {
  const app = useApp();
  return (href: string) => linkFor(app, href);
}

/** A link that follows the app it is shown in; plain text when the place is not reachable from this app. */
export function AppLink({ href, children, ...rest }: Omit<React.ComponentProps<typeof Link>, "href"> & { href: string }) {
  const target = useAppLink()(href);
  if (!target) return <span className={rest.className}>{children}</span>;
  return <Link href={target} {...rest}>{children}</Link>;
}
