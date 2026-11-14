/**
 * Route page. Renders the list of reports the subscription can open.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import type { Metadata } from "next";
import { ReportsIndexScreen } from "@/components/reports-index-screen";

export const metadata: Metadata = { title: "Reports" };
export default function ReportsPage() { return <ReportsIndexScreen />; }
