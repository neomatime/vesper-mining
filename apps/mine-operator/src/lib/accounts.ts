/**
 * Fixture accounts for the front-end prototype.
 *
 * There is no authentication service behind these. Sign-in is checked in the browser against this
 * list so the product can be experienced end to end. The password below is a shared fixture value,
 * not a secret, and this file must never guard real data. Real identity arrives with the backend
 * (PRD §15.2 excludes it from this phase).
 */
export const FIXTURE_PASSWORD = "Riverside#2025";

export type Account = {
  email: string;
  name: string;
  role: string;
  /** Where this role starts after signing in (App Flow §2.4). */
  home: string;
};

export const accounts: Account[] = [
  { email: "john.dlamini@riverside.example", name: "John Dlamini", role: "Mine Manager", home: "/overview" },
  { email: "amina.patel@riverside.example", name: "Amina Patel", role: "Shift Supervisor", home: "/overview" },
  { email: "sipho.nkosi@riverside.example", name: "Sipho Nkosi", role: "Shift Supervisor", home: "/overview" },
  { email: "lebo.maseko@riverside.example", name: "Lebo Maseko", role: "Maintenance Planner", home: "/overview" },
  { email: "naledi.khoza@riverside.example", name: "Naledi Khoza", role: "Stores / Inventory Controller", home: "/overview" },
  { email: "thabo.molefe@riverside.example", name: "Thabo Molefe", role: "Field Employee", home: "/mobile/my-shift" },
];

export function findAccount(email: string) {
  const wanted = email.trim().toLowerCase();
  return accounts.find((account) => account.email === wanted);
}

/** Checks the fixture credentials. Returns the account, or null when they do not match. */
export function verifyCredentials(email: string, password: string) {
  const account = findAccount(email);
  return account && password === FIXTURE_PASSWORD ? account : null;
}

/** Only same-site paths are valid redirect targets after signing in. */
export function safeNext(value: string | null | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/sign-in") ? value : null;
}
