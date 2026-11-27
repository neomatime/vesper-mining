"use client";

/**
 * Live vehicle positions for the delivery map. Reads the registered telematics providers every few seconds and turns the readings
 * into journeys. The simulated provider runs on a scenario clock that starts at the scenario's 'now' and runs 20 times faster than
 * real time, so movement is visible; pausing freezes it. Nothing here writes to any record.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { DEMO_NOW } from "@core/lib/demo-data";
import { vehicleLoads } from "@core/lib/tracking/fleet";
import { readPositions, telematicsRegistry } from "@core/lib/tracking/providers";
import type { VehiclePosition } from "@core/lib/tracking/telematics";
import type { LatLng } from "@core/lib/tracking/telematics";
import { journeyPath, trackJourneys, type Journey, type TrackedDelivery } from "@core/lib/tracking/tracking";

const SPEED = 20;
const INTERVAL_MS = 3000;

export function useLiveTracking(deliveries: TrackedDelivery[]) {
  const [live, setLive] = useState(true);
  const [now, setNow] = useState(() => new Date(DEMO_NOW).toISOString());
  const [readings, setReadings] = useState<VehiclePosition[] | null>(null);
  const clock = useRef({ simulated: Date.parse(DEMO_NOW), real: 0 });
  // Each delivery's route (stored plan or known road), keyed so a new list with the same routes does not restart tracking.
  const routesKey = JSON.stringify(deliveries.map((item) => [item.id, journeyPath(item)?.route ?? null]));
  const routeMap = useMemo(() => new Map((JSON.parse(routesKey) as [string, LatLng[] | null][]).filter((entry) => entry[1] !== null) as [string, LatLng[]][]), [routesKey]);
  const registry = useMemo(() => telematicsRegistry((id) => routeMap.get(id) ?? null), [routeMap]);

  useEffect(() => {
    let cancelled = false;
    const state = clock.current;
    const ids = vehicleLoads.filter((item) => routeMap.has(item.deliveryId)).map((item) => item.vehicleId);
    const tick = async () => {
      const real = performance.now();
      if (state.real) state.simulated += (real - state.real) * SPEED;
      state.real = real;
      const at = new Date(state.simulated).toISOString();
      const next = await readPositions(ids, at, registry);
      if (!cancelled) {
        setNow(at);
        setReadings(next);
      }
    };
    void tick();
    if (!live) {
      state.real = 0;
      return () => { cancelled = true; };
    }
    const timer = window.setInterval(() => void tick(), INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      state.real = 0;
    };
  }, [live, registry, routeMap]);

  const journeys: Journey[] = useMemo(() => (readings ? trackJourneys(deliveries, readings, now) : []), [deliveries, readings, now]);
  return { journeys, now, live, setLive, ready: readings !== null };
}
