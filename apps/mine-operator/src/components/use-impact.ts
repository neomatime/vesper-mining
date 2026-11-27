"use client";

/**
 * Reads and changes the Gold demonstration's estimate. One query feeds every screen that shows the impact (the issue, equipment, shift,
 * readiness and shipment pages and the Overview), and every change refreshes all of them, so they cannot show different figures.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, demoFetch, demoSend } from "@core/lib/api";
import type { demoDomain } from "@core/lib/demo-store";
import { useDemoContext } from "@core/stores/demo-context";
import { useToast } from "@core/components/toast-provider";

export type ImpactView = ReturnType<typeof demoDomain.impact>;

export function useImpact() {
  const { context } = useDemoContext();
  // The person is part of the key: what they may see (money) depends on who they are.
  return useQuery({ queryKey: ["impact", context.persona], queryFn: () => demoFetch<ImpactView>("/impact") });
}

type Message = { title: string; detail?: string };

/** One change to the estimate, with confirmation and plain-words errors. Everything on screen is refreshed afterwards. */
export function useImpactAction<TInput>(path: string, success: (view: ImpactView, input: TInput) => Message, onDone?: () => void) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (input: TInput) => demoSend<ImpactView>(path, "POST", input),
    onSuccess: async (view, input) => {
      // The change touches the equipment, the issue, the shift and the Overview as well, so refresh all of it.
      await queryClient.invalidateQueries();
      toast.push(success(view, input));
      onDone?.();
    },
    onError: (error) => {
      toast.push({
        tone: "error",
        title: error instanceof ApiError && error.status === 403 ? "That step is not available to you" : error instanceof ApiError && error.status === 400 ? "Check the details" : "That did not work",
        detail: error instanceof Error ? error.message : undefined,
      });
    },
  });
}
