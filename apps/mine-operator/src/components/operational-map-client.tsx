"use client";

/**
 * Loads the map on the client only. The map library needs the browser, so it is imported dynamically and never rendered on
 * the server.
 */
import type { MapArea } from "@vesper/api-contracts";
import dynamic from "next/dynamic";

const MapImplementation = dynamic(
  () => import("./operational-map").then((module) => module.OperationalMap),
  {
    ssr: false,
    loading: () => <div className="leaflet-shell"><div className="state-panel">Preparing the site plan…</div></div>,
  },
);

export function OperationalMapClient({ areas, compact = false }: { areas: MapArea[]; compact?: boolean }) {
  return <MapImplementation areas={areas} compact={compact} />;
}
