/**
 * Shifts: crew with duty and equipment, work items with their completion and evidence, the handover, and the events recorded against a shift.
 */
import { z } from "zod";

const timestamp = z.string().datetime({ offset: true });

export const shiftStateSchema = z.enum(["scheduled", "in_progress", "closed", "cancelled"]);

export const crewMemberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  duty: z.string().min(1),
  equipmentId: z.string().nullable(),
});

/** A file attached as evidence, by name. The file itself is not stored in this build. */
export const workEvidenceSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["photo", "document", "other"]),
  sizeLabel: z.string(),
});

/** What the person recorded when they finished a task. */
export const workCompletionSchema = z.object({
  note: z.string().nullable(),
  evidence: z.array(workEvidenceSchema),
  by: z.string().min(1),
});

export const shiftWorkSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  owner: z.string().nullable(),
  issueId: z.string().nullable(),
  done: z.boolean(),
  doneAt: timestamp.nullable(),
  completion: workCompletionSchema.nullish(),
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

/** A crew member or supervisor confirming they have read the shift's briefing, or the handover from the shift before. */
export const shiftAcknowledgementSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["briefing", "handover"]),
  at: timestamp,
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
  /** Who has read the briefing and the incoming handover (records from before this field have none). */
  acknowledgements: z.array(shiftAcknowledgementSchema).optional(),
  version: z.number().int().positive(),
  createdAt: timestamp,
});

export type ShiftState = z.infer<typeof shiftStateSchema>;
export type CrewMember = z.infer<typeof crewMemberSchema>;
export type ShiftWork = z.infer<typeof shiftWorkSchema>;
export type Handover = z.infer<typeof handoverSchema>;
export type ShiftEvent = z.infer<typeof shiftEventSchema>;
export type Shift = z.infer<typeof shiftSchema>;
export type ShiftAcknowledgement = z.infer<typeof shiftAcknowledgementSchema>;
