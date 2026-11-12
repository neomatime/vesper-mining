import type { Metadata } from "next";
import { MobileScheduleScreen } from "@/components/mobile-schedule-screen";

export const metadata: Metadata = { title: "Shift calendar" };
export default function MobileSchedulePage() { return <MobileScheduleScreen />; }
