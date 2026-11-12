import type { Company, Member, OrganisationEvent, SiteDetails } from "@vesper/api-contracts";
import { accounts } from "./accounts";

const joined = "2025-01-13T08:00:00+02:00";

export const seedMembers: Member[] = accounts.map((account, index) => ({
  id: `member-${String(index + 1).padStart(3, "0")}`,
  name: account.name,
  email: account.email,
  role: account.role,
  status: "active",
  invitedAt: joined,
  joinedAt: joined,
  lastSignInAt: null,
  deactivatedAt: null,
  version: 1,
}));

export const seedCompany: Company = {
  name: "Riverside Resources (Pty) Ltd",
  industry: "Open-pit mining",
  registration: "2016/204518/07",
  address: "14 Quarry Road, Rustenburg, 0299",
  contactName: "John Dlamini",
  contactEmail: "john.dlamini@riverside.example",
  contactPhone: "+27 14 555 0142",
  version: 1,
};

export const seedSite: SiteDetails = {
  name: "Riverside Mine",
  type: "Open pit",
  commodity: "Platinum group metals",
  location: "Rustenburg, North West",
  timezone: "Africa/Johannesburg",
  operatingHours: "24 hours, three shifts",
  siteContact: "Control room, ext. 201",
  version: 1,
};

export const seedActivity: OrganisationEvent[] = [];
