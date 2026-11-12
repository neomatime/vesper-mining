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
  "other",
]);

export const equipmentStateSchema = z.enum(["available", "unavailable"]);

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

export type EquipmentCategory = z.infer<typeof equipmentCategorySchema>;
export type EquipmentState = z.infer<typeof equipmentStateSchema>;
export type MaintenancePlan = z.infer<typeof maintenancePlanSchema>;
export type ServiceEntry = z.infer<typeof serviceEntrySchema>;
export type EquipmentEvent = z.infer<typeof equipmentEventSchema>;
export type Equipment = z.infer<typeof equipmentSchema>;
