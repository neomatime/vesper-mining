"use client";

import L, { type LatLngBoundsExpression, type LatLngExpression } from "leaflet";
import { ImageOverlay, MapContainer, Polygon, Tooltip, ZoomControl } from "react-leaflet";
import type { MapArea } from "@vesper/api-contracts";

const bounds: LatLngBoundsExpression = [[0, 0], [600, 1000]];

const geometry: Record<string, LatLngExpression[]> = {
  "area-north-pit": [[420, 80], [540, 150], [510, 410], [380, 360], [350, 160]],
  "area-crusher-line": [[300, 390], [390, 450], [360, 620], [245, 585], [225, 430]],
  "area-central-pit": [[135, 80], [285, 120], [250, 380], [90, 330]],
  "area-rom-pad": [[265, 680], [355, 720], [325, 940], [220, 900]],
  "area-south-pit": [[55, 430], [165, 500], [150, 760], [35, 700]],
};

const colours: Record<MapArea["status"], string> = {
  on_plan: "#16865B",
  at_risk: "#D38B17",
  blocked: "#D43F3A",
  unknown: "#77847C",
};

export function OperationalMap({ areas, compact = false }: { areas: MapArea[]; compact?: boolean }) {
  return (
    <div className={`leaflet-shell ${compact ? "leaflet-shell--compact" : ""}`}>
      <MapContainer
        crs={L.CRS.Simple}
        bounds={bounds}
        maxBounds={bounds}
        minZoom={compact ? -1 : 0}
        zoomControl={false}
        attributionControl={false}
        className="operational-map"
      >
        <ImageOverlay url="/demo/riverside-site-plan.svg" bounds={bounds} />
        {areas.map((area) => (
          <Polygon
            key={area.id}
            positions={geometry[area.id] ?? []}
            pathOptions={{
              color: colours[area.status],
              fillColor: colours[area.status],
              fillOpacity: 0.28,
              weight: 3,
            }}
            eventHandlers={{
              click(event) {
                event.target.openTooltip();
              },
            }}
          >
            <Tooltip direction="top" permanent={area.id === "area-crusher-line" && !compact}>
              <strong>{area.name}</strong>
              <span>{area.status.replace("_", " ")}</span>
              <small>{area.rationale}</small>
            </Tooltip>
          </Polygon>
        ))}
        {!compact ? <ZoomControl position="bottomright" /> : null}
      </MapContainer>
      <p className="map-disclosure">Indicative site map · not live GPS, surveyed positioning or safety clearance</p>
    </div>
  );
}
