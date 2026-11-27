"use client";

/**
 * The planning map (Leaflet, browser only): the collection point (A) and delivery point (B) as pins, the route between them, and
 * VESPER's base map. While a planner is placing a point, a click on the map puts it there; pins can be dragged to fine-tune.
 * Read-only on the delivery page.
 */
import L from "leaflet";
import { Minus, Plus, Scan } from "lucide-react";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { places } from "@core/lib/tracking/network";
import type { LatLngPair } from "@core/lib/trade-rules";
import { BaseMap, DetailLevel } from "./delivery-map";

const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL;
const TILE_ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ?? "";

export type PointKey = "collection" | "delivery";

const pinIcon = (letter: string, kind: PointKey, active: boolean) => L.divIcon({
  className: "dm-marker-wrap",
  iconSize: [0, 0],
  html: `<span class="lp-pin lp-pin--${kind}${active ? " is-active" : ""}"><span class="lp-pin__head"><b>${letter}</b></span></span>`,
});

function Behaviour({ picking, onPick, fitKey, bounds }: { picking: PointKey | null; onPick?: (key: PointKey, position: LatLngPair) => void; fitKey: string; bounds: L.LatLngBounds | null }) {
  const map = useMap();
  useMapEvents({
    click: (event) => {
      if (picking && onPick) onPick(picking, [event.latlng.lat, event.latlng.lng]);
    },
  });
  useEffect(() => {
    map.getContainer().classList.toggle("is-picking", Boolean(picking));
  }, [map, picking]);
  // The map's box can change size after it is drawn (fonts, the layout around it): measure again so the framing stays right.
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  // Frame the points and route whenever they change (not on every render).
  useEffect(() => {
    if (bounds) map.flyToBounds(bounds, { padding: [48, 48], maxZoom: 11, duration: 0.5 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey]);
  return (
    <div className="dm-controls">
      <div className="dm-control-group">
        <button type="button" className="dm-control" aria-label="Zoom in" onClick={() => map.zoomIn()}><Plus /></button>
        <button type="button" className="dm-control" aria-label="Zoom out" onClick={() => map.zoomOut()}><Minus /></button>
      </div>
      <button type="button" className="dm-control" aria-label="Show the whole route" disabled={!bounds} onClick={() => bounds && map.flyToBounds(bounds, { padding: [48, 48], maxZoom: 11, duration: 0.5 })}><Scan /></button>
    </div>
  );
}

export function LocationMap({ collection, delivery, route, picking = null, onPick, onMove, readOnly = false }: {
  collection: LatLngPair | null;
  delivery: LatLngPair | null;
  route: LatLngPair[] | null;
  picking?: PointKey | null;
  onPick?: (key: PointKey, position: LatLngPair) => void;
  onMove?: (key: PointKey, position: LatLngPair) => void;
  readOnly?: boolean;
}) {
  const points = [collection, delivery].filter((item): item is LatLngPair => item !== null);
  const all = [...points, ...(route ?? [])];
  const bounds = all.length >= 2 ? L.latLngBounds(all) : all.length === 1 ? L.latLng(all[0]).toBounds(160_000) : null;
  const fitKey = JSON.stringify([collection, delivery, route?.length ?? 0]);
  const initial = useMemo(() => bounds ?? L.latLng(places.riverside.position).toBounds(400_000), []); // eslint-disable-line react-hooks/exhaustive-deps
  const colour = typeof window === "undefined" ? "#16865b" : getComputedStyle(document.documentElement).getPropertyValue("--brand-emerald").trim() || "#16865b";

  return (
    <MapContainer bounds={initial} boundsOptions={{ padding: [48, 48], maxZoom: 11 }} zoomControl={false} attributionControl={Boolean(TILE_URL)} className="dm-map lp-map" minZoom={4} maxZoom={17} zoomSnap={0.25}>
      {TILE_URL ? <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} /> : <BaseMap />}
      <DetailLevel />
      {route && route.length >= 2 ? (
        <>
          <Polyline positions={route} pathOptions={{ color: "#ffffff", weight: 8, opacity: 0.9, lineJoin: "round" }} interactive={false} />
          <Polyline positions={route} pathOptions={{ color: colour, weight: 4.5, opacity: 0.95, lineJoin: "round", dashArray: route.length === 2 ? "8 8" : undefined }} interactive={false} />
        </>
      ) : null}
      {collection ? (
        <Marker position={collection} icon={pinIcon("A", "collection", picking === "collection")} draggable={!readOnly} keyboard={false} title="Collection point"
          eventHandlers={{ dragend: (event) => { const at = (event.target as L.Marker).getLatLng(); onMove?.("collection", [at.lat, at.lng]); } }} />
      ) : null}
      {delivery ? (
        <Marker position={delivery} icon={pinIcon("B", "delivery", picking === "delivery")} draggable={!readOnly} keyboard={false} title="Delivery point"
          eventHandlers={{ dragend: (event) => { const at = (event.target as L.Marker).getLatLng(); onMove?.("delivery", [at.lat, at.lng]); } }} />
      ) : null}
      <Behaviour picking={readOnly ? null : picking} onPick={onPick} fitKey={fitKey} bounds={bounds} />
    </MapContainer>
  );
}
