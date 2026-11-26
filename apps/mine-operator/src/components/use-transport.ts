"use client";

/**
 * Reads and writes service providers, transport quotes and transport agreements. One query (`transport`) feeds every Service providers
 * screen; the commercial terms in it are only sent to roles allowed to see them. Every change refreshes that query, the logistics
 * data (a shipment's pricing source lives there), the Overview and notifications.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { demoFetch, demoSend } from "@/lib/api";
import type { demoDomain } from "@/lib/demo-store";
import { useDemoContext } from "@/stores/demo-context";
import { useToast } from "./toast-provider";
import { failureTitle } from "./use-logistics";

export type Transport = ReturnType<typeof demoDomain.transport>;

export function useTransport() {
  const { context } = useDemoContext();
  return useQuery({ queryKey: ["transport", context.siteId, context.role], queryFn: () => demoFetch<Transport>("/transport") });
}

type Message = { title: string; detail?: string };

/** One write with consistent saving, confirmation and error handling. Nothing is announced as done unless the server accepted it. */
export function useTransportAction<TInput, TResult>(options: {
  path: string | ((input: TInput) => string);
  method?: "POST" | "PATCH";
  success: (result: TResult, input: TInput) => Message;
  onDone?: (result: TResult, input: TInput) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (input: TInput) => demoSend<TResult>(typeof options.path === "function" ? options.path(input) : options.path, options.method ?? "POST", input),
    onSuccess: async (result, input) => {
      await Promise.all(["transport", "logistics", "overview", "notifications", "report", "trade"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      toast.push(options.success(result, input));
      options.onDone?.(result, input);
    },
    onError: (error) => toast.push({ tone: "error", title: failureTitle(error), detail: error instanceof Error ? error.message : undefined }),
  });
}
