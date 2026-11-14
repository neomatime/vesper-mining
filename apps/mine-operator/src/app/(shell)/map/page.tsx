/**
 * Route page. Renders the operational map.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import type { Metadata } from "next";
import { MapScreen } from "@/components/map-screen";

export const metadata: Metadata = { title: "Operational Map" };
export default function OperationalMapPage() { return <MapScreen />; }
