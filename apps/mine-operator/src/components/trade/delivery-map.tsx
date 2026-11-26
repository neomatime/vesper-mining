"use client";

/**
 * The delivery map itself (Leaflet, browser only): the mine, delivery points, haul routes, each vehicle with its delivery reference,
 * colour-coded by status, with the part of the route already driven drawn solid and the part ahead dashed. Zoom, recentre and full
 * screen are on the map. By default the base map is drawn by VESPER (towns, provinces, routes) and loads nothing from outside;
 * setting NEXT_PUBLIC_MAP_TILE_URL (and NEXT_PUBLIC_MAP_TILE_ATTRIBUTION) uses an approved tile provider instead.
 */
import L from "leaflet";
import { Maximize2, Minimize2, Minus, Plus, LocateFixed } from "lucide-react";
import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import { places, regions, routes } from "@/lib/tracking/network";
import type { LatLng } from "@/lib/tracking/telematics";
import { deliveryTrackingStatus, type Journey } from "@/lib/tracking/tracking";

const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL;
const TILE_ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ?? "";

const truck = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>';
const pickaxe = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.531 12.469 6.619 20.38a1 1 0 1 1-3-3l7.912-7.912"/><path d="M15.686 4.314A12.5 12.5 0 0 0 5.461 2.958 1 1 0 0 0 5.58 4.71a22 22 0 0 1 6.318 3.393"/><path d="M17.7 3.7a1 1 0 0 0-1.4 0l-4.6 4.6a1 1 0 0 0 0 1.4l2.6 2.6a1 1 0 0 0 1.4 0l4.6-4.6a1 1 0 0 0 0-1.4z"/><path d="M19.686 8.314a12.501 12.501 0 0 1 1.356 10.225 1 1 0 0 1-1.751-.119 22 22 0 0 0-3.393-6.319"/></svg>';

/** The theme's colour for a token. Map lines need real colours (they cannot read CSS variables), so they are read when drawing. */
function token(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
const palette = () => ({
  on_track: token("--dm-on-track", "#17895c"),
  at_risk: token("--dm-at-risk", "#d08a1c"),
  delayed: token("--dm-delayed", "#cf3f37"),
  unavailable: token("--dm-unavailable", "#8b958f"),
  arrived: token("--dm-on-track", "#17895c"),
  road: token("--dm-road", "#ffffff"),
  label: token("--dm-label", "#5c6b62"),
  ink: token("--text-primary", "#141d19"),
  surface: token("--surface-base", "#ffffff"),
});

const escape = (text: string) => text.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char);

function vehicleIcon(journey: Journey, selected: boolean, dimmed: boolean, labelled: boolean) {
  const label = selected && journey.loadCount > 1 ? `${journey.delivery.number} · ${journey.registration}` : journey.loadCount > 1 ? `${journey.delivery.number} · ${journey.loadCount} vehicles` : journey.delivery.number;
  return L.divIcon({
    className: "dm-marker-wrap",
    iconSize: [0, 0],
    html: `<span class="dm-vehicle dm-vehicle--${journey.status}${journey.estimated ? " dm-vehicle--estimated" : ""}${journey.freshness === "stale" ? " dm-vehicle--stale" : ""}${selected ? " is-selected" : ""}${dimmed ? " is-dimmed" : ""}"><span class="dm-vehicle__dot">${truck}</span>${labelled ? `<span class="dm-vehicle__label">${escape(label)}</span>` : ""}</span>`,
  });
}

const mineIcon = L.divIcon({ className: "dm-marker-wrap", iconSize: [0, 0], html: `<span class="dm-mine"><span class="dm-mine__dot">${pickaxe}</span><span class="dm-mine__label">${escape(places.riverside.name)}</span></span>` });
const regionIcon = (name: string) => L.divIcon({ className: "dm-marker-wrap", iconSize: [0, 0], html: `<span class="dm-region">${escape(name)}</span>` });

export type MapSelection = { deliveryIds: string[]; vehicleId: string | null };

function Controls({ bounds, focus, expanded, onToggleExpanded }: { bounds: L.LatLngBounds; focus: L.LatLngBounds | null; expanded: boolean; onToggleExpanded: () => void }) {
  const map = useMap();
  useEffect(() => {
    const scale = L.control.scale({ position: "bottomright", imperial: false, maxWidth: 110 });
    scale.addTo(map);
    return () => { scale.remove(); };
  }, [map]);
  // After going full screen (or back), let the map measure its new size.
  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 220);
    return () => window.clearTimeout(timer);
  }, [map, expanded]);
  useEffect(() => {
    if (focus) map.flyToBounds(focus, { padding: [70, 70], maxZoom: 9, duration: 0.6 });
  }, [map, focus]);
  return (
    <div className="dm-controls">
      <button type="button" className="dm-control" aria-label={expanded ? "Exit full screen" : "Full screen"} onClick={onToggleExpanded}>{expanded ? <Minimize2 /> : <Maximize2 />}</button>
      <div className="dm-control-group">
        <button type="button" className="dm-control" aria-label="Zoom in" onClick={() => map.zoomIn()}><Plus /></button>
        <button type="button" className="dm-control" aria-label="Zoom out" onClick={() => map.zoomOut()}><Minus /></button>
      </div>
      <button type="button" className="dm-control" aria-label="Recentre the map" onClick={() => map.flyToBounds(focus ?? bounds, { padding: [50, 50], duration: 0.6 })}><LocateFixed /></button>
    </div>
  );
}

export function DeliveryMap({ journeys, selection, onSelectVehicle, expanded, onToggleExpanded, focusKey }: {
  journeys: Journey[];
  selection: MapSelection;
  onSelectVehicle: (journey: Journey, add: boolean) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  /** Changes when the map should fly to the selection (for example, a delivery chosen in the table). */
  focusKey: string;
}) {
  const destinations = useMemo(() => [...new Map(journeys.map((item) => [item.destination.id, item.destination])).values()], [journeys]);
  const byDelivery = useMemo(() => {
    const groups = new Map<string, Journey[]>();
    for (const item of journeys) groups.set(item.delivery.id, [...(groups.get(item.delivery.id) ?? []), item]);
    return groups;
  }, [journeys]);
  // The first view frames the mine and the vehicles; a chosen delivery is framed with its destination.
  const allPoints: LatLng[] = [places.riverside.position, ...journeys.map((item) => item.position)];
  const bounds = L.latLngBounds(allPoints.length > 1 ? allPoints : [places.riverside.position, places.durban_terminal.position]);
  const anySelected = selection.deliveryIds.length > 0 || selection.vehicleId !== null;
  const colours = palette();
  // One label per delivery (on its lead vehicle) keeps the map readable; the chosen vehicle is always labelled.
  const lead = new Set([...byDelivery.values()].map((group) => [...group].sort((a, b) => b.progress - a.progress)[0].vehicleId));
  const isSelected = (item: Journey) => item.vehicleId === selection.vehicleId || selection.deliveryIds.includes(item.delivery.id);
  const focusPoints = journeys.filter(isSelected).flatMap((item) => [item.position, item.destination.position]);
  // Only the focus key moves the map; live position updates never pull the view around.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const focus = useMemo(() => (focusKey && focusPoints.length ? L.latLngBounds(focusPoints) : null), [focusKey]);

  return (
    <MapContainer bounds={bounds} boundsOptions={{ padding: [40, 40] }} zoomControl={false} attributionControl={Boolean(TILE_URL)} className="dm-map" minZoom={5} maxZoom={13} zoomSnap={0.25}>
      {TILE_URL ? <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} /> : null}
      {!TILE_URL ? regions.map((region) => <Marker key={region.name} position={region.position} icon={regionIcon(region.name)} interactive={false} keyboard={false} />) : null}
      {!TILE_URL ? Object.values(routes).map((route) => <Polyline key={route.id} positions={route.points} pathOptions={{ color: colours.road, weight: 4, opacity: 0.9 }} interactive={false} />) : null}
      {!TILE_URL ? Object.values(places).filter((place) => place.kind === "town").map((place) => (
        <CircleMarker key={place.id} center={place.position} radius={2.5} pathOptions={{ color: colours.label, fillColor: colours.label, fillOpacity: 0.7, weight: 1 }} interactive={false}>
          <Tooltip permanent direction="right" offset={[4, 0]} className="dm-town-label">{place.name}</Tooltip>
        </CircleMarker>
      )) : null}

      {[...byDelivery].map(([deliveryId, group]) => {
        const status = deliveryTrackingStatus(group);
        const dimmed = anySelected && !group.some(isSelected);
        return (
          <Polyline key={`ahead-${deliveryId}`} positions={group[0].route} pathOptions={{ color: colours[status], weight: 4, opacity: dimmed ? 0.18 : 0.6, dashArray: "6 8", lineCap: "round" }} interactive={false} />
        );
      })}
      {journeys.map((item) => {
        const dimmed = anySelected && !isSelected(item);
        return <Polyline key={`done-${item.vehicleId}`} positions={item.travelled} pathOptions={{ color: colours[item.status], weight: isSelected(item) ? 6 : 4, opacity: dimmed ? 0.22 : 0.95, lineCap: "round" }} interactive={false} />;
      })}

      {destinations.map((place) => (
        <CircleMarker key={place.id} center={place.position} radius={7} pathOptions={{ color: colours.ink, weight: 2.5, fillColor: colours.surface, fillOpacity: 1 }}>
          <Tooltip direction="top" offset={[0, -6]}>{place.name}</Tooltip>
        </CircleMarker>
      ))}
      <Marker position={places.riverside.position} icon={mineIcon} keyboard={false} title={places.riverside.name} />
      {journeys.map((item) => (
        <Marker
          key={item.vehicleId}
          position={item.position}
          icon={vehicleIcon(item, item.vehicleId === selection.vehicleId, anySelected && !isSelected(item), lead.has(item.vehicleId) || item.vehicleId === selection.vehicleId)}
          zIndexOffset={isSelected(item) ? 1000 : item.status === "delayed" ? 500 : 0}
          title={`${item.delivery.number}, ${item.registration}: ${item.status.replace("_", " ")}`}
          alt={`${item.delivery.number} ${item.registration}`}
          eventHandlers={{ click: (event) => onSelectVehicle(item, Boolean((event.originalEvent as MouseEvent | undefined)?.shiftKey)) }}
        />
      ))}
      <Controls bounds={bounds} focus={focus} expanded={expanded} onToggleExpanded={onToggleExpanded} />
    </MapContainer>
  );
}
