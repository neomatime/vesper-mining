// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { FIXTURE_PASSWORD } from "./accounts";
import { DemoError, demoDomain } from "./demo-store";
import type { Actor } from "./issue-rules";

const manager: Actor = { name: "John Dlamini", role: "Mine Manager" };
const amina: Actor = { name: "Amina Patel", role: "Shift Supervisor" };

function rejects(operation: () => unknown, status: number, pattern?: RegExp) {
  try {
    operation();
  } catch (error) {
    expect(error).toBeInstanceOf(DemoError);
    expect((error as DemoError).status).toBe(status);
    if (pattern) expect((error as DemoError).message).toMatch(pattern);
    return;
  }
  throw new Error("Expected the operation to be rejected.");
}

const invite = { name: "Zanele Mokoena", email: "Zanele.Mokoena@riverside.example", role: "Maintenance Planner" };

beforeEach(() => demoDomain.reset());

describe("inviting people", () => {
  it("records an invitation with a normalised email and an activity entry", () => {
    const member = demoDomain.inviteMember(invite, manager);
    expect(member).toMatchObject({ status: "invited", email: "zanele.mokoena@riverside.example", joinedAt: null });
    expect(demoDomain.organisation().activity[0].summary).toMatch(/Invited Zanele Mokoena/);
  });

  it("rejects a duplicate email, a bad email and an unknown role", () => {
    rejects(() => demoDomain.inviteMember({ ...invite, email: "amina.patel@riverside.example" }, manager), 409, /already has access/);
    rejects(() => demoDomain.inviteMember({ ...invite, email: "not-an-email" }, manager), 400, /valid work email/);
    rejects(() => demoDomain.inviteMember({ ...invite, role: "Chief Wizard" }, manager), 400, /role/);
  });

  it("is limited to the Mine Manager", () => {
    rejects(() => demoDomain.inviteMember(invite, amina), 403);
  });

  it("makes the new person available as an owner and a supervisor", () => {
    demoDomain.inviteMember({ ...invite, role: "Shift Supervisor" }, manager);
    const shift = demoDomain.createShift({ name: "Shift Z", date: "2025-04-26", start: "06:00", end: "14:00", supervisor: "Zanele Mokoena" }, manager);
    expect(shift.supervisor).toBe("Zanele Mokoena");
  });
});

describe("signing in", () => {
  it("accepts an invitation on first sign-in", () => {
    const member = demoDomain.inviteMember(invite, manager);
    const account = demoDomain.authenticate(invite.email, FIXTURE_PASSWORD);
    expect(account).toMatchObject({ name: "Zanele Mokoena", role: "Maintenance Planner", home: "/equipment" });
    const stored = demoDomain.organisation().members.find((item) => item.id === member.id);
    expect(stored).toMatchObject({ status: "active" });
    expect(stored?.joinedAt).not.toBeNull();
  });

  it("refuses a wrong password and an unknown email without saying which", () => {
    rejects(() => demoDomain.authenticate("john.dlamini@riverside.example", "wrong"), 401, /do not match/);
    rejects(() => demoDomain.authenticate("nobody@riverside.example", FIXTURE_PASSWORD), 401, /do not match/);
  });

  it("refuses someone whose access is off and lets them in again once restored", () => {
    const sipho = demoDomain.organisation().members.find((item) => item.name === "Sipho Nkosi")!;
    demoDomain.setMemberAccess(sipho.id, "off", manager);
    rejects(() => demoDomain.authenticate(sipho.email, FIXTURE_PASSWORD), 403, /turned off/);
    demoDomain.setMemberAccess(sipho.id, "on", manager);
    expect(demoDomain.authenticate(sipho.email, FIXTURE_PASSWORD).name).toBe("Sipho Nkosi");
  });
});

describe("changing roles and access", () => {
  const find = (name: string) => demoDomain.organisation().members.find((item) => item.name === name)!;

  it("changes a role, bumps the version and rejects a stale edit", () => {
    const lebo = find("Lebo Maseko");
    const before = lebo.version;
    const updated = demoDomain.updateMember(lebo.id, { role: "Shift Supervisor", version: before }, manager);
    expect(updated).toMatchObject({ role: "Shift Supervisor", version: before + 1 });
    rejects(() => demoDomain.updateMember(lebo.id, { role: "Field Employee", version: before }, manager), 409, /changed by someone else/);
  });

  it("will not let a manager change or switch off their own account", () => {
    const john = find("John Dlamini");
    rejects(() => demoDomain.updateMember(john.id, { role: "Shift Supervisor" }, manager), 409, /your own role/);
    rejects(() => demoDomain.setMemberAccess(john.id, "off", manager), 409, /your own access/);
  });

  it("always keeps one active Mine Manager", () => {
    const john = find("John Dlamini");
    const second = demoDomain.inviteMember({ name: "Mpho Sithole", email: "mpho@riverside.example", role: "Mine Manager" }, manager);
    // With a second manager, the first can be demoted by that manager.
    const secondActor: Actor = { name: second.name, role: "Mine Manager" };
    demoDomain.updateMember(john.id, { role: "Shift Supervisor" }, secondActor);
    rejects(() => demoDomain.setMemberAccess(second.id, "off", { name: "Someone Else", role: "Mine Manager" }), 409, /at least one active Mine Manager/);
  });

  it("keeps the name of anyone who has signed in, but lets an invited name be corrected", () => {
    const lebo = find("Lebo Maseko");
    rejects(() => demoDomain.updateMember(lebo.id, { name: "Lebogang Maseko" }, manager), 409, /keeps the name/);
    const pending = demoDomain.inviteMember(invite, manager);
    expect(demoDomain.updateMember(pending.id, { name: "Zanele M. Mokoena" }, manager).name).toBe("Zanele M. Mokoena");
  });
});

describe("removing people", () => {
  it("withdraws a pending invitation completely", () => {
    const pending = demoDomain.inviteMember(invite, manager);
    demoDomain.removeInvitation(pending.id, manager);
    expect(demoDomain.organisation().members.some((item) => item.id === pending.id)).toBe(false);
  });

  it("never deletes someone who has signed in", () => {
    const lebo = demoDomain.organisation().members.find((item) => item.name === "Lebo Maseko")!;
    rejects(() => demoDomain.removeInvitation(lebo.id, manager), 409, /Turn off access/);
  });

  it("resends only pending invitations", () => {
    const lebo = demoDomain.organisation().members.find((item) => item.name === "Lebo Maseko")!;
    rejects(() => demoDomain.resendInvitation(lebo.id, manager), 409);
    const pending = demoDomain.inviteMember(invite, manager);
    const before = pending.version;
    expect(demoDomain.resendInvitation(pending.id, manager).version).toBe(before + 1);
  });

  it("removes a deactivated person from the choices for new work but keeps existing records", () => {
    const thabo = demoDomain.organisation().members.find((item) => item.name === "Thabo Molefe")!;
    demoDomain.setMemberAccess(thabo.id, "off", manager);
    const shift = demoDomain.createShift({ name: "Shift Q", date: "2025-04-27", start: "06:00", end: "14:00", supervisor: "Amina Patel" }, manager);
    rejects(() => demoDomain.addCrew(shift.id, { name: "Thabo Molefe", duty: "Operator", version: shift.version }, manager), 400, /from your team/);
  });
});

describe("site and company", () => {
  it("saves site details and reports a conflict on a stale version", () => {
    const { site } = demoDomain.organisation();
    const before = site.version;
    const saved = demoDomain.updateSite({ ...site, name: "Riverside North", version: before }, manager);
    expect(saved).toMatchObject({ name: "Riverside North", version: before + 1 });
    rejects(() => demoDomain.updateSite({ name: "Riverside East", version: before }, manager), 409);
  });

  it("validates company details and limits the change to the Mine Manager", () => {
    const { company } = demoDomain.organisation();
    rejects(() => demoDomain.updateCompany({ ...company, contactEmail: "nope" }, manager), 400, /valid contact email/);
    rejects(() => demoDomain.updateCompany({ ...company, name: "Other" }, amina), 403);
    expect(demoDomain.updateCompany({ ...company, name: "Riverside Resources Holdings" }, manager).name).toBe("Riverside Resources Holdings");
  });
});
