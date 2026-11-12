"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { IssueAttachment, IssueWorkflowState, OperationalIssue } from "@vesper/api-contracts";
import { ApiError, demoSend } from "@/lib/api";
import { stateLabels } from "@/lib/issue-rules";
import { useToast } from "./toast-provider";

export type ActionInput = { title: string; owner: string; team: string; dueAt: string | null };
export type DependencyInput = {
  reason: string;
  kind: string;
  owner: string;
  blockedActionId: string | null;
  reviewBy: string;
};
export type IssueDetailsInput = {
  title: string;
  description: string;
  priority: string;
  owner: string | null;
  equipmentId: string | null;
  areaId: string | null;
};

function failureTitle(error: unknown) {
  if (!(error instanceof ApiError)) return "That did not work";
  if (error.status === 403) return "That step is not available to you";
  if (error.code === "VERSION_CONFLICT") return "This issue changed";
  if (error.status === 400) return "Check the details";
  return "That did not work";
}

/** Every write to one issue, with consistent refresh, confirmation and error handling. */
export function useIssueMutations(issue: OperationalIssue) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const id = issue.id;
  const base = `/issues/${id}`;
  const version = issue.version;

  const refresh = async (data: OperationalIssue) => {
    queryClient.setQueryData(["issue", id], data);
    await Promise.all(
      ["overview", "workspace", "shift", "notifications", "report"].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
  };

  const onError = (error: unknown) => {
    toast.push({ tone: "error", title: failureTitle(error), detail: error instanceof Error ? error.message : undefined });
    if (error instanceof ApiError && error.code === "VERSION_CONFLICT") {
      void queryClient.invalidateQueries({ queryKey: ["issue", id] });
    }
  };

  const transition = useMutation({
    mutationFn: (input: { to: IssueWorkflowState; note?: string; reference?: string }) =>
      demoSend<OperationalIssue>(`${base}/transition`, "POST", { ...input, version }),
    onSuccess: async (data, input) => {
      await refresh(data);
      toast.push({ title: `${stateLabels[input.to]} recorded`, detail: `${data.issueNumber} is now ${stateLabels[data.workflowState].toLowerCase()}.` });
    },
    onError,
  });

  const update = useMutation({
    mutationFn: (input: Partial<IssueDetailsInput>) => demoSend<OperationalIssue>(base, "PATCH", { ...input, version }),
    onSuccess: async (data) => {
      await refresh(data);
      toast.push({ title: "Changes saved", detail: `${data.issueNumber} was updated and the change is in its history.` });
    },
    onError,
  });

  const addAction = useMutation({
    mutationFn: (input: ActionInput) => demoSend<OperationalIssue>(`${base}/actions`, "POST", { ...input, version }),
    onSuccess: async (data) => {
      await refresh(data);
      toast.push({ title: "Action added" });
    },
    onError,
  });

  const updateAction = useMutation({
    mutationFn: ({ actionId, ...input }: { actionId: string } & Partial<ActionInput> & { state?: string }) =>
      demoSend<OperationalIssue>(`${base}/actions/${actionId}`, "PATCH", { ...input, version }),
    onSuccess: async (data, input) => {
      await refresh(data);
      if (!input.state) toast.push({ title: "Action updated" });
    },
    onError,
  });

  const restoreAction = useMutation({
    mutationFn: (actionId: string) => demoSend<OperationalIssue>(`${base}/actions/${actionId}/restore`, "POST"),
    onSuccess: async (data) => {
      await refresh(data);
      toast.push({ title: "Action restored" });
    },
    onError,
  });

  const removeAction = useMutation({
    mutationFn: ({ actionId }: { actionId: string; title: string }) =>
      demoSend<OperationalIssue>(`${base}/actions/${actionId}`, "DELETE", { version }),
    onSuccess: async (data, input) => {
      await refresh(data);
      toast.push({
        title: "Action removed",
        detail: input.title,
        action: { label: "Undo", onClick: () => restoreAction.mutate(input.actionId) },
      });
    },
    onError,
  });

  const addDependency = useMutation({
    mutationFn: (input: DependencyInput) => demoSend<OperationalIssue>(`${base}/dependencies`, "POST", { ...input, version }),
    onSuccess: async (data) => {
      await refresh(data);
      toast.push({ title: "Dependency recorded", detail: "It stays open across shifts until it is resolved or bypassed." });
    },
    onError,
  });

  const updateDependency = useMutation({
    mutationFn: ({ dependencyId, ...input }: { dependencyId: string; state: "open" | "resolved" | "bypassed"; resolutionNote?: string }) =>
      demoSend<OperationalIssue>(`${base}/dependencies/${dependencyId}`, "PATCH", { ...input, version }),
    onSuccess: async (data, input) => {
      await refresh(data);
      toast.push({ title: input.state === "open" ? "Dependency reopened" : `Dependency ${input.state}` });
    },
    onError,
  });

  const addComment = useMutation({
    mutationFn: (input: { body: string; attachments: Omit<IssueAttachment, "id">[] }) =>
      demoSend<OperationalIssue>(`${base}/comments`, "POST", input),
    onSuccess: async (data) => {
      await refresh(data);
      toast.push({ title: "Note added" });
    },
    onError,
  });

  return { transition, update, addAction, updateAction, removeAction, restoreAction, addDependency, updateDependency, addComment };
}
