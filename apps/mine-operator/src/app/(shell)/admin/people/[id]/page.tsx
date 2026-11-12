import type { Metadata } from "next";
import { EmployeeProfileScreen } from "@/components/employee-profile-screen";

export const metadata: Metadata = { title: "Employee" };

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EmployeeProfileScreen id={id} />;
}
