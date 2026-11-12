"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CheckCircle2, CloudOff, Send } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { useShellData } from "./shell-data";
import { z } from "zod";
import type { OperationalIssue } from "@vesper/api-contracts";
import { demoSend } from "@/lib/api";
import { useDemoContext } from "@/stores/demo-context";
import { PageHeader } from "./page-header";
import { useToast } from "./toast-provider";
import { Select } from "./select";

const reportSchema = z.object({
  title: z.string().min(4, "Use at least four characters."),
  description: z.string().min(12, "Describe what was observed in a little more detail."),
  equipmentId: z.string().optional(),
  areaId: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]),
});

type ReportInput = z.infer<typeof reportSchema>;

type PendingResult = { id: string; state: "pending_sync"; message: string };

export function IssueReportForm({ mobile = false }: { mobile?: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { connectivity, setConnectivity } = useDemoContext();
  const { data: shell } = useShellData();
  const requestedEquipment = useSearchParams().get("equipmentId") ?? "";
  const equipmentOptions = (shell?.equipment ?? []).filter((item) => !item.retiredAt);
  const form = useForm<ReportInput>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      title: "",
      description: "",
      equipmentId: requestedEquipment,
      areaId: "",
      priority: "medium",
    },
  });
  const mutation = useMutation({
    mutationFn: (input: ReportInput) =>
      demoSend<OperationalIssue | PendingResult>("/issues", "POST", { ...input, pendingSync: connectivity === "offline" }),
    onSuccess: async (result) => {
      if ("state" in result) return;
      await queryClient.invalidateQueries({ queryKey: ["workspace", "exceptions"] });
      await queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.push({ title: "Issue reported", detail: `${result.issueNumber} is in the review queue. It is a report, not verification or permission to work.` });
      router.push(`/exceptions/${result.id}`);
    },
  });

  if (mutation.data && "state" in mutation.data && mutation.data.state === "pending_sync") {
    return (
      <section className="success-state success-state--pending" aria-live="polite">
        <CloudOff />
        <span className="eyebrow">Pending Synchronisation</span>
        <h1>Saved on this device</h1>
        <p>{mutation.data.message}</p>
        <div className="button-row">
          <button className="button button--primary" onClick={() => setConnectivity("online")}>Reconnect</button>
          <Link className="button button--quiet" href="/mobile/my-shift">Return to My Shift</Link>
        </div>
      </section>
    );
  }

  return (
    <div className={mobile ? "mobile-task-page" : "workspace-page"}>
      <Link href={mobile ? "/mobile/my-shift" : "/exceptions"} className="back-link"><ArrowLeft /> Back</Link>
      <PageHeader
        eyebrow={mobile ? "Field report" : "Work & Exceptions"}
        title="Report an operational issue"
        description="Record one clear observation. A report is not verification, emergency dispatch or permission to work."
        icon={AlertTriangle}
      />

      <form className="card form-card" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <div className="form-context">
          <div><span>Site</span><strong>Riverside Mine</strong><small>Open pit</small></div>
          <div><span>Shift</span><strong>Shift A</strong><small>06:00–14:00</small></div>
          <div><span>Connection</span><strong>{connectivity === "online" ? "Online" : "Offline"}</strong><small>{connectivity === "online" ? "Connected" : "No central receipt will be claimed"}</small></div>
        </div>
        <div className="form-grid">
          <label className="form-field form-field--wide">
            <span>Issue title</span>
            <input placeholder="What did you observe?" {...form.register("title")} aria-invalid={Boolean(form.formState.errors.title)} />
            {form.formState.errors.title ? <small className="field-error">{form.formState.errors.title.message}</small> : null}
          </label>
          <label className="form-field">
            <span>Equipment</span>
            <Select
              {...form.register("equipmentId", {
                onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
                  const chosen = equipmentOptions.find((item) => item.id === event.target.value);
                  if (chosen?.areaId && !form.getValues("areaId")) form.setValue("areaId", chosen.areaId);
                },
              })}
            >
              <option value="">No equipment selected</option>
              {equipmentOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </label>
          <label className="form-field">
            <span>Operating area</span>
            <Select {...form.register("areaId")}>
              <option value="">No area selected</option>
              {(shell?.areas ?? []).map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
            </Select>
          </label>
          <label className="form-field">
            <span>Priority</span>
            <Select {...form.register("priority")}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </Select>
          </label>
          <label className="form-field form-field--wide">
            <span>Observed condition</span>
            <textarea rows={5} placeholder="Describe the condition and any immediate operational context." {...form.register("description")} aria-invalid={Boolean(form.formState.errors.description)} />
            {form.formState.errors.description ? <small className="field-error">{form.formState.errors.description.message}</small> : null}
          </label>
        </div>
        {mutation.isError ? <div className="inline-error" role="alert">{mutation.error.message} Your entered information has been preserved.</div> : null}
        <div className="form-footer">
          <button type="button" className="connection-toggle" onClick={() => setConnectivity(connectivity === "online" ? "offline" : "online")}>
            {connectivity === "online" ? <CheckCircle2 /> : <CloudOff />}
            {connectivity === "online" ? "Work offline" : "Back online"}
          </button>
          <button className="button button--primary" disabled={mutation.isPending}>
            <Send /> {mutation.isPending ? "Recording issue…" : connectivity === "online" ? "Record issue" : "Save pending report"}
          </button>
        </div>
      </form>
    </div>
  );
}
