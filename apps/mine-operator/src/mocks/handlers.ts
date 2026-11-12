import { http, HttpResponse } from "msw";
import { ACTOR_HEADER } from "@/lib/api";
import { workspaceContent } from "@/lib/demo-data";
import { DemoError, demoDomain } from "@/lib/demo-store";
import type { Actor } from "@/lib/issue-rules";
import { buildReport, reportCatalogue } from "@/lib/reports";

const API = "/_demo/api/v1";

function envelope<T>(data: T, status = 200) {
  return HttpResponse.json(
    { data, meta: { demo: true, generatedAt: demoDomain.now() } },
    { status },
  );
}

function actorOf(request: Request): Actor {
  const header = request.headers.get(ACTOR_HEADER);
  if (header) {
    try {
      const parsed = JSON.parse(decodeURIComponent(header)) as Partial<Actor>;
      if (parsed.name && parsed.role) return { name: parsed.name, role: parsed.role };
    } catch {
      // Fall through to the default persona.
    }
  }
  return { name: "John Dlamini", role: "Mine Manager" };
}

async function bodyOf<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

/** Runs a domain operation and turns its failures into the demo error envelope. */
function run<T>(operation: () => T, status = 200) {
  try {
    const result = operation();
    demoDomain.save();
    return envelope(result, status);
  } catch (error) {
    if (error instanceof DemoError) demoDomain.save();
    if (error instanceof DemoError) {
      return envelope({ code: error.code, message: error.message }, error.status);
    }
    throw error;
  }
}

type Params = Record<string, string | readonly string[] | undefined>;
const param = (params: Params, key: string) => String(params[key]);

export const handlers = [
  http.get(`${API}/bootstrap`, () => envelope(demoDomain.get().context)),

  http.get(`${API}/overview`, () => {
    const state = demoDomain.get();
    const issues = demoDomain.listIssues();
    const priority = issues.find((issue) => issue.id === "issue-riv-001") ?? issues[0];
    return envelope({
      context: state.context,
      priorityIssue: priority,
      issues,
      areas: state.areas,
      equipment: demoDomain.listEquipment(),
      readiness: state.readiness,
      shifts: demoDomain.listShifts(),
      members: state.members,
      now: demoDomain.now(),
    });
  }),

  // ---- Issues ------------------------------------------------------------------------------
  http.get(`${API}/issues`, () => envelope(demoDomain.listIssues())),
  http.get(`${API}/issues/:id`, ({ params }) => run(() => demoDomain.getIssue(param(params, "id")))),
  http.post(`${API}/issues`, async ({ request }) => {
    const input = await bodyOf<{ pendingSync?: boolean } & Record<string, unknown>>(request);
    if (input.pendingSync) {
      return envelope({
        id: "local-pending-001",
        state: "pending_sync",
        message: "Saved on this device. This report has not been received centrally.",
      });
    }
    return run(() => demoDomain.createIssue(input, actorOf(request)), 201);
  }),
  http.patch(`${API}/issues/:id`, async ({ params, request }) => {
    const input = await bodyOf(request);
    return run(() => demoDomain.updateIssue(param(params, "id"), input, actorOf(request)));
  }),
  http.post(`${API}/issues/:id/transition`, async ({ params, request }) => {
    const input = await bodyOf(request);
    return run(() => demoDomain.transitionIssue(param(params, "id"), input, actorOf(request)));
  }),

  http.post(`${API}/issues/:id/actions`, async ({ params, request }) => {
    const input = await bodyOf(request);
    return run(() => demoDomain.addAction(param(params, "id"), input, actorOf(request)), 201);
  }),
  http.patch(`${API}/issues/:id/actions/:actionId`, async ({ params, request }) => {
    const input = await bodyOf(request);
    return run(() => demoDomain.updateAction(param(params, "id"), param(params, "actionId"), input, actorOf(request)));
  }),
  http.delete(`${API}/issues/:id/actions/:actionId`, async ({ params, request }) => {
    const input = await bodyOf<{ version?: number }>(request);
    return run(() => demoDomain.removeAction(param(params, "id"), param(params, "actionId"), input, actorOf(request)));
  }),
  http.post(`${API}/issues/:id/actions/:actionId/restore`, ({ params, request }) =>
    run(() => demoDomain.restoreAction(param(params, "id"), param(params, "actionId"), actorOf(request))),
  ),

  http.post(`${API}/issues/:id/dependencies`, async ({ params, request }) => {
    const input = await bodyOf(request);
    return run(() => demoDomain.addDependency(param(params, "id"), input, actorOf(request)), 201);
  }),
  http.patch(`${API}/issues/:id/dependencies/:dependencyId`, async ({ params, request }) => {
    const input = await bodyOf(request);
    return run(() => demoDomain.updateDependency(param(params, "id"), param(params, "dependencyId"), input, actorOf(request)));
  }),

  http.post(`${API}/issues/:id/comments`, async ({ params, request }) => {
    const input = await bodyOf(request);
    return run(() => demoDomain.addComment(param(params, "id"), input, actorOf(request)), 201);
  }),

  // ---- Areas, equipment ---------------------------------------------------------------------
  http.get(`${API}/areas`, () => envelope(demoDomain.get().areas)),
  http.get(`${API}/equipment`, () => envelope(demoDomain.listEquipment())),
  http.get(`${API}/equipment/:id`, ({ params }) => run(() => demoDomain.getEquipment(param(params, "id")))),
  http.post(`${API}/equipment`, async ({ request }) => {
    const input = await bodyOf(request);
    return run(() => demoDomain.createEquipment(input, actorOf(request)), 201);
  }),
  http.patch(`${API}/equipment/:id`, async ({ params, request }) => {
    const input = await bodyOf(request);
    return run(() => demoDomain.updateEquipment(param(params, "id"), input, actorOf(request)));
  }),
  http.delete(`${API}/equipment/:id`, ({ params, request }) => run(() => demoDomain.deleteEquipment(param(params, "id"), actorOf(request)))),
  http.post(`${API}/equipment/:id/retire`, async ({ params, request }) => {
    const input = await bodyOf(request);
    return run(() => demoDomain.retireEquipment(param(params, "id"), input, actorOf(request)));
  }),
  http.post(`${API}/equipment/:id/restore`, ({ params, request }) => run(() => demoDomain.restoreEquipment(param(params, "id"), actorOf(request)))),
  http.post(`${API}/equipment/:id/state`, async ({ params, request }) => {
    const input = await bodyOf(request);
    return run(() => demoDomain.setEquipmentState(param(params, "id"), input, actorOf(request)));
  }),
  http.post(`${API}/equipment/:id/readings`, async ({ params, request }) => {
    const input = await bodyOf(request);
    return run(() => demoDomain.recordReading(param(params, "id"), input, actorOf(request)), 201);
  }),
  http.post(`${API}/equipment/:id/plans`, async ({ params, request }) => {
    const input = await bodyOf(request);
    return run(() => demoDomain.addPlan(param(params, "id"), input, actorOf(request)), 201);
  }),
  http.patch(`${API}/equipment/:id/plans/:planId`, async ({ params, request }) => {
    const input = await bodyOf(request);
    return run(() => demoDomain.updatePlan(param(params, "id"), param(params, "planId"), input, actorOf(request)));
  }),
  http.delete(`${API}/equipment/:id/plans/:planId`, async ({ params, request }) => {
    const input = await bodyOf<{ version?: number }>(request);
    return run(() => demoDomain.removePlan(param(params, "id"), param(params, "planId"), input, actorOf(request)));
  }),
  http.post(`${API}/equipment/:id/services`, async ({ params, request }) => {
    const input = await bodyOf(request);
    return run(() => demoDomain.logService(param(params, "id"), input, actorOf(request)), 201);
  }),

  // ---- Readiness ------------------------------------------------------------------------------
  http.get(`${API}/readiness`, () => envelope(demoDomain.get().readiness)),
  http.get(`${API}/readiness/:id`, ({ params }) => {
    const activity = demoDomain.get().readiness.find((item) => item.id === params.id);
    return activity ? envelope(activity) : envelope({ code: "NOT_FOUND", message: "This readiness activity could not be found." }, 404);
  }),
  http.post(`${API}/readiness/:id/reviews`, async ({ params, request }) => {
    const input = await bodyOf(request);
    return run(() => demoDomain.addReview(param(params, "id"), input, actorOf(request)), 201);
  }),
  http.patch(`${API}/readiness/:id/parts/:partId`, async ({ params, request }) => {
    const input = await bodyOf(request);
    return run(() => demoDomain.updatePart(param(params, "id"), param(params, "partId"), input, actorOf(request)));
  }),

  // ---- Shifts and handover ------------------------------------------------------------------
  http.get(`${API}/shifts`, () => envelope(demoDomain.listShifts())),
  http.get(`${API}/shifts/:id`, ({ params }) => run(() => demoDomain.shiftView(param(params, "id")))),
  http.post(`${API}/shifts`, async ({ request }) => {
    const input = await bodyOf(request);
    return run(() => demoDomain.createShift(input, actorOf(request)), 201);
  }),
  http.patch(`${API}/shifts/:id`, async ({ params, request }) => {
    const input = await bodyOf(request);
    return run(() => demoDomain.updateShift(param(params, "id"), input, actorOf(request)));
  }),
  http.delete(`${API}/shifts/:id`, ({ params, request }) => run(() => demoDomain.deleteShift(param(params, "id"), actorOf(request)))),
  http.post(`${API}/shifts/:id/start`, ({ params, request }) => run(() => demoDomain.startShift(param(params, "id"), actorOf(request)))),
  http.post(`${API}/shifts/:id/close`, ({ params, request }) => run(() => demoDomain.closeShift(param(params, "id"), actorOf(request)))),
  http.post(`${API}/shifts/:id/cancel`, async ({ params, request }) => {
    const input = await bodyOf(request);
    return run(() => demoDomain.cancelShift(param(params, "id"), input, actorOf(request)));
  }),
  http.post(`${API}/shifts/:id/crew`, async ({ params, request }) => {
    const input = await bodyOf(request);
    return run(() => demoDomain.addCrew(param(params, "id"), input, actorOf(request)), 201);
  }),
  http.delete(`${API}/shifts/:id/crew/:crewId`, async ({ params, request }) => {
    const input = await bodyOf<{ version?: number }>(request);
    return run(() => demoDomain.removeCrew(param(params, "id"), param(params, "crewId"), input, actorOf(request)));
  }),
  http.post(`${API}/shifts/:id/work`, async ({ params, request }) => {
    const input = await bodyOf(request);
    return run(() => demoDomain.addWork(param(params, "id"), input, actorOf(request)), 201);
  }),
  http.patch(`${API}/shifts/:id/work/:workId`, async ({ params, request }) => {
    const input = await bodyOf(request);
    return run(() => demoDomain.updateWork(param(params, "id"), param(params, "workId"), input, actorOf(request)));
  }),
  http.delete(`${API}/shifts/:id/work/:workId`, async ({ params, request }) => {
    const input = await bodyOf<{ version?: number }>(request);
    return run(() => demoDomain.removeWork(param(params, "id"), param(params, "workId"), input, actorOf(request)));
  }),
  http.put(`${API}/shifts/:id/handover`, async ({ params, request }) => {
    const input = await bodyOf<{ notes?: string }>(request);
    return run(() => demoDomain.saveHandoverNotes(param(params, "id"), input.notes, actorOf(request)));
  }),
  http.post(`${API}/shifts/:id/handover/publish`, ({ params, request }) =>
    run(() => demoDomain.publishHandover(param(params, "id"), actorOf(request))),
  ),
  http.post(`${API}/shifts/:id/handover/withdraw`, ({ params, request }) =>
    run(() => demoDomain.withdrawHandover(param(params, "id"), actorOf(request))),
  ),
  http.post(`${API}/shifts/:id/acknowledgement`, ({ params, request }) =>
    run(() => demoDomain.acknowledgeHandover(param(params, "id"), actorOf(request))),
  ),

  // ---- Sign-in and organisation ---------------------------------------------------------------
  http.post(`${API}/session`, async ({ request }) => {
    const input = await bodyOf<{ email?: string; password?: string }>(request);
    return run(() => demoDomain.authenticate(String(input.email ?? ""), String(input.password ?? "")));
  }),
  http.post(`${API}/session/password`, async ({ request }) => {
    const input = await bodyOf<{ email?: string; current?: string; next?: string }>(request);
    return run(() => demoDomain.changePassword(String(input.email ?? ""), String(input.current ?? ""), String(input.next ?? "")));
  }),
  http.get(`${API}/organisation`, () => envelope(demoDomain.organisation())),
  http.post(`${API}/members`, async ({ request }) => {
    const input = await bodyOf(request);
    return run(() => demoDomain.addMember(input, actorOf(request)), 201);
  }),
  http.patch(`${API}/members/:id`, async ({ params, request }) => {
    const input = await bodyOf<Record<string, unknown> & { version?: number }>(request);
    return run(() => demoDomain.updateMember(param(params, "id"), input, actorOf(request)));
  }),
  http.delete(`${API}/members/:id`, ({ params, request }) => run(() => demoDomain.deleteMember(param(params, "id"), actorOf(request)))),
  http.post(`${API}/members/:id/access`, async ({ params, request }) => {
    const input = await bodyOf<{ access?: string }>(request);
    return run(() => demoDomain.setMemberAccess(param(params, "id"), input.access === "on" ? "on" : "off", actorOf(request)));
  }),
  http.post(`${API}/members/:id/password-reset`, ({ params, request }) => run(() => demoDomain.resetPassword(param(params, "id"), actorOf(request)))),
  http.patch(`${API}/organisation/company`, async ({ request }) => {
    const input = await bodyOf<Record<string, unknown> & { version?: number }>(request);
    return run(() => demoDomain.updateCompany(input, actorOf(request)));
  }),
  http.patch(`${API}/organisation/site`, async ({ request }) => {
    const input = await bodyOf<Record<string, unknown> & { version?: number }>(request);
    return run(() => demoDomain.updateSite(input, actorOf(request)));
  }),

  // ---- Service providers and requests ----------------------------------------------------------
  http.get(`${API}/providers`, () => envelope(demoDomain.listProviders())),
  http.post(`${API}/providers`, async ({ request }) => {
    const input = await bodyOf(request);
    return run(() => demoDomain.createProvider(input, actorOf(request)), 201);
  }),
  http.patch(`${API}/providers/:id`, async ({ params, request }) => {
    const input = await bodyOf<Record<string, unknown> & { version?: number }>(request);
    return run(() => demoDomain.updateProvider(param(params, "id"), input, actorOf(request)));
  }),
  http.delete(`${API}/providers/:id`, ({ params, request }) => run(() => demoDomain.deleteProvider(param(params, "id"), actorOf(request)))),
  http.post(`${API}/providers/:id/active`, async ({ params, request }) => {
    const input = await bodyOf<{ active?: boolean }>(request);
    return run(() => demoDomain.setProviderActive(param(params, "id"), Boolean(input.active), actorOf(request)));
  }),
  http.get(`${API}/service-requests`, ({ request }) => {
    const equipmentId = new URL(request.url).searchParams.get("equipmentId") ?? undefined;
    return envelope(demoDomain.listServiceRequests(equipmentId));
  }),
  http.get(`${API}/service-requests/:id`, ({ params }) => run(() => demoDomain.getServiceRequest(param(params, "id")))),
  http.post(`${API}/service-requests`, async ({ request }) => {
    const input = await bodyOf(request);
    return run(() => demoDomain.createServiceRequest(input, actorOf(request)), 201);
  }),
  http.get(`${API}/provider-response/:token`, ({ params }) => run(() => demoDomain.providerView(param(params, "token")))),
  http.post(`${API}/provider-response/:token`, async ({ params, request }) => {
    const input = await bodyOf(request);
    return run(() => demoDomain.providerRespond(param(params, "token"), input));
  }),
  http.post(`${API}/service-requests/:id/invites/:inviteId/award`, async ({ params, request }) => {
    const input = await bodyOf<{ version?: number }>(request);
    return run(() => demoDomain.awardInvite(param(params, "id"), param(params, "inviteId"), input, actorOf(request)));
  }),
  http.post(`${API}/service-requests/:id/schedule`, async ({ params, request }) => {
    const input = await bodyOf<Record<string, unknown> & { version?: number }>(request);
    return run(() => demoDomain.scheduleRequest(param(params, "id"), input, actorOf(request)));
  }),
  http.post(`${API}/service-requests/:id/complete`, async ({ params, request }) => {
    const input = await bodyOf<Record<string, unknown> & { version?: number }>(request);
    return run(() => demoDomain.completeRequest(param(params, "id"), input, actorOf(request)));
  }),
  http.post(`${API}/service-requests/:id/cancel`, async ({ params, request }) => {
    const input = await bodyOf<Record<string, unknown> & { version?: number }>(request);
    return run(() => demoDomain.cancelRequest(param(params, "id"), input, actorOf(request)));
  }),

  // ---- Notifications ------------------------------------------------------------------------
  http.get(`${API}/notifications`, ({ request }) => envelope(demoDomain.listNotifications(actorOf(request)))),
  http.post(`${API}/notifications/read-all`, ({ request }) => run(() => demoDomain.readAllNotifications(actorOf(request)))),
  http.patch(`${API}/notifications/:id`, async ({ params, request }) => {
    const input = await bodyOf<{ read?: boolean; dismissed?: boolean }>(request);
    const body = input.read === undefined && input.dismissed === undefined ? { read: true } : input;
    return run(() => demoDomain.updateNotification(param(params, "id"), body));
  }),

  // ---- Reports and workspaces ----------------------------------------------------------------
  http.get(`${API}/reports`, () => envelope(reportCatalogue)),
  http.get(`${API}/reports/:key`, ({ params }) => {
    const report = buildReport(String(params.key), {
      issues: demoDomain.listIssues(),
      readiness: demoDomain.get().readiness,
      now: demoDomain.now(),
    });
    return report ? envelope(report) : envelope({ code: "NOT_FOUND", message: "This report could not be found." }, 404);
  }),

  http.get(`${API}/workspaces/:key`, ({ params }) => {
    const key = String(params.key) as keyof typeof workspaceContent;
    const content = workspaceContent[key];
    if (!content) return envelope({ code: "NOT_FOUND", message: "This workspace could not be found." }, 404);
    const state = demoDomain.get();
    const records =
      key === "exceptions"
        ? demoDomain.listIssues()
        : key === "equipment"
          ? demoDomain.listEquipment()
          : key === "resources"
            ? state.readiness
            : key === "shifts"
              ? demoDomain.listShifts()
              : key === "admin"
                ? [
                    { id: "cfg-site", title: "Site configuration", detail: "Riverside Mine · Open pit" },
                    { id: "cfg-users", title: "Users & roles", detail: "People and roles" },
                    { id: "cfg-entitlements", title: "Subscription", detail: "Operations — Single Site" },
                    { id: "cfg-integrations", title: "Integration boundaries", detail: "No live systems connected" },
                  ]
                : [
                    { id: "rep-production", title: "Production vs plan", detail: "Reported shift comparison" },
                    { id: "rep-exceptions", title: "Operational exceptions", detail: "Evidence-linked issue summary" },
                    { id: "rep-downtime", title: "Equipment delay stages", detail: "Reported events, not financial loss" },
                    { id: "rep-readiness", title: "Resource readiness", detail: "Upcoming work and uncertain inputs" },
                  ];
    return envelope({ ...content, records });
  }),

  http.post(`${API}/scenario/reset`, () => envelope(demoDomain.reset())),
];
