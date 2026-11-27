/**
 * VESPER is one product with two workspaces: Mining Operations (production, shifts, equipment, stock, loading and dispatch) and Trade
 * (clients, agreements and their fulfilment commitments, commercial logistics, customer acceptance and settlement).
 *
 * The workspace is read from the address, so a refresh, the browser's back button and a shared link always open the right one:
 * pages under /trade/ belong to Trade; every other signed-in page belongs to Mining Operations, whose pages keep the addresses they
 * have always had (/overview, /exceptions, ...). /operations/overview is accepted as a link to the Mining Operations Overview.
 * Switching workspace keeps the session, the organisation, the selected site and the person's role: it only changes the page.
 */
export type WorkspaceKey = "operations" | "trade";

export type WorkspaceInfo = { key: WorkspaceKey; label: string; home: string; description: string };

export const workspaces: Record<WorkspaceKey, WorkspaceInfo> = {
  operations: { key: "operations", label: "Mining Operations", home: "/overview", description: "Production, shifts, equipment and dispatch" },
  trade: { key: "trade", label: "Trade", home: "/trade/overview", description: "Clients, agreements, deliveries and settlement" },
};

export const workspaceOf = (pathname: string): WorkspaceKey => (pathname === "/trade" || pathname.startsWith("/trade/") ? "trade" : "operations");

/** Roles that work in Trade. Everyone who can sign in to the desktop works in Mining Operations. */
export const TRADE_ROLES = ["Mine Manager", "Commercial / Finance Officer", "Stores / Inventory Controller"] as const;

export const canUseTrade = (role: string) => (TRADE_ROLES as readonly string[]).includes(role);

/** The workspaces this role may open, in menu order. A role with one workspace sees no switcher. */
export function workspacesFor(role: string): WorkspaceInfo[] {
  return canUseTrade(role) ? [workspaces.operations, workspaces.trade] : [workspaces.operations];
}
