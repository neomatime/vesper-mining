"use client";

/**
 * Reads and changes the automations: the seven notification rules, their settings and the history of runs. Rules only notify; running
 * one refreshes the notification list so what it announced appears straight away.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, demoFetch, demoSend } from "@core/lib/api";
import type { demoDomain } from "@core/lib/demo-store";
import { useDemoContext } from "@core/stores/demo-context";
import { useToast } from "@core/components/toast-provider";

export type AutomationsView = ReturnType<typeof demoDomain.automations>;
export type AutomationRunView = AutomationsView & { summary: { rulesRun: number; found: number; notified: number } };

export function useAutomations() {
  const { context } = useDemoContext();
  return useQuery({ queryKey: ["automations", context.persona], queryFn: () => demoFetch<AutomationsView>("/automations") });
}

function failure(error: unknown) {
  return { tone: "error" as const, title: error instanceof ApiError && error.status === 403 ? "That is not available to you" : error instanceof ApiError && (error.status === 400 || error.status === 409) ? "Check the details" : "That did not work", detail: error instanceof Error ? error.message : undefined };
}

export function useAutomationMutations() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const refresh = () => Promise.all(["automations", "notifications"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
  const update = useMutation({
    mutationFn: ({ key, ...input }: { key: string; enabled?: boolean; recipient?: string; threshold?: number }) => demoSend<AutomationsView>(`/automations/${key}`, "PATCH", input),
    onSuccess: async () => { await refresh(); toast.push({ title: "Saved" }); },
    onError: (error) => toast.push(failure(error)),
  });
  const run = useMutation({
    mutationFn: (input: { key?: string }) => demoSend<AutomationRunView>("/automations/run", "POST", input),
    onSuccess: async (result) => {
      await refresh();
      toast.push({ title: result.summary.notified > 0 ? `${result.summary.notified} notification${result.summary.notified === 1 ? "" : "s"} sent` : "Nothing new to announce", detail: `${result.summary.found} found by ${result.summary.rulesRun} rule${result.summary.rulesRun === 1 ? "" : "s"}. Notifications stay inside VESPER.` });
    },
    onError: (error) => toast.push(failure(error)),
  });
  return { update, run };
}
