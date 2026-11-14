/**
 * Route page. Renders the phone's schedule.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import type { Metadata } from "next";
import { MobileScheduleScreen } from "@/components/mobile-schedule-screen";

export const metadata: Metadata = { title: "Shift calendar" };
export default function MobileSchedulePage() { return <MobileScheduleScreen />; }
