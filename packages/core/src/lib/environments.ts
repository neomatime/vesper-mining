/**
 * The two VESPER environments and where each one's sign-in page lives.
 *
 * UAT and Production are separate deployments (see deployment/README.md), so choosing one navigates to that
 * deployment's own /sign-in. Nothing here switches environment on the client: the destination is a different
 * origin, with its own sessions, storage and backend.
 *
 * Configuration (build-time, public, never a secret):
 *   NEXT_PUBLIC_VESPER_ENVIRONMENT      "uat" or "production": what THIS deployment is. Defaults to production.
 *   NEXT_PUBLIC_VESPER_PRODUCTION_URL   Production origin. Unset means this deployment is Production.
 *   NEXT_PUBLIC_VESPER_UAT_URL          UAT origin. Unset means UAT is not provisioned, and the option is disabled
 *                                       rather than routed somewhere it does not belong.
 */

export type EnvironmentId = "uat" | "production";

export const environmentIds: EnvironmentId[] = ["uat", "production"];

export const environmentDetails: Record<EnvironmentId, { title: string; badge: string; description: string }> = {
  uat: { title: "UAT Environment", badge: "TEST", description: "Testing, validation and user acceptance." },
  production: { title: "Production Environment", badge: "LIVE", description: "Live operational environment." },
};

/** An origin like https://host (no path, query or fragment), or null if the value is not a usable web origin. */
export function parseOrigin(value: string | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export type EnvironmentSettings = { current?: string; uatUrl?: string; productionUrl?: string };

export function currentEnvironment(settings: EnvironmentSettings = publicSettings()): EnvironmentId {
  return settings.current?.trim().toLowerCase() === "uat" ? "uat" : "production";
}

/** The sign-in address for an environment, or null when it has not been configured. */
export function signInDestination(id: EnvironmentId, settings: EnvironmentSettings = publicSettings()): string | null {
  const configured = parseOrigin(id === "uat" ? settings.uatUrl : settings.productionUrl);
  if (configured) return `${configured}/sign-in`;
  // No address set: only the environment this deployment is can be reached, and it is reached on this origin.
  return currentEnvironment(settings) === id ? "/sign-in" : null;
}

/** Next only inlines these when they are read by their literal names. */
export function publicSettings(): EnvironmentSettings {
  return {
    current: process.env.NEXT_PUBLIC_VESPER_ENVIRONMENT,
    uatUrl: process.env.NEXT_PUBLIC_VESPER_UAT_URL,
    productionUrl: process.env.NEXT_PUBLIC_VESPER_PRODUCTION_URL,
  };
}
