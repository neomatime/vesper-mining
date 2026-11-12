import { z } from "zod";
import { equipmentCategorySchema } from "./equipment";

const timestamp = z.string().datetime({ offset: true });

export const serviceProviderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  registration: z.string(),
  contactName: z.string(),
  email: z.string(),
  phone: z.string(),
  categories: z.array(equipmentCategorySchema),
  /** Last day the provider is approved to work at this mine, as a date. Empty means no end date. */
  approvedUntil: z.string(),
  active: z.boolean(),
  notes: z.string(),
  createdAt: timestamp,
  version: z.number().int().min(1),
});

export const quoteSchema = z.object({
  amount: z.number().nonnegative().nullable(),
  reference: z.string(),
  availableFrom: z.string().nullable(),
  validUntil: z.string().nullable(),
  notes: z.string(),
  recordedAt: timestamp,
  recordedBy: z.string().min(1),
});

export const inviteStateSchema = z.enum(["sent", "quoted", "declined", "accepted", "not_selected"]);

export const serviceInviteSchema = z.object({
  id: z.string().min(1),
  /** The private reply link the provider uses. The mine never enters a quote for them. */
  token: z.string().min(1),
  providerId: z.string().min(1),
  providerName: z.string().min(1),
  state: inviteStateSchema,
  sentAt: timestamp,
  declinedReason: z.string().nullable(),
  quote: quoteSchema.nullable(),
});

export const requestStatusSchema = z.enum(["open", "awarded", "scheduled", "completed", "cancelled"]);

export const serviceRequestEventSchema = z.object({
  id: z.string().min(1),
  at: timestamp,
  actor: z.string().min(1),
  summary: z.string().min(1),
});

export const serviceRequestSchema = z.object({
  id: z.string().min(1),
  number: z.string().min(1),
  equipmentId: z.string().min(1),
  planId: z.string().nullable(),
  title: z.string().min(1),
  description: z.string(),
  urgency: z.enum(["routine", "urgent", "critical"]),
  preferredDate: z.string().nullable(),
  status: requestStatusSchema,
  invites: z.array(serviceInviteSchema),
  awardedInviteId: z.string().nullable(),
  scheduledFor: z.string().nullable(),
  completedAt: timestamp.nullable(),
  cancelledReason: z.string().nullable(),
  createdBy: z.string().min(1),
  createdAt: timestamp,
  events: z.array(serviceRequestEventSchema),
  version: z.number().int().min(1),
});

export type ServiceProvider = z.infer<typeof serviceProviderSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type InviteState = z.infer<typeof inviteStateSchema>;
export type ServiceInvite = z.infer<typeof serviceInviteSchema>;
export type RequestStatus = z.infer<typeof requestStatusSchema>;
export type ServiceRequestEvent = z.infer<typeof serviceRequestEventSchema>;
export type ServiceRequest = z.infer<typeof serviceRequestSchema>;
