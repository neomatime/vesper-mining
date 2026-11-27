"use client";

/**
 * Reads and writes production, mineral inventory and shipments. One query (`logistics`) feeds the Production tab and every
 * Shipments screen, so their figures always agree; every change refreshes that query, the Overview counts and notifications.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError, demoFetch, demoSend } from "@core/lib/api";
import type { demoDomain } from "@core/lib/demo-store";
import { useDemoContext } from "@core/stores/demo-context";
import { useToast } from "@core/components/toast-provider";

export type Logistics = ReturnType<typeof demoDomain.logistics>;
export type StockpileView = Logistics["stockpiles"][number];

export function useLogistics() {
  const { context } = useDemoContext();
  return useQuery({ queryKey: ["logistics", context.siteId], queryFn: () => demoFetch<Logistics>("/logistics") });
}

export function failureTitle(error: unknown) {
  if (!(error instanceof ApiError)) return "That did not work";
  if (error.status === 403) return "That step is not available to you";
  if (error.code === "VERSION_CONFLICT") return "This record changed";
  if (error.code === "INSUFFICIENT_STOCK" || error.code === "TOO_MUCH") return "Not enough";
  if (error.code === "DUPLICATE" || error.code === "ALREADY_SENT") return "Already done";
  if (error.status === 400) return "Check the details";
  return "That did not work";
}

/** One id for each time a form is opened. It is sent with the request so a repeated submission is refused, not saved twice. */
export function useSubmissionId() {
  const [id, setId] = useState(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random())));
  return { id, renew: () => setId(typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random())) };
}

type Message = { title: string; detail?: string };

/**
 * One write operation with consistent saving, confirmation and error handling. `success` supplies the confirmation message;
 * nothing is announced as done unless the server accepted it.
 */
export function useLogisticsAction<TInput, TResult>(options: {
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
      await Promise.all(["logistics", "overview", "notifications", "report", "trade"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      toast.push(options.success(result, input));
      options.onDone?.(result, input);
    },
    onError: (error) => {
      toast.push({ tone: "error", title: failureTitle(error), detail: error instanceof Error ? error.message : undefined });
      // A conflict means the screen is out of date; fetch the latest so the next try starts from the truth.
      if (error instanceof ApiError && error.code === "VERSION_CONFLICT") void queryClient.invalidateQueries({ queryKey: ["logistics"] });
    },
  });
}
