import { http, HttpResponse } from "msw";
import type { OperationalIssue } from "@vesper/api-contracts";
import { DEMO_NOW, workspaceContent } from "@/lib/demo-data";
import { demoDomain } from "@/lib/demo-store";

const API = "/_demo/api/v1";

function envelope<T>(data: T, status = 200) {
  return HttpResponse.json(
    { data, meta: { demo: true, generatedAt: DEMO_NOW } },
    { status },
  );
}

export const handlers = [
  http.get(`${API}/bootstrap`, () => envelope(demoDomain.get().context)),

  http.get(`${API}/overview`, () => {
    const state = demoDomain.get();
    return envelope({
      context: state.context,
      priorityIssue: state.issues[0],
      issues: state.issues,
      areas: state.areas,
      equipment: state.equipment,
      readiness: state.readiness,
      shifts: state.shifts,
    });
  }),

  http.get(`${API}/issues`, () => envelope(demoDomain.get().issues)),
  http.get(`${API}/issues/:id`, ({ params }) => {
    const issue = demoDomain.get().issues.find((item) => item.id === params.id);
    return issue ? envelope(issue) : envelope({ code: "NOT_FOUND" }, 404);
  }),
  http.post(`${API}/issues`, async ({ request }) => {
    const input = (await request.json()) as {
      title?: string;
      description?: string;
      equipmentId?: string | null;
      areaId?: string | null;
      pendingSync?: boolean;
    };

    if (!input.title?.trim() || !input.description?.trim()) {
      return envelope(
        { code: "VALIDATION_ERROR", message: "Title and description are required." },
        400,
      );
    }

    if (input.pendingSync) {
      return envelope({
        id: "local-pending-001",
        state: "pending_sync",
        message: "Saved in this demonstration. This report has not been received centrally.",
      });
    }

    const issue: OperationalIssue = {
      id: `issue-demo-${demoDomain.get().issues.length + 1}`,
      organisationId: "org-himark-demo",
      siteId: "site-riverside",
      issueNumber: `RIV-2025-${String(42 + demoDomain.get().issues.length).padStart(3, "0")}`,
      title: input.title,
      description: input.description,
      equipmentId: input.equipmentId ?? null,
      areaId: input.areaId ?? null,
      priority: "medium",
      workflowState: "reported",
      quality: "reported",
      operationalStatus: "at_risk",
      owner: null,
      reportedAt: DEMO_NOW,
      updatedAt: DEMO_NOW,
      source: {
        label: "Simulated VESPER issue report",
        observedAt: DEMO_NOW,
        quality: "reported",
      },
      actions: [],
    };
    demoDomain.addIssue(issue);
    return envelope(issue, 201);
  }),
  http.patch(`${API}/issues/:id`, async ({ params, request }) => {
    const update = (await request.json()) as Partial<OperationalIssue>;
    const issue = demoDomain.updateIssue(String(params.id), {
      ...update,
      updatedAt: DEMO_NOW,
    });
    return issue ? envelope(issue) : envelope({ code: "NOT_FOUND" }, 404);
  }),

  http.get(`${API}/areas`, () => envelope(demoDomain.get().areas)),
  http.get(`${API}/equipment`, () => envelope(demoDomain.get().equipment)),
  http.get(`${API}/equipment/:id`, ({ params }) => {
    const equipment = demoDomain.get().equipment.find((item) => item.id === params.id);
    return equipment ? envelope(equipment) : envelope({ code: "NOT_FOUND" }, 404);
  }),
  http.get(`${API}/readiness`, () => envelope(demoDomain.get().readiness)),
  http.get(`${API}/readiness/:id`, ({ params }) => {
    const activity = demoDomain.get().readiness.find((item) => item.id === params.id);
    return activity ? envelope(activity) : envelope({ code: "NOT_FOUND" }, 404);
  }),
  http.post(`${API}/readiness/:id/reviews`, ({ params }) => {
    const activity = demoDomain.reviewReadiness(String(params.id));
    return activity ? envelope(activity) : envelope({ code: "NOT_FOUND" }, 404);
  }),

  http.get(`${API}/shifts`, () => envelope(demoDomain.get().shifts)),
  http.get(`${API}/shifts/:id`, ({ params }) => {
    const shift = demoDomain.get().shifts.find((item) => item.id === params.id);
    return shift
      ? envelope({ ...shift, issues: demoDomain.get().issues, handoverAcknowledged: demoDomain.get().handoverAcknowledged })
      : envelope({ code: "NOT_FOUND" }, 404);
  }),
  http.post(`${API}/shifts/:id/acknowledgement`, () =>
    envelope(demoDomain.acknowledgeHandover()),
  ),

  http.get(`${API}/notifications`, () => envelope(demoDomain.get().notifications)),
  http.patch(`${API}/notifications/:id`, ({ params }) => {
    const notification = demoDomain.readNotification(String(params.id));
    return notification ? envelope(notification) : envelope({ code: "NOT_FOUND" }, 404);
  }),

  http.get(`${API}/reports/:key`, ({ params }) => {
    const state = demoDomain.get();
    return envelope({
      key: String(params.key),
      title: String(params.key)
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" "),
      period: "18–24 Apr 2025 · simulated fixture",
      quality: "reported",
      source: "Derived from deterministic VESPER demo records",
      series: [
        { label: "18 Apr", plan: 126, actual: 111 },
        { label: "19 Apr", plan: 132, actual: 118 },
        { label: "20 Apr", plan: 128, actual: 105 },
        { label: "21 Apr", plan: 144, actual: 137 },
        { label: "22 Apr", plan: 149, actual: 147 },
        { label: "23 Apr", plan: 151, actual: 128 },
        { label: "24 Apr", plan: 162, actual: 156 },
      ],
      issues: state.issues,
    });
  }),

  http.get(`${API}/workspaces/:key`, ({ params }) => {
    const key = String(params.key) as keyof typeof workspaceContent;
    const content = workspaceContent[key];
    if (!content) return envelope({ code: "NOT_FOUND" }, 404);
    const state = demoDomain.get();
    const records =
      key === "exceptions"
        ? state.issues
        : key === "equipment"
          ? state.equipment
          : key === "resources"
            ? state.readiness
            : key === "shifts"
              ? state.shifts
              : key === "admin"
                ? [
                    { id: "cfg-site", title: "Site configuration", detail: "Riverside Mine · display-only fictional site" },
                    { id: "cfg-users", title: "Users & roles", detail: "9 fictional demo personas" },
                    { id: "cfg-entitlements", title: "Subscription", detail: "Operations — Single Site" },
                    { id: "cfg-integrations", title: "Integration boundaries", detail: "No live systems connected" },
                  ]
                : [
                    { id: "rep-production", title: "Production vs plan", detail: "Fictional shift comparison" },
                    { id: "rep-exceptions", title: "Operational exceptions", detail: "Evidence-linked issue summary" },
                    { id: "rep-downtime", title: "Equipment delay stages", detail: "Reported events, not financial loss" },
                    { id: "rep-readiness", title: "Resource readiness", detail: "Upcoming work and uncertain inputs" },
                  ];
    return envelope({ ...content, records });
  }),

  http.post(`${API}/scenario/reset`, () => envelope(demoDomain.reset())),
];
