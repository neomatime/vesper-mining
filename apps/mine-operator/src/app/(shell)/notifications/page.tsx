/**
 * Route page. Renders all notifications for the signed-in person (the top bar shows the latest).
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import type { Metadata } from "next";
import { NotificationsScreen } from "@/components/notifications-screen";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return <NotificationsScreen />;
}
