"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ServiceProvider, ServiceRequest } from "@vesper/api-contracts";
import { useRouter } from "next/navigation";
import type { ProviderRequestView } from "@/lib/demo-store";
import { ApiError, demoFetch, demoSend } from "@/lib/api";
import { useToast } from "./toast-provider";

export type ProviderInput = {
  name: string;
  registration: string;
  contactName: string;
  email: string;
  phone: string;
  categories: string[];
  approvedUntil: string;
  notes: string;
};

export type RequestInput = {
  equipmentId: string;
  title: string;
  description: string;
  urgency: string;
  preferredDate: string;
  planId: string | null;
  providerIds: string[];
};

function failureTitle(error: unknown) {
  if (!(error instanceof ApiError)) return "That did not work";
  if (error.status === 403) return "That is not available to you";
  if (error.code === "VERSION_CONFLICT") return "This record changed";
  if (error.code === "HAS_HISTORY") return "It can not be removed yet";
  if (error.status === 400 || error.status === 409) return "Check the details";
  return "That did not work";
}

export function useProviders() {
  return useQuery({ queryKey: ["providers"], queryFn: () => demoFetch<ServiceProvider[]>("/providers") });
}

export function useServiceRequests(equipmentId?: string) {
  return useQuery({
    queryKey: ["service-requests", equipmentId ?? "all"],
    queryFn: () => demoFetch<ServiceRequest[]>(`/service-requests${equipmentId ? `?equipmentId=${encodeURIComponent(equipmentId)}` : ""}`),
    refetchOnWindowFocus: true,
  });
}

export function useServiceRequest(id: string) {
  return useQuery({ queryKey: ["service-request", id], queryFn: () => demoFetch<ServiceRequest>(`/service-requests/${id}`), refetchOnWindowFocus: true });
}

function useRefresh() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all(["providers", "service-requests", "service-request", "equipment", "equipment-list", "organisation", "overview", "workspace"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
  };
}

export function useProviderMutations() {
  const toast = useToast();
  const refresh = useRefresh();
  const onError = (error: unknown) => toast.push({ tone: "error", title: failureTitle(error), detail: error instanceof Error ? error.message : undefined });

  const create = useMutation({
    mutationFn: (input: ProviderInput) => demoSend<ServiceProvider>("/providers", "POST", input),
    onSuccess: async (provider) => {
      await refresh();
      toast.push({ title: "Service provider added", detail: `${provider.name} can now be asked for quotes.` });
    },
    onError,
  });
  const update = useMutation({
    mutationFn: ({ id, ...input }: ProviderInput & { id: string; version: number }) => demoSend<ServiceProvider>(`/providers/${id}`, "PATCH", input),
    onSuccess: async () => {
      await refresh();
      toast.push({ title: "Changes saved" });
    },
    onError,
  });
  const setActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => demoSend<ServiceProvider>(`/providers/${id}/active`, "POST", { active }),
    onSuccess: async (provider) => {
      await refresh();
      toast.push({ title: provider.active ? "Provider reactivated" : "Provider deactivated", detail: provider.active ? undefined : "They are no longer offered for new requests." });
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => demoSend<{ id: string }>(`/providers/${id}`, "DELETE"),
    onSuccess: async () => {
      await refresh();
      toast.push({ title: "Service provider deleted" });
    },
    onError,
  });
  return { create, update, setActive, remove };
}

export function useCreateServiceRequest(equipmentId: string) {
  const router = useRouter();
  const toast = useToast();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: RequestInput) => demoSend<ServiceRequest>("/service-requests", "POST", input),
    onSuccess: async (request) => {
      await refresh();
      toast.push({ title: "Request recorded", detail: `${request.number} is awaiting quotes from ${request.invites.length} ${request.invites.length === 1 ? "provider" : "providers"}.` });
      router.push(`/equipment/${equipmentId}/service/${request.id}`);
    },
    onError: (error) => toast.push({ tone: "error", title: failureTitle(error), detail: error instanceof Error ? error.message : undefined }),
  });
}

export function useRequestMutations(request: ServiceRequest) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const refresh = useRefresh();
  const base = `/service-requests/${request.id}`;
  const version = request.version;
  const onError = (error: unknown) => {
    toast.push({ tone: "error", title: failureTitle(error), detail: error instanceof Error ? error.message : undefined });
    if (error instanceof ApiError && error.code === "VERSION_CONFLICT") void queryClient.invalidateQueries({ queryKey: ["service-request", request.id] });
  };
  const make = <TInput,>(path: string, title: string, detail?: string) => ({
    mutationFn: (input: TInput) => demoSend<ServiceRequest>(`${base}${path}`, "POST", { ...(input as object), version }),
    onSuccess: async () => {
      await refresh();
      toast.push({ title, detail });
    },
    onError,
  });

  const award = useMutation({
    mutationFn: (inviteId: string) => demoSend<ServiceRequest>(`${base}/invites/${inviteId}/award`, "POST", { version }),
    onSuccess: async () => {
      await refresh();
      toast.push({ title: "Provider chosen", detail: "The decision is recorded. Nothing is ordered or paid from VESPER." });
    },
    onError,
  });
  const schedule = useMutation(make<{ date: string }>("/schedule", "Work booked"));
  const complete = useMutation(make<{ summary: string; hours: string; performedAt: string; workOrderRef: string }>("/complete", "Work completed", "It is logged on the equipment and any linked maintenance plan is reset."));
  const cancel = useMutation(make<{ reason: string }>("/cancel", "Request cancelled"));
  return { award, schedule, complete, cancel };
}

/** What a provider sees on their reply page. */
export function useProviderRequest(token: string) {
  return useQuery({ queryKey: ["provider-response", token], queryFn: () => demoFetch<ProviderRequestView>(`/provider-response/${token}`) });
}

export type ProviderReply =
  | { action: "quote"; amount: string; reference: string; availableFrom: string; validUntil: string; notes: string }
  | { action: "decline"; reason: string };

export function useProviderReply(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reply: ProviderReply) => demoSend<ProviderRequestView>(`/provider-response/${token}`, "POST", reply),
    onSuccess: (view) => {
      queryClient.setQueryData(["provider-response", token], view);
    },
  });
}
