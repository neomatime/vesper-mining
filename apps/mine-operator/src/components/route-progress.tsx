"use client";

import { usePathname } from "next/navigation";

/** A hairline of emerald light that sweeps across the top of the screen each time the person moves to another page. */
export function RouteProgress() {
  const pathname = usePathname();
  return <div key={pathname} className="route-progress" aria-hidden="true" />;
}
