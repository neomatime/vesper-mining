import { z } from "zod";

const timestamp = z.string().datetime({ offset: true });

export const shiftStateSchema = z.enum(["scheduled", "in_progress", "closed", "cancelled"]);

export const crewMemberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  duty: z.string().min(1),
  equipmentId: z.string().nullable(),
});

export const shiftWorkSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  owner: z.string().nullable(),
  issueId: z.string().nullable(),
  done: z.boolean(),
  doneAt: timestamp.nullable(),
});

export const handoverSchema = z.object({
  notes: z.string(),
  state: z.enum(["draft", "published", "acknowledged"]),
  notesUpdatedAt: timestamp.nullable(),
  publishedBy: z.string().nullable(),
  publishedAt: timestamp.nullable(),
  acknowledgedBy: z.string().nullable(),
  acknowledgedAt: timestamp.nullable(),
});

export const shiftEventSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "created",
    "edited",
    "crew_added",
    "crew_removed",
    "work_added",
    "work_updated",
    "work_removed",
    "started",
    "closed",
    "cancelled",
    "handover_published",
    "handover_withdrawn",
    "handover_acknowledged",
  ]),
  summary: z.string().min(1),
  actor: z.string().min(1),
  actorRole: z.string().min(1),
  occurredAt: timestamp,
  note: z.string().nullable(),
});

export const shiftSchema = z.object({
  id: z.string().min(1),
  siteId: z.string().min(1),
  name: z.string().min(1),
  startsAt: timestamp,
  endsAt: timestamp,
  state: shiftStateSchema,
  supervisor: z.string().nullable(),
  briefing: z.string().nullable(),
  crew: z.array(crewMemberSchema),
  work: z.array(shiftWorkSchema),
  handover: handoverSchema,
  events: z.array(shiftEventSchema),
  startedAt: timestamp.nullable(),
  closedAt: timestamp.nullable(),
  cancelledReason: z.string().nullable(),
  version: z.number().int().positive(),
  createdAt: timestamp,
});

export type ShiftState = z.infer<typeof shiftStateSchema>;
export type CrewMember = z.infer<typeof crewMemberSchema>;
export type ShiftWork = z.infer<typeof shiftWorkSchema>;
export type Handover = z.infer<typeof handoverSchema>;
export type ShiftEvent = z.infer<typeof shiftEventSchema>;
export type Shift = z.infer<typeof shiftSchema>;
