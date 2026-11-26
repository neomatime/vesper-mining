/**
 * Route page. Renders Administration (organisation, people, roles and rights).
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminScreen } from "@/components/admin-screen";

export const metadata: Metadata = { title: "Administration" };
export default function AdminPage() {
  return (
    <Suspense>
      <AdminScreen />
    </Suspense>
  );
}
