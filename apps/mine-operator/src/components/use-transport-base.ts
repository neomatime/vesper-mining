"use client";

import { usePathname } from "next/navigation";

/**
 * Where the transport provider, quote and agreement pages live. The same records and screens serve both workspaces: opened from Trade's
 * Logistics they stay under /trade/logistics (with the Trade sidebar); opened from Mining Operations' Shipments they stay there.
 */
export function useTransportBase() {
  const pathname = usePathname();
  return pathname === "/trade" || pathname.startsWith("/trade/") ? "/trade/logistics" : "/shipments/providers";
}
