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

const input = { name: "Zanele Mokoena", email: "Zanele.Mokoena@riverside.example", role: "Maintenance Planner", phone: "+27 82 555 0199", employeeNumber: "RIV-0100" };
const find = (name: string) => demoDomain.organisation().members.find((item) => item.name === name)!;

beforeEach(() => demoDomain.reset());

describe("adding employees", () => {
  it("records the employee with a normalised email, a temporary password and an activity entry", () => {
    const { member, temporaryPassword } = demoDomain.addMember(input, manager);
    expect(member).toMatchObject({ status: "invited", email: "zanele.mokoena@riverside.example", joinedAt: null, mustChangePassword: true, employeeNumber: "RIV-0100" });
    expect(temporaryPassword).toMatch(/^Vesper-\d{4}-/);
    expect(demoDomain.organisation().activity[0].summary).toMatch(/Added Zanele Mokoena/);
  });

  it("rejects a duplicate email, employee number, bad email and unknown role", () => {
    rejects(() => demoDomain.addMember({ ...input, email: "amina.patel@riverside.example" }, manager), 409, /already has access/);
    rejects(() => demoDomain.addMember({ ...input, employeeNumber: "RIV-0001" }, manager), 409, /employee number/);
    rejects(() => demoDomain.addMember({ ...input, email: "not-an-email" }, manager), 400, /valid work email/);
    rejects(() => demoDomain.addMember({ ...input, role: "Chief Wizard" }, manager), 400, /role/);
  });

  it("is limited to the Mine Manager", () => {
    rejects(() => demoDomain.addMember(input, amina), 403);
  });

  it("makes the new person available as a supervisor", () => {
    demoDomain.addMember({ ...input, role: "Shift Supervisor" }, manager);
    const shift = demoDomain.createShift({ name: "Shift Z", date: "2025-04-26", start: "06:00", end: "14:00", supervisor: "Zanele Mokoena" }, manager);
    expect(shift.supervisor).toBe("Zanele Mokoena");
  });
});

describe("signing in and passwords", () => {
  it("makes a new employee choose their own password before a session starts", () => {
    const { temporaryPassword } = demoDomain.addMember(input, manager);
    const first = demoDomain.authenticate(input.email, temporaryPassword);
    expect(first).toEqual({ account: null, mustChangePassword: true });
    rejects(() => demoDomain.changePassword(input.email, temporaryPassword, "short"), 400, /at least 10/);
    rejects(() => demoDomain.changePassword(input.email, temporaryPassword, "alllowercase123"), 400, /upper and lower/);
    rejects(() => demoDomain.changePassword(input.email, temporaryPassword, "NoDigitsHereAtAll"), 400, /number/);
    const done = demoDomain.changePassword(input.email, temporaryPassword, "Quarry-Face-2025");
    expect(done.account).toMatchObject({ name: "Zanele Mokoena", role: "Maintenance Planner", home: "/equipment" });
    expect(find("Zanele Mokoena")).toMatchObject({ status: "active", mustChangePassword: false });
    expect(demoDomain.authenticate(input.email, "Quarry-Face-2025").account?.name).toBe("Zanele Mokoena");
    rejects(() => demoDomain.authenticate(input.email, temporaryPassword), 401);
  });

  it("refuses a wrong password and an unknown email without saying which", () => {
    rejects(() => demoDomain.authenticate("john.dlamini@riverside.example", "wrong"), 401, /do not match/);
    rejects(() => demoDomain.authenticate("nobody@riverside.example", FIXTURE_PASSWORD), 401, /do not match/);
  });

  it("signs in with a Microsoft address that belongs to a VESPER person, and only then", () => {
    expect(demoDomain.authenticateSso("John.Dlamini@riverside.example").account?.name).toBe("John Dlamini");
    rejects(() => demoDomain.authenticateSso("nobody@riverside.example"), 401, /No VESPER account/);
    const sipho = find("Sipho Nkosi");
    demoDomain.setMemberAccess(sipho.id, "off", manager);
    rejects(() => demoDomain.authenticateSso(sipho.email), 403, /turned off/);
  });

  it("refuses someone whose access is off and lets them in again once restored", () => {
    const sipho = find("Sipho Nkosi");
    demoDomain.setMemberAccess(sipho.id, "off", manager);
    rejects(() => demoDomain.authenticate(sipho.email, FIXTURE_PASSWORD), 403, /turned off/);
    demoDomain.setMemberAccess(sipho.id, "on", manager);
    expect(demoDomain.authenticate(sipho.email, FIXTURE_PASSWORD).account?.name).toBe("Sipho Nkosi");
  });

  it("lets a manager reset someone else's password, which forces a new choice", () => {
    const lebo = find("Lebo Maseko");
    const { temporaryPassword } = demoDomain.resetPassword(lebo.id, manager);
    rejects(() => demoDomain.authenticate(lebo.email, FIXTURE_PASSWORD), 401);
    expect(demoDomain.authenticate(lebo.email, temporaryPassword).mustChangePassword).toBe(true);
    rejects(() => demoDomain.resetPassword(find("John Dlamini").id, manager), 409, /your own password/);
    rejects(() => demoDomain.resetPassword(lebo.id, amina), 403);
  });
});

describe("changing roles and access", () => {
  it("changes a role, bumps the version and rejects a stale edit", () => {
    const lebo = find("Lebo Maseko");
    const before = lebo.version;
    const updated = demoDomain.updateMember(lebo.id, { role: "Shift Supervisor", version: before }, manager);
    expect(updated).toMatchObject({ role: "Shift Supervisor", version: before + 1 });
    rejects(() => demoDomain.updateMember(lebo.id, { role: "Field Employee", version: before }, manager), 409, /changed by someone else/);
  });

  it("updates phone and employee number", () => {
    const naledi = find("Naledi Khoza");
    const saved = demoDomain.updateMember(naledi.id, { phone: "+27 82 000 0000", employeeNumber: "RIV-0500" }, manager);
    expect(saved).toMatchObject({ phone: "+27 82 000 0000", employeeNumber: "RIV-0500" });
    rejects(() => demoDomain.updateMember(naledi.id, { employeeNumber: "RIV-0001" }, manager), 409, /employee number/);
  });

  it("will not let a manager change, switch off or delete their own account", () => {
    const john = find("John Dlamini");
    rejects(() => demoDomain.updateMember(john.id, { role: "Shift Supervisor" }, manager), 409, /your own role/);
    rejects(() => demoDomain.setMemberAccess(john.id, "off", manager), 409, /your own access/);
    rejects(() => demoDomain.deleteMember(john.id, manager), 409, /your own account/);
  });

  it("always keeps one active Mine Manager", () => {
    const john = find("John Dlamini");
    const { member: second } = demoDomain.addMember({ name: "Mpho Sithole", email: "mpho@riverside.example", role: "Mine Manager" }, manager);
    demoDomain.updateMember(john.id, { role: "Shift Supervisor" }, { name: second.name, role: "Mine Manager" });
    rejects(() => demoDomain.setMemberAccess(second.id, "off", { name: "Someone Else", role: "Mine Manager" }), 409, /at least one active Mine Manager/);
    rejects(() => demoDomain.deleteMember(second.id, { name: "Someone Else", role: "Mine Manager" }), 409, /at least one active Mine Manager/);
  });

  it("keeps the name of anyone who has signed in, but lets a new employee's name be corrected", () => {
    const { member, temporaryPassword } = demoDomain.addMember(input, manager);
    expect(demoDomain.updateMember(member.id, { name: "Zanele M. Mokoena" }, manager).name).toBe("Zanele M. Mokoena");
    demoDomain.changePassword(input.email, temporaryPassword, "Quarry-Face-2025");
    rejects(() => demoDomain.updateMember(member.id, { name: "Zanele Mokoena" }, manager), 409, /keeps the name/);
  });
});

describe("deleting employees", () => {
  it("deletes an employee nobody refers to, and their password with them", () => {
    const { member } = demoDomain.addMember(input, manager);
    demoDomain.deleteMember(member.id, manager);
    expect(demoDomain.organisation().members.some((item) => item.id === member.id)).toBe(false);
    rejects(() => demoDomain.authenticate(input.email, FIXTURE_PASSWORD), 401);
  });

  it("never deletes someone who appears in shifts, issues or equipment history", () => {
    rejects(() => demoDomain.deleteMember(find("Lebo Maseko").id, manager), 409, /Turn off access/);
    rejects(() => demoDomain.deleteMember(find("Amina Patel").id, manager), 409, /Turn off access/);
  });

  it("keeps a deactivated person's records whole but removes them from new choices", () => {
    const thabo = find("Thabo Molefe");
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

describe("my own profile", () => {
  it("lets someone change their own password when they know the current one", () => {
    const lebo = find("Lebo Maseko");
    rejects(() => demoDomain.changeOwnPassword(lebo.email, "wrong", "Quarry-Face-2025"), 401, /current password/);
    rejects(() => demoDomain.changeOwnPassword(lebo.email, FIXTURE_PASSWORD, "short"), 400, /at least 10/);
    rejects(() => demoDomain.changeOwnPassword(lebo.email, FIXTURE_PASSWORD, FIXTURE_PASSWORD), 400, /not used before/);
    demoDomain.changeOwnPassword(lebo.email, FIXTURE_PASSWORD, "Quarry-Face-2025");
    expect(demoDomain.authenticate(lebo.email, "Quarry-Face-2025").account?.name).toBe("Lebo Maseko");
    rejects(() => demoDomain.authenticate(lebo.email, FIXTURE_PASSWORD), 401);
    expect(demoDomain.organisation().activity[0].summary).toMatch(/Lebo Maseko changed their password/);
  });

  it("lets someone update only their own phone number", () => {
    const saved = demoDomain.updateOwnDetails({ phone: "+27 82 111 2222", role: "Mine Manager", name: "Someone Else" }, amina);
    expect(saved).toMatchObject({ name: "Amina Patel", phone: "+27 82 111 2222", role: "Shift Supervisor" });
  });
});

