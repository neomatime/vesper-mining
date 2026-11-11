import type { Metadata } from "next";
import { MapScreen } from "@/components/map-screen";

export const metadata: Metadata = { title: "Operational Map" };
export default function OperationalMapPage() { return <MapScreen />; }
