/**
 * Route page. Everything the person reported and where it stands, and what is waiting on this phone to be sent.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import type { Metadata } from "next";
import { MyReportsScreen } from "@/components/my-reports-screen";

export const metadata: Metadata = { title: "My reports" };

export default function MyReportsPage() {
  return <MyReportsScreen />;
}
