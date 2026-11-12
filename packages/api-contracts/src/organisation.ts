import { z } from "zod";

const timestamp = z.string().datetime({ offset: true });

export const memberStatusSchema = z.enum(["active", "invited", "deactivated"]);

export const memberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.string().min(1),
  phone: z.string(),
  employeeNumber: z.string(),
  mustChangePassword: z.boolean(),
  status: memberStatusSchema,
  invitedAt: timestamp.nullable(),
  joinedAt: timestamp.nullable(),
  lastSignInAt: timestamp.nullable(),
  deactivatedAt: timestamp.nullable(),
  version: z.number().int().min(1),
});

export const companySchema = z.object({
  name: z.string().min(1),
  industry: z.string(),
  registration: z.string(),
  address: z.string(),
  contactName: z.string(),
  contactEmail: z.string(),
  contactPhone: z.string(),
  version: z.number().int().min(1),
});

export const siteDetailsSchema = z.object({
  name: z.string().min(1),
  type: z.string(),
  commodity: z.string(),
  location: z.string(),
  timezone: z.string(),
  operatingHours: z.string(),
  siteContact: z.string(),
  version: z.number().int().min(1),
});

export const organisationEventSchema = z.object({
  id: z.string().min(1),
  at: timestamp,
  actor: z.string().min(1),
  summary: z.string().min(1),
});

export type MemberStatus = z.infer<typeof memberStatusSchema>;
export type Member = z.infer<typeof memberSchema>;
export type Company = z.infer<typeof companySchema>;
export type SiteDetails = z.infer<typeof siteDetailsSchema>;
export type OrganisationEvent = z.infer<typeof organisationEventSchema>;
