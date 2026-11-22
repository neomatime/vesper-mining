/**
 * Equipment records: categories, reported state, downtime reasons, maintenance plans, service entries and events.
 * Availability is what a person reported; it is never a verified fact. Records carry a `version` for change checks.
 */
import { z } from "zod";

const timestamp = z.string().datetime({ offset: true });

export const equipmentCategorySchema = z.enum([
  "excavator",
  "haul_truck",
  "dozer",
  "loader",
  "drill_rig",
  "crusher",
  "water_cart",
  "light_vehicle",
  "pump",
  // Site infrastructure, kept in the same asset register as equipment. See `assetGroupOf` in the app for how they are grouped.
  "substation",
  "generator",
  "power_distribution",
  "pipeline",
  "conveyor",
  "processing_plant",
  "mine_road",
  "rail",
  "loading_facility",
  "comms_network",
  "other",
]);

/** The condition of an asset, kept apart from whether it is available and from when it is next serviced. */
export const assetConditionSchema = z.enum(["good", "needs_attention", "unknown"]);

export const equipmentStateSchema = z.enum(["available", "unavailable"]);

/** Why equipment was reported unavailable. A short list people can pick from in one tap. */
export const downtimeReasonSchema = z.enum([
  "mechanical_fault",
  "electrical_fault",
  "waiting_parts",
  "waiting_contractor",
  "planned_maintenance",
  "operating_conditions",
  "other",
]);

export const maintenancePlanSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  basis: z.enum(["hours", "days"]),
  interval: z.number().positive(),
  lastServiceHours: z.number().nonnegative().nullable(),
  lastServiceAt: timestamp.nullable(),
});

export const serviceEntrySchema = z.object({
  id: z.string().min(1),
  type: z.enum(["service", "inspection", "repair"]),
  performedAt: timestamp,
  hours: z.number().nonnegative().nullable(),
  summary: z.string().min(1),
  performedBy: z.string().min(1),
  workOrderRef: z.string().nullable(),
  planId: z.string().nullable(),
});

export const equipmentEventSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "created",
    "edited",
    "state_changed",
    "reading_recorded",
    "plan_added",
    "plan_updated",
    "plan_removed",
    "service_logged",
    "retired",
    "restored",
  ]),
  /** For an availability change: the state it was reported as, and why. Older events have neither. */
  state: equipmentStateSchema.nullish(),
  reason: downtimeReasonSchema.nullish(),
  summary: z.string().min(1),
  actor: z.string().min(1),
  actorRole: z.string().min(1),
  occurredAt: timestamp,
  note: z.string().nullable(),
});

export const equipmentSchema = z.object({
  id: z.string().min(1),
  siteId: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  category: equipmentCategorySchema,
  makeModel: z.string().nullable(),
  serialNumber: z.string().nullable(),
  areaId: z.string().nullable(),
  notes: z.string().nullable(),
  /** Where the asset is, in words, when it is not in a mapped area (for example Plant Area or Tailings storage facility). */
  location: z.string().nullable(),
  /** Who is responsible for the asset. */
  responsible: z.string().nullable(),
  condition: assetConditionSchema,
  /** A usage measure where operating hours do not apply, for example 12,400 m3 pumped. Optional. */
  usage: z.string().nullable(),
  /** The assets this one depends on to operate (for example a crusher depends on its substation). */
  dependsOn: z.array(z.string().min(1)),
  state: equipmentStateSchema,
  stateNote: z.string().nullable(),
  stateQuality: z.enum(["reported", "verified"]),
  stateUpdatedAt: timestamp,
  hours: z.number().nonnegative().nullable(),
  hoursReadAt: timestamp.nullable(),
  hoursSource: z.string().nullable(),
  hoursPerDay: z.number().positive().nullable(),
  plans: z.array(maintenancePlanSchema),
  services: z.array(serviceEntrySchema),
  events: z.array(equipmentEventSchema),
  retiredAt: timestamp.nullable(),
  retiredReason: z.string().nullable(),
  version: z.number().int().positive(),
  createdAt: timestamp,
});

export type AssetCondition = z.infer<typeof assetConditionSchema>;
export type EquipmentCategory = z.infer<typeof equipmentCategorySchema>;
export type EquipmentState = z.infer<typeof equipmentStateSchema>;
export type DowntimeReason = z.infer<typeof downtimeReasonSchema>;
export type MaintenancePlan = z.infer<typeof maintenancePlanSchema>;
export type ServiceEntry = z.infer<typeof serviceEntrySchema>;
export type EquipmentEvent = z.infer<typeof equipmentEventSchema>;
export type Equipment = z.infer<typeof equipmentSchema>;
