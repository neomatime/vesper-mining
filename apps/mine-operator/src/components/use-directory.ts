"use client";

import { owners as fallbackOwners } from "@/lib/personas";
import { useShellData } from "./shell-data";

const CONTRACTOR = "OreTech Services";

/** Names that can own work: everyone with access today, plus the contractor team. */
export function useOwners() {
  const { data } = useShellData();
  if (!data) return fallbackOwners;
  return [...data.members.filter((member) => member.status !== "deactivated").map((member) => member.name), CONTRACTOR];
}

/** People who can supervise a shift. */
export function useSupervisors() {
  const { data } = useShellData();
  return (data?.members ?? []).filter((member) => member.status !== "deactivated" && (member.role === "Shift Supervisor" || member.role === "Mine Manager"));
}
