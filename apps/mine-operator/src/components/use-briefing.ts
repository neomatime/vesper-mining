"use client";

/**
 * Reads and changes the shift briefing review. The generated briefing comes from the records; a supervisor's corrections, note and
 * approval are kept beside it. Approving never sends the handover or changes any other record.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, demoFetch, demoSend } from "@/lib/api";
import type { demoDomain } from "@/lib/demo-store";
import { useDemoContext } from "@/stores/demo-context";
import { useToast } from "./toast-provider";

export type BriefingView = ReturnType<typeof demoDomain.briefing>;

export function useBriefing() {
  const { context } = useDemoContext();
  return useQuery({ queryKey: ["briefing", context.persona], queryFn: () => demoFetch<BriefingView>("/briefing") });
}

/** One change to the briefing review, with confirmation and plain-words errors. */
export function useBriefingAction<TInput>(path: string, success: { title: string; detail?: string }, onDone?: () => void) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (input: TInput) => demoSend<BriefingView>(path, "POST", input),
    onSuccess: async () => {
      await Promise.all(["briefing", "notifications"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      toast.push(success);
      onDone?.();
    },
    onError: (error) => toast.push({ tone: "error", title: error instanceof ApiError && error.status === 403 ? "That step is not available to you" : error instanceof ApiError && error.status === 400 ? "Check the details" : "That did not work", detail: error instanceof Error ? error.message : undefined }),
  });
}
