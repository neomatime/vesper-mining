/**
 * The VESPER apps and where links go between them. Mining Operations (with the Trade workspace) and VESPER Mobile are separate
 * apps at separate addresses that share accounts. Shared screens link with in-app paths (for example /exceptions/:id); each app
 * turns them into its own route, or into the other app's address when the record lives there.
 *
 * The addresses come from NEXT_PUBLIC_OPERATIONS_URL and NEXT_PUBLIC_MOBILE_URL. Running locally (localhost or 127.0.0.1) the
 * apps are on ports 3000 and 3001; in a deployment without the setting, links to the other app are not shown rather than
 * pointing nowhere.
 */
export type VesperApp = "operations" | "mobile";

/** Where a field role lands after signing in to VESPER Mobile. */
export const FIELD_HOME = "/my-shift";

const LOCAL: Record<VesperApp, string> = { operations: "http://127.0.0.1:3000", mobile: "http://127.0.0.1:3001" };

function origin(app: VesperApp) {
  const configured = app === "operations" ? process.env.NEXT_PUBLIC_OPERATIONS_URL : process.env.NEXT_PUBLIC_MOBILE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const local = process.env.NODE_ENV === "development" || (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname));
  return local ? LOCAL[app] : null;
}

/** The full address of a page in another VESPER app, or null when this deployment does not know where that app is. */
export function appUrl(app: VesperApp, path: string): string | null {
  const base = origin(app);
  return base ? `${base}${path}` : null;
}

const MOBILE_ROUTES = ["/my-shift", "/my-work", "/report", "/notifications", "/profile", "/schedule", "/sign-in"];

/**
 * Turns a link written by a shared screen into the right address for the app showing it. Null means there is nowhere to go from
 * here (the record lives in another app whose address is not configured), so the screen shows it as plain text.
 */
export function linkFor(app: VesperApp, href: string): string | null {
  if (/^https?:\/\//.test(href) || href.startsWith("#")) return href;
  const [path, query = ""] = href.split("?");
  const suffix = query ? `?${query}` : "";
  const legacy = path.startsWith("/mobile/") ? path.slice("/mobile".length) : null;
  if (app === "mobile") {
    if (legacy) return legacy + suffix;
    if (path === "/" || MOBILE_ROUTES.includes(path)) return href;
    if (path === "/exceptions/new") return "/report";
    const issue = /^\/exceptions\/([^/]+)$/.exec(path);
    if (issue) return `/issues/${issue[1]}`;
    const shift = /^\/shifts\/([^/]+)$/.exec(path);
    if (shift) return `/shifts/${shift[1]}`;
    if (path === "/shifts") return "/schedule";
    return appUrl("operations", href);
  }
  if (legacy) return appUrl("mobile", legacy + suffix);
  if (MOBILE_ROUTES.includes(path) && path !== "/notifications" && path !== "/profile" && path !== "/sign-in") return appUrl("mobile", href);
  return href;
}
