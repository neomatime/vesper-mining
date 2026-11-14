/**
 * Route page. Renders the Overview, the first page after sign-in.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import type { Metadata } from "next";
import { OverviewScreen } from "@/components/overview-screen";

export const metadata: Metadata = { title: "Command Centre" };
export default function OverviewPage() { return <OverviewScreen />; }
