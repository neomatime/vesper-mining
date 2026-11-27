"use client";

/**
 * How each Trade status is shown: words plus the shared badge family, so the same state always looks the same on every screen.
 */
import { agreementStatusLabels, clientStatusLabels, deliveryStageLabels, documentStatusLabels, enquiryStageLabels, settlementStatusLabels } from "@core/lib/trade-rules";
import type { AgreementRow, ApprovalRow, ClientRow, DeliveryRow, DocumentRow, EnquiryRow, LinkRow, SettlementRow } from "../use-trade";
import { Status } from "./trade-ui";

export function ClientStatus({ client }: { client: Pick<ClientRow, "status"> }) {
  const family = ({ active: "done", onboarding: "waiting", on_hold: "attention", inactive: "unknown" } as const)[client.status];
  return <Status family={family} label={clientStatusLabels[client.status]} />;
}

export function EnquiryStage({ enquiry }: { enquiry: Pick<EnquiryRow, "stage" | "quotationPending"> }) {
  if (enquiry.quotationPending) return <Status family="waiting" label="Quote awaiting approval" />;
  const family = ({ new: "waiting", qualified: "done", quotation_sent: "active", negotiation: "active", won: "done", lost: "unknown" } as const)[enquiry.stage];
  return <Status family={family} label={enquiryStageLabels[enquiry.stage]} />;
}

export function agreementState(agreement: Pick<AgreementRow, "status" | "health">) {
  if (agreement.status === "active" && agreement.health === "at_risk") return { key: "at_risk", family: "attention" as const, label: "At risk" };
  if (agreement.status === "active" && agreement.health === "expiring") return { key: "expiring", family: "attention" as const, label: "Expiring" };
  const family = ({ active: "done", draft: "waiting", pending_approval: "waiting", suspended: "critical", completed: "unknown", terminated: "unknown" } as const)[agreement.status];
  return { key: agreement.status, family, label: agreementStatusLabels[agreement.status] };
}

export function AgreementStatus({ agreement }: { agreement: Pick<AgreementRow, "status" | "health"> }) {
  const state = agreementState(agreement);
  return <Status family={state.family} label={state.label} />;
}

export function DeliveryStatus({ delivery }: { delivery: Pick<DeliveryRow, "stage" | "timing"> }) {
  if (delivery.timing === "late") return <Status family="critical" label="Late" />;
  const family = ({ planned: "waiting", in_transit: "active", received: "attention", accepted: "done", disputed: "critical", cancelled: "unknown" } as const)[delivery.stage];
  return <Status family={delivery.timing === "at_risk" ? "attention" : family} label={delivery.timing === "at_risk" ? "At risk" : deliveryStageLabels[delivery.stage]} />;
}

export function SettlementStatus({ settlement }: { settlement: Pick<SettlementRow, "status"> }) {
  const family = ({ settled: "done", pending: "waiting", partial: "attention", overdue: "critical", disputed: "critical" } as const)[settlement.status];
  return <Status family={family} label={settlementStatusLabels[settlement.status]} />;
}

export function ApprovalStatus({ approval }: { approval: Pick<ApprovalRow, "status"> }) {
  const family = ({ pending: "waiting", approved: "done", rejected: "critical" } as const)[approval.status];
  return <Status family={family} label={{ pending: "Pending", approved: "Approved", rejected: "Rejected" }[approval.status]} />;
}

export function DocumentStatus({ document }: { document: Pick<DocumentRow, "status" | "expiresInDays"> }) {
  if (document.expiresInDays !== null && document.expiresInDays < 0) return <Status family="critical" label="Expired" />;
  const family = ({ approved: "done", final: "done", pending_review: "waiting", draft: "waiting", superseded: "unknown" } as const)[document.status];
  return <Status family={family} label={documentStatusLabels[document.status]} />;
}

export const readinessLabels = { on_track: "On track", ready: "Ready", at_risk: "At risk", awaiting_link: "Awaiting link", completed: "Completed" } as const;

export function Readiness({ link }: { link: Pick<LinkRow, "readiness"> }) {
  const family = ({ on_track: "active", ready: "done", at_risk: "attention", awaiting_link: "waiting", completed: "done" } as const)[link.readiness];
  return <Status family={family} label={readinessLabels[link.readiness]} />;
}
