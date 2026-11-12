"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Company, Member, SiteDetails } from "@vesper/api-contracts";
import { ApiError, demoFetch, demoSend } from "@/lib/api";
import type { OrganisationView } from "@/lib/demo-store";
import { useDemoContext } from "@/stores/demo-context";
import { useToast } from "./toast-provider";

export type MemberInput = { name: string; email: string; role: string; phone: string; employeeNumber: string };

function failureTitle(error: unknown) {
  if (!(error instanceof ApiError)) return "That did not work";
  if (error.status === 403) return "That is not available to you";
  if (error.code === "VERSION_CONFLICT") return "This record changed";
  if (error.code === "LAST_MANAGER" || error.code === "OWN_ACCOUNT") return "That would lock you out";
  if (error.status === 400 || error.status === 409) return "Check the details";
  return "That did not work";
}

export function useOrganisation() {
  const { context } = useDemoContext();
  return useQuery({
    queryKey: ["organisation", context.siteId],
    queryFn: () => demoFetch<OrganisationView>("/organisation"),
  });
}

export function useOrganisationMutations() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const setContext = useDemoContext((state) => state.setContext);

  const refresh = async () => {
    await Promise.all(["organisation", "overview"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
  };

  const onError = (error: unknown) => {
    toast.push({ tone: "error", title: failureTitle(error), detail: error instanceof Error ? error.message : undefined });
    if (error instanceof ApiError && error.code === "VERSION_CONFLICT") void refresh();
  };

  const addMember = useMutation({
    mutationFn: (input: MemberInput) => demoSend<{ member: Member; temporaryPassword: string }>("/members", "POST", input),
    onSuccess: async ({ member }) => {
      await refresh();
      toast.push({ title: "Employee added", detail: `${member.name} is set up as ${member.role}.` });
    },
    onError,
  });

  const updateMember = useMutation({
    mutationFn: ({ id, ...input }: { id: string; version: number } & Partial<MemberInput>) => demoSend<Member>(`/members/${id}`, "PATCH", input),
    onSuccess: async (member) => {
      await refresh();
      toast.push({ title: "Changes saved", detail: `Details for ${member.name} were updated.` });
    },
    onError,
  });

  const setAccess = useMutation({
    mutationFn: ({ id, access }: { id: string; access: "on" | "off" }) => demoSend<Member>(`/members/${id}/access`, "POST", { access }),
    onSuccess: async (member) => {
      await refresh();
      toast.push(member.status === "deactivated" ? { title: "Access turned off", detail: `${member.name} can no longer sign in. Their records are kept.` } : { title: "Access restored", detail: `${member.name} can sign in again.` });
    },
    onError,
  });

  const resetPassword = useMutation({
    mutationFn: (id: string) => demoSend<{ member: Member; temporaryPassword: string }>(`/members/${id}/password-reset`, "POST"),
    onSuccess: async () => {
      await refresh();
    },
    onError,
  });

  const deleteMember = useMutation({
    mutationFn: (id: string) => demoSend<{ id: string }>(`/members/${id}`, "DELETE"),
    onSuccess: async () => {
      await refresh();
      toast.push({ title: "Employee deleted" });
    },
    onError,
  });

  const saveCompany = useMutation({
    mutationFn: (input: Omit<Company, "version"> & { version: number }) => demoSend<Company>("/organisation/company", "PATCH", input),
    onSuccess: async () => {
      await refresh();
      toast.push({ title: "Company details saved" });
    },
    onError,
  });

  const saveSite = useMutation({
    mutationFn: (input: Omit<SiteDetails, "version"> & { version: number }) => demoSend<SiteDetails>("/organisation/site", "PATCH", input),
    onSuccess: async (site) => {
      setContext({ siteName: site.name });
      await refresh();
      toast.push({ title: "Site details saved" });
    },
    onError,
  });

  const updateOwn = useMutation({
    mutationFn: (input: { phone: string }) => demoSend<Member>("/me", "PATCH", input),
    onSuccess: async () => {
      await refresh();
      toast.push({ title: "Your details were saved" });
    },
    onError,
  });

  const changeOwnPassword = useMutation({
    mutationFn: (input: { email: string; current: string; next: string }) => demoSend<{ changed: true }>("/session/change-password", "POST", input),
    onSuccess: () => toast.push({ title: "Password changed", detail: "Use the new password next time you sign in." }),
    onError,
  });

  return { updateOwn, changeOwnPassword, addMember, updateMember, setAccess, resetPassword, deleteMember, saveCompany, saveSite };
}
