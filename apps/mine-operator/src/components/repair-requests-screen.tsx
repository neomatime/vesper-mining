"use client";

/**
 * Repair Requests: every repair and service request with an external provider, across equipment and infrastructure. It reads the same
 * service requests as each asset's page, so the two always agree. Opened from the Repair Requests band on Assets.
 */
import type { ServiceRequest } from "@vesper/api-contracts";
import { ArrowLeft, Wrench } from "lucide-react";
import Link from "next/link";
import { formatDemoDateTime } from "@core/lib/demo-clock";
import { requestStatusLabels, urgencyLabels } from "@core/lib/service-rules";
import { ErrorState, LoadingState } from "@core/components/query-state";
import { useShellData } from "@core/components/shell-data";
import { StatusBadge } from "@core/components/status-badge";
import { useServiceRequests } from "./use-service";
import { RegisterView, type Register } from "./workspace-screen";

const tone = { open: "pending", awarded: "in_progress", scheduled: "in_progress", completed: "complete", cancelled: "unknown" } as const;

export function RepairRequestsScreen() {
  const requests = useServiceRequests();
  const { data: shell } = useShellData();
  if (requests.isPending) return <LoadingState />;
  if (requests.isError && !requests.data) return <ErrorState message={requests.error.message} onRetry={() => requests.refetch()} retrying={requests.isFetching} />;
  const assetOf = (request: ServiceRequest) => shell?.equipment.find((item) => item.id === request.equipmentId);
  const providerOf = (request: ServiceRequest) => {
    const chosen = request.invites.find((invite) => invite.id === request.awardedInviteId);
    return chosen ? chosen.providerName : `${request.invites.length} ${request.invites.length === 1 ? "provider" : "providers"} asked`;
  };
  const rows = [...requests.data].sort((a, b) => b.number.localeCompare(a.number));
  const count = (...states: ServiceRequest["status"][]) => rows.filter((item) => states.includes(item.status)).length;

  const register: Register<ServiceRequest> = {
    icon: Wrench,
    tiles: [
      { label: "Open", value: count("open"), hint: "Awaiting quotes", attention: count("open") > 0 },
      { label: "In progress", value: count("awarded", "scheduled"), hint: "Provider chosen or scheduled" },
      { label: "Completed", value: count("completed"), hint: "Finished repairs" },
      { label: "Cancelled", value: count("cancelled"), hint: "Kept with their history" },
    ],
    columns: [
      { key: "request", label: "Request", render: (item) => <span className="cell-main"><strong>{item.title}</strong><small>{item.number}</small></span> },
      { key: "asset", label: "Asset", render: (item) => { const asset = assetOf(item); return asset ? <span className="cell-main"><strong>{asset.name}</strong><small>{asset.code}</small></span> : "—"; } },
      { key: "provider", label: "Provider", render: (item) => providerOf(item) },
      { key: "urgency", label: "Priority", render: (item) => urgencyLabels[item.urgency] },
      { key: "required", label: "Required by", render: (item) => (item.preferredDate ? formatDemoDateTime(item.preferredDate).split(" · ")[0] : <span className="muted">Not set</span>) },
      { key: "status", label: "Status", render: (item) => <StatusBadge value={tone[item.status]} label={requestStatusLabels[item.status]} /> },
    ],
    filters: [
      { key: "all", label: "All", test: () => true },
      { key: "open", label: "Open", test: (item) => item.status === "open" },
      { key: "progress", label: "In progress", test: (item) => item.status === "awarded" || item.status === "scheduled" },
      { key: "completed", label: "Completed", test: (item) => item.status === "completed" },
    ],
    href: (item) => `/equipment/${item.equipmentId}/service/${item.id}`,
    text: (item) => [item.title, item.number, assetOf(item)?.code, assetOf(item)?.name, providerOf(item), item.status].join(" "),
    rows,
    emptyTitle: "No repair requests yet",
    emptyBody: "Request a repair from an asset's actions menu. Approved providers that service it are offered.",
    footnote: "A request is not a booking: the provider replies with their own quote, and the work is chosen and scheduled here.",
  };
  return (
    <RegisterView
      initialFilter={null}
      header={{ eyebrow: "Equipment & Maintenance", title: "Repair Requests", description: "Repairs and service work with external providers." }}
      register={register}
      tabs={<nav className="crumbs" aria-label="Breadcrumb"><Link href="/equipment" aria-label="Back to Assets"><ArrowLeft aria-hidden="true" /></Link><Link href="/equipment">Assets</Link><span aria-hidden="true">/</span><span aria-current="page">Repair Requests</span></nav>}
    />
  );
}
