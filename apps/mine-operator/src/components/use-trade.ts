"use client";

/**
 * Reads and writes the Trade workspace. One query (`trade`) feeds every Trade screen; prices and confidential documents are only in it
 * for roles allowed to see them. Every change refreshes Trade, notifications and the Overview counts.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { demoFetch, demoSend } from "@core/lib/api";
import type { TradeView } from "@core/lib/trade-store";
import { useDemoContext } from "@core/stores/demo-context";
import { useToast } from "@core/components/toast-provider";
import { failureTitle } from "./use-logistics";

export type { TradeView };
export type ClientRow = TradeView["clients"][number];
export type EnquiryRow = TradeView["enquiries"][number];
export type AgreementRow = TradeView["agreements"][number];
export type CommitmentRow = AgreementRow["commitments"][number];
export type DeliveryRow = TradeView["deliveries"][number];
export type SettlementRow = TradeView["settlements"][number];
export type ApprovalRow = TradeView["approvals"][number];
export type DocumentRow = TradeView["documents"][number];
export type LinkRow = TradeView["links"][number];

export function useTrade() {
  const { context } = useDemoContext();
  return useQuery({ queryKey: ["trade", context.siteId, context.role, context.persona], queryFn: () => demoFetch<TradeView>("/trade"), staleTime: 0 });
}

type Message = { title: string; detail?: string };

/** One Trade write with consistent saving, confirmation and error handling. Nothing is announced as done unless the server accepted it. */
export function useTradeAction<TInput, TResult = unknown>(options: {
  path: string | ((input: TInput) => string);
  method?: "POST" | "PATCH" | "DELETE";
  success: (result: TResult, input: TInput) => Message;
  onDone?: (result: TResult, input: TInput) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (input: TInput) => demoSend<TResult>(typeof options.path === "function" ? options.path(input) : options.path, options.method ?? "POST", options.method === "DELETE" ? undefined : input),
    onSuccess: async (result, input) => {
      await Promise.all(["trade", "notifications"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      toast.push(options.success(result, input));
      options.onDone?.(result, input);
    },
    onError: (error) => toast.push({ tone: "error", title: failureTitle(error), detail: error instanceof Error ? error.message : undefined }),
  });
}
