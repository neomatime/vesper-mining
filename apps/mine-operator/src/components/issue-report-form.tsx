"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CheckCircle2, CloudOff, Send } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { useShellData } from "./shell-data";
import { z } from "zod";
import type { OperationalIssue } from "@vesper/api-contracts";
import { demoSend } from "@/lib/api";
import { causeGroups, secondariesOf } from "@vesper/api-contracts";
import { defectOperabilities, defectOperabilityLabels } from "@/lib/issue-rules";
import { useDemoContext } from "@/stores/demo-context";
import { PageHeader } from "./page-header";
import { useToast } from "./toast-provider";
import { Select } from "./select";

const reportSchema = z.object({
  title: z.string().min(4, "Use at least four characters."),
  description: z.string().min(12, "Describe what was observed in a little more detail."),
  equipmentId: z.string().optional(),
  areaId: z.string().optional(),
  symptom: z.string().optional(),
  secondary: z.string().optional(),
  operability: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]),
}).superRefine((value, context) => {
  if (value.equipmentId && !value.symptom) context.addIssue({ code: "custom", path: ["symptom"], message: "Choose the primary cause that was noticed." });
  if (value.symptom && value.secondary && !secondariesOf(value.symptom).some((item) => item.id === value.secondary)) context.addIssue({ code: "custom", path: ["secondary"], message: "Choose a secondary cause from the list for this primary cause." });
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
      symptom: "",
      secondary: "",
      operability: "",
      priority: "medium",
    },
  });
  const chosenEquipment = useWatch({ control: form.control, name: "equipmentId" });
  const chosenPrimary = useWatch({ control: form.control, name: "symptom" });
  const secondaryOptions = chosenPrimary ? secondariesOf(chosenPrimary) : [];
  const mutation = useMutation({
    mutationFn: (input: ReportInput) =>
      demoSend<OperationalIssue | PendingResult>("/issues", "POST", {
        title: input.title,
        description: input.description,
        equipmentId: input.equipmentId,
        areaId: input.areaId,
        priority: input.priority,
        defect: input.equipmentId && input.symptom ? { symptom: input.symptom, secondary: input.secondary || null, operability: input.operability || "unsure" } : undefined,
        pendingSync: connectivity === "offline",
      }),
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
          {chosenEquipment ? (
            <>
              <label className="form-field">
                <span>Primary cause noticed</span>
                <Select
                  aria-invalid={Boolean(form.formState.errors.symptom)}
                  {...form.register("symptom", { onChange: () => form.setValue("secondary", "") })}
                >
                  <option value="">Choose the main cause</option>
                  {causeGroups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
                </Select>
                {form.formState.errors.symptom ? <small className="field-error">{form.formState.errors.symptom.message}</small> : null}
              </label>
              <label className="form-field">
                <span>Secondary cause noticed (optional)</span>
                <Select key={chosenPrimary || "none"} aria-invalid={Boolean(form.formState.errors.secondary)} disabled={!chosenPrimary || secondaryOptions.length === 0} {...form.register("secondary")}>
                  <option value="">{!chosenPrimary ? "Choose the primary cause first" : secondaryOptions.length === 0 ? "No secondary causes for this one" : "None"}</option>
                  {secondaryOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </Select>
                {form.formState.errors.secondary ? <small className="field-error">{form.formState.errors.secondary.message}</small> : <small className="field-hint">Only the causes that belong to the primary cause are listed.</small>}
              </label>
              <label className="form-field">
                <span>Is it still working? (as you see it)</span>
                <Select {...form.register("operability")}>
                  <option value="">Not sure</option>
                  {defectOperabilities.map((value) => <option key={value} value={value}>{defectOperabilityLabels[value]}</option>)}
                </Select>
                <small className="field-hint">This helps the planner and supervisor decide. It does not restrict or release the equipment.</small>
              </label>
            </>
          ) : null}
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
