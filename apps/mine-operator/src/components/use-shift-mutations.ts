"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ApiError, demoSend } from "@/lib/api";
import type { ShiftView } from "@/lib/shift-rules";
import { useToast } from "./toast-provider";

function failureTitle(error: unknown) {
  if (!(error instanceof ApiError)) return "That did not work";
  if (error.status === 403) return "That step is not available to you";
  if (error.code === "VERSION_CONFLICT") return "This shift changed";
  if (error.code === "OVERLAP" || error.code === "DOUBLE_BOOKED") return "That clashes with another shift";
  if (error.code === "HANDOVER_REQUIRED") return "Hand over first";
  if (error.status === 400) return "Check the details";
  return "That did not work";
}

export type ShiftFormInput = {
  name: string;
  date: string;
  start: string;
  end: string;
  supervisor: string | null;
  briefing: string | null;
};

export type CrewInput = { name: string; duty: string; equipmentId: string | null };
export type WorkInput = { title: string; owner: string | null; issueId: string | null };

function useRefresh() {
  const queryClient = useQueryClient();
  return async (shift?: ShiftView) => {
    if (shift) queryClient.setQueryData(["shift", shift.id], shift);
    await Promise.all(["workspace", "overview", "shift", "notifications", "report"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
  };
}

/** Schedules a new shift, then opens it. */
export function useCreateShift() {
  const router = useRouter();
  const toast = useToast();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: ShiftFormInput) => demoSend<ShiftView>("/shifts", "POST", input),
    onSuccess: async (shift) => {
      await refresh(shift);
      toast.push({ title: "Shift scheduled", detail: `${shift.name} is on the roster.` });
      router.push(`/shifts/${shift.id}`);
    },
    onError: (error) => toast.push({ tone: "error", title: failureTitle(error), detail: error instanceof Error ? error.message : undefined }),
  });
}

/** Every change to one shift, with consistent refresh, confirmation and error handling. */
export function useShiftMutations(shift: ShiftView) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const refresh = useRefresh();
  const base = `/shifts/${shift.id}`;
  const version = shift.version;

  const onError = (error: unknown) => {
    toast.push({ tone: "error", title: failureTitle(error), detail: error instanceof Error ? error.message : undefined });
    if (error instanceof ApiError && error.code === "VERSION_CONFLICT") void queryClient.invalidateQueries({ queryKey: ["shift", shift.id] });
  };

  const make = <TInput,>(path: string, method: "POST" | "PATCH" | "DELETE" | "PUT", title: string, detail?: (result: ShiftView) => string | undefined) => ({
    mutationFn: (input: TInput) => demoSend<ShiftView>(`${base}${path}`, method, { ...(input as object), version }),
    onSuccess: async (result: ShiftView) => {
      await refresh(result);
      toast.push({ title, detail: detail?.(result) });
    },
    onError,
  });

  const update = useMutation(make<Partial<ShiftFormInput>>("", "PATCH", "Changes saved"));
  const addCrew = useMutation(make<CrewInput>("/crew", "POST", "Added to the shift"));
  const addWork = useMutation(make<WorkInput>("/work", "POST", "Work added"));
  const cancel = useMutation(make<{ reason: string }>("/cancel", "POST", "Shift cancelled", () => "The record is kept."));
  const start = useMutation({
    mutationFn: () => demoSend<ShiftView>(`${base}/start`, "POST"),
    onSuccess: async (result) => {
      await refresh(result);
      toast.push({ title: `${result.name} started`, detail: "The shift is now running." });
    },
    onError,
  });
  const close = useMutation({
    mutationFn: () => demoSend<ShiftView>(`${base}/close`, "POST"),
    onSuccess: async (result) => {
      await refresh(result);
      toast.push({ title: `${result.name} closed`, detail: result.next ? `${result.next.name} can start now.` : undefined });
    },
    onError,
  });
  const removeCrew = useMutation({
    mutationFn: (crewId: string) => demoSend<ShiftView>(`${base}/crew/${crewId}`, "DELETE", { version }),
    onSuccess: async (result) => {
      await refresh(result);
      toast.push({ title: "Removed from the shift" });
    },
    onError,
  });
  const updateWork = useMutation({
    mutationFn: ({ workId, ...input }: { workId: string; done?: boolean; title?: string; owner?: string | null }) =>
      demoSend<ShiftView>(`${base}/work/${workId}`, "PATCH", { ...input, version }),
    onSuccess: async (result) => {
      await refresh(result);
    },
    onError,
  });
  const removeWork = useMutation({
    mutationFn: (workId: string) => demoSend<ShiftView>(`${base}/work/${workId}`, "DELETE", { version }),
    onSuccess: async (result) => {
      await refresh(result);
      toast.push({ title: "Work removed" });
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: () => demoSend<{ id: string; deleted: true }>(base, "DELETE"),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ["shift", shift.id] });
      await refresh();
      toast.push({ title: "Shift deleted", detail: `${shift.name} was removed from the roster.` });
      router.push("/shifts");
    },
    onError,
  });

  const saveNotes = useMutation({
    mutationFn: (notes: string) => demoSend<ShiftView>(`${base}/handover`, "PUT", { notes }),
    onSuccess: async (result) => {
      await refresh(result);
      toast.push({ title: "Handover notes saved", detail: "They are still a draft until you publish." });
    },
    onError,
  });
  const publish = useMutation({
    mutationFn: async (notes: string | null) => {
      if (notes !== null) await demoSend(`${base}/handover`, "PUT", { notes });
      return demoSend<ShiftView>(`${base}/handover/publish`, "POST");
    },
    onSuccess: async (result) => {
      await refresh(result);
      toast.push({ title: "Handover published", detail: result.next ? `${result.next.name} can now acknowledge it.` : "The next supervisor can now acknowledge it." });
    },
    onError,
  });
  const withdraw = useMutation({
    mutationFn: () => demoSend<ShiftView>(`${base}/handover/withdraw`, "POST"),
    onSuccess: async (result) => {
      await refresh(result);
      toast.push({ title: "Handover withdrawn", detail: "It is a draft again and can be edited." });
    },
    onError,
  });
  const acknowledge = useMutation({
    mutationFn: () => demoSend<ShiftView>(`${base}/acknowledgement`, "POST"),
    onSuccess: async (result) => {
      await refresh(result);
      toast.push({ title: "Handover acknowledged", detail: "Receipt is recorded. The issues themselves remain open." });
    },
    onError,
  });

  return { update, addCrew, addWork, cancel, start, close, removeCrew, updateWork, removeWork, remove, saveNotes, publish, withdraw, acknowledge };
}
