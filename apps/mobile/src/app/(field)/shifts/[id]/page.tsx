/**
 * Route page. A shift as the field sees it: times, supervisor, crew and the work on it.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import { MobileShiftScreen } from "@/components/mobile-shift-screen";

export default async function ShiftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MobileShiftScreen id={id} />;
}
