"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ApiError, demoSend } from "@/lib/api";
import type { EquipmentView } from "@/lib/equipment-rules";
import { useToast } from "./toast-provider";

function failureTitle(error: unknown) {
  if (!(error instanceof ApiError)) return "That did not work";
  if (error.status === 403) return "That step is not available to you";
  if (error.code === "VERSION_CONFLICT") return "This record changed";
  if (error.status === 400 || error.code === "DUPLICATE_CODE") return "Check the details";
  if (error.code === "IN_USE" || error.code === "HAS_HISTORY") return "It can not be removed yet";
  return "That did not work";
}

export type EquipmentFormInput = {
  name: string;
  code: string;
  category: string;
  areaId: string | null;
  makeModel: string | null;
  serialNumber: string | null;
  hoursPerDay: number | null;
  notes: string | null;
  hours?: number | null;
};

export type PlanInput = {
  name: string;
  basis: "hours" | "days";
  interval: number;
  lastServiceHours?: number | null;
  lastServiceAt?: string | null;
};

export type ServiceInput = {
  type: "service" | "inspection" | "repair";
  summary: string;
  performedAt?: string | null;
  hours?: number | null;
  planId?: string | null;
  workOrderRef?: string | null;
};

function useRefresh() {
  const queryClient = useQueryClient();
  return async (item?: EquipmentView) => {
    if (item) queryClient.setQueryData(["equipment", item.id], item);
    await Promise.all(
      ["workspace", "overview", "equipment-list", "report"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
    );
  };
}

/** Adds a new piece of equipment, then opens it. */
export function useCreateEquipment() {
  const router = useRouter();
  const toast = useToast();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: EquipmentFormInput) => demoSend<EquipmentView>("/equipment", "POST", input),
    onSuccess: async (item) => {
      await refresh(item);
      toast.push({ title: "Equipment added", detail: `${item.name} is on the register.` });
      router.push(`/equipment/${item.id}`);
    },
    onError: (error) => toast.push({ tone: "error", title: failureTitle(error), detail: error instanceof Error ? error.message : undefined }),
  });
}

/** Every change to one piece of equipment, with consistent refresh, confirmation and error handling. */
export function useEquipmentMutations(item: EquipmentView) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const refresh = useRefresh();
  const base = `/equipment/${item.id}`;
  const version = item.version;

  const onError = (error: unknown) => {
    toast.push({ tone: "error", title: failureTitle(error), detail: error instanceof Error ? error.message : undefined });
    if (error instanceof ApiError && error.code === "VERSION_CONFLICT") void queryClient.invalidateQueries({ queryKey: ["equipment", item.id] });
  };

  const make = <TInput,>(path: string, method: "POST" | "PATCH" | "DELETE", title: string, detail?: (result: EquipmentView) => string | undefined) =>
    ({
      mutationFn: (input: TInput) => demoSend<EquipmentView>(`${base}${path}`, method, { ...(input as object), version }),
      onSuccess: async (result: EquipmentView) => {
        await refresh(result);
        toast.push({ title, detail: detail?.(result) });
      },
      onError,
    });

  const update = useMutation(make<Partial<EquipmentFormInput>>("", "PATCH", "Changes saved"));
  const setState = useMutation(make<{ state: "available" | "unavailable"; note?: string; reason?: string }>("/state", "POST", "Availability updated", (result) => (result.state === "unavailable" ? "Reported unavailable. This is a report, not a verified status." : "Reported available.")));
  const recordReading = useMutation(make<{ hours: number; correction?: boolean; note?: string }>("/readings", "POST", "Meter reading recorded", (result) => result.nextService?.label));
  const addPlan = useMutation(make<PlanInput>("/plans", "POST", "Maintenance plan added", (result) => result.nextService?.label));
  const logService = useMutation(make<ServiceInput>("/services", "POST", "Entry logged", (result) => result.nextService?.label));
  const retire = useMutation(make<{ reason: string }>("/retire", "POST", "Equipment retired", () => "Its history is kept, and it can be restored."));
  const restore = useMutation({
    mutationFn: () => demoSend<EquipmentView>(`${base}/restore`, "POST"),
    onSuccess: async (result) => {
      await refresh(result);
      toast.push({ title: "Equipment restored", detail: `${result.name} is back on the active register.` });
    },
    onError,
  });
  const updatePlan = useMutation({
    mutationFn: ({ planId, ...input }: PlanInput & { planId: string }) => demoSend<EquipmentView>(`${base}/plans/${planId}`, "PATCH", { ...input, version }),
    onSuccess: async (result) => {
      await refresh(result);
      toast.push({ title: "Maintenance plan updated", detail: result.nextService?.label });
    },
    onError,
  });
  const removePlan = useMutation({
    mutationFn: (planId: string) => demoSend<EquipmentView>(`${base}/plans/${planId}`, "DELETE", { version }),
    onSuccess: async (result) => {
      await refresh(result);
      toast.push({ title: "Maintenance plan removed" });
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: () => demoSend<{ id: string; deleted: true }>(base, "DELETE"),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ["equipment", item.id] });
      await refresh();
      toast.push({ title: "Equipment deleted", detail: `${item.name} was removed from the register.` });
      router.push("/equipment");
    },
    onError,
  });

  return { update, setState, recordReading, addPlan, updatePlan, removePlan, logService, retire, restore, remove };
}
