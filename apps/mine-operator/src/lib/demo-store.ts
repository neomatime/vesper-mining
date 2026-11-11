import type { OperationalIssue, ReadinessActivity } from "@vesper/api-contracts";
import {
  areas,
  defaultContext,
  equipment,
  notifications,
  primaryIssue,
  readinessActivity,
  secondaryIssue,
  shifts,
} from "./demo-data";

function clone<T>(value: T): T {
  return structuredClone(value);
}

const initialState = {
  context: defaultContext,
  issues: [primaryIssue, secondaryIssue],
  areas,
  readiness: [readinessActivity],
  equipment,
  shifts,
  notifications,
  handoverAcknowledged: false,
};

export type DemoDomainState = typeof initialState;

let state: DemoDomainState = clone(initialState);

export const demoDomain = {
  get: () => state,
  reset: () => {
    state = clone(initialState);
    return state;
  },
  addIssue: (issue: OperationalIssue) => {
    state.issues = [issue, ...state.issues];
    return issue;
  },
  updateIssue: (id: string, update: Partial<OperationalIssue>) => {
    const index = state.issues.findIndex((issue) => issue.id === id);
    if (index === -1) return null;
    state.issues[index] = { ...state.issues[index], ...update };
    return state.issues[index];
  },
  reviewReadiness: (id: string): ReadinessActivity | null => {
    const index = state.readiness.findIndex((activity) => activity.id === id);
    if (index === -1) return null;
    state.readiness[index] = { ...state.readiness[index], reviewState: "reviewed" };
    return state.readiness[index];
  },
  acknowledgeHandover: () => {
    state.handoverAcknowledged = true;
    return { acknowledged: true, acknowledgedAt: state.context.demoNow };
  },
  readNotification: (id: string) => {
    const notification = state.notifications.find((item) => item.id === id);
    if (!notification) return null;
    notification.unread = false;
    return notification;
  },
};
