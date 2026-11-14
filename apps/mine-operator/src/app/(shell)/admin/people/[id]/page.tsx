/**
 * Route page. Renders one person's profile as an administrator sees it.
 * Routes only choose the screen and read the URL; the behaviour lives in the component.
 */
import type { Metadata } from "next";
import { EmployeeProfileScreen } from "@/components/employee-profile-screen";

export const metadata: Metadata = { title: "Employee" };

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EmployeeProfileScreen id={id} />;
}
