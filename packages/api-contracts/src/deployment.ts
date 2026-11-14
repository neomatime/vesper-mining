import { z } from "zod";
import { resolveSubscription, SubscriptionConfigError } from "./subscription/entitlements";
import { editionSchema, subscriptionIdSchema } from "./subscription/types";

/**
 * The client deployment manifest: everything HIMARK records to prepare one client's instance, and nothing secret.
 *
 * The shape follows the standard arrangement: one hosting project per client organisation, one UAT environment (deployed from a
 * dedicated staging branch using Preview variables scoped to that branch) and one production environment, each with its own database. Mining sites are records inside those databases, so a site has no
 * environment and no database of its own. This file only describes and checks a manifest. It does not provision anything.
 */

const slug = z
  .string()
  .regex(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/, "Use lower case letters, digits and hyphens only.");

const variableName = z.string().regex(/^[A-Z][A-Z0-9_]*$/, "Use upper case letters, digits and underscores.");
const branchName = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._/-]{0,98}$/, "Use a branch name such as staging.");

const environmentBase = {
  /** The environment's address once it exists. Empty until provisioning. */
  url: z.string().url().startsWith("https://", "Use an https address.").nullable(),
  /** The Git branch this environment deploys from. UAT uses a dedicated staging branch. Production uses the approved release branch. */
  branch: branchName,
  /**
   * The names of the environment variables this environment needs, and nothing else. Values are never recorded here. UAT gets its
   * values from Preview variables scoped to its branch, and production from Production variables.
   */
  variables: z.array(variableName),
};

export const deploymentStatusSchema = z.enum(["draft", "ready_for_provisioning", "provisioned", "uat_validated", "live", "suspended"]);

export const clientDeploymentSchema = z
  .object({
    manifestVersion: z.literal(1),
    organisation: z.object({ id: slug, displayName: z.string().trim().min(2) }).strict(),
    subscription: z
      .object({
        id: subscriptionIdSchema,
        edition: editionSchema,
        /** Required for Group. For every other subscription it is empty, or equal to the fixed allowance. */
        contractedSites: z.number().int().positive().nullable(),
      })
      .strict(),
    release: z.object({ appVersion: z.string().regex(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/, "Use a version such as 1.4.0.") }).strict(),
    hosting: z.object({ provider: z.literal("vercel"), projectName: slug }).strict(),
    environments: z
      .object({
        uat: z
          .object({
            ...environmentBase,
            /** A reference to the UAT database, not a connection string. It must end in -uat-db. */
            databaseRef: slug.regex(/-uat-db$/, "The UAT database reference must end in -uat-db."),
            accessControl: z.literal("restricted"),
          })
          .strict(),
        production: z
          .object({
            ...environmentBase,
            /** A reference to the production database, not a connection string. It must end in -prod-db. */
            databaseRef: slug.regex(/-prod-db$/, "The production database reference must end in -prod-db."),
          })
          .strict(),
      })
      .strict(),
    /** The mining sites to set up first. Names only: a site is a record inside the client's databases. */
    sites: z.array(z.object({ code: slug, name: z.string().trim().min(2) }).strict()).default([]),
    status: deploymentStatusSchema,
  })
  .strict()
  .superRefine((manifest, context) => {
    const { subscription, environments } = manifest;

    let allowance: number | null = null;
    let planEdition: string | null = null;
    try {
      const resolved = resolveSubscription({ subscriptionId: subscription.id, contractedSites: subscription.contractedSites });
      allowance = resolved.siteAllowance;
      planEdition = resolved.plan.edition;
    } catch (error) {
      if (!(error instanceof SubscriptionConfigError)) throw error;
      context.addIssue({ code: "custom", path: ["subscription", "contractedSites"], message: error.message });
    }

    if (planEdition && subscription.edition !== planEdition) {
      context.addIssue({ code: "custom", path: ["subscription", "edition"], message: `The ${subscription.id} subscription is the ${planEdition} edition, not ${subscription.edition}.` });
    }
    if (allowance !== null && manifest.sites.length > allowance) {
      context.addIssue({ code: "custom", path: ["sites"], message: `${manifest.sites.length} sites are listed but the subscription allows ${allowance}.` });
    }
    if (new Set(manifest.sites.map((site) => site.code)).size !== manifest.sites.length) {
      context.addIssue({ code: "custom", path: ["sites"], message: "Site codes must be unique." });
    }
    if (environments.uat.branch === environments.production.branch) {
      context.addIssue({ code: "custom", path: ["environments", "uat", "branch"], message: "UAT needs its own branch. It cannot deploy from the production branch." });
    }
    if (environments.uat.branch === "main" || environments.uat.branch === "master") {
      context.addIssue({ code: "custom", path: ["environments", "uat", "branch"], message: "UAT cannot deploy from main. Use a dedicated staging branch." });
    }
    for (const [name, environment] of Object.entries(environments)) {
      if (new Set(environment.variables).size !== environment.variables.length) {
        context.addIssue({ code: "custom", path: ["environments", name, "variables"], message: "Variable names must be unique." });
      }
    }
    const uatNames = [...environments.uat.variables].sort().join(",");
    const productionNames = [...environments.production.variables].sort().join(",");
    if (uatNames !== productionNames) {
      context.addIssue({ code: "custom", path: ["environments", "uat", "variables"], message: "UAT and production must use the same variable names, with different values." });
    }
    if (environments.uat.databaseRef === environments.production.databaseRef) {
      context.addIssue({ code: "custom", path: ["environments", "uat", "databaseRef"], message: "UAT must not use the production database." });
    }
    if (environments.uat.url && environments.uat.url === environments.production.url) {
      context.addIssue({ code: "custom", path: ["environments", "uat", "url"], message: "UAT and production need different addresses." });
    }
  });

export type ClientDeployment = z.infer<typeof clientDeploymentSchema>;

// ---- secrets: a manifest is committed to source control, so it must not hold any ----------------------------------------------

const SECRET_KEY = /(password|passwd|secret|token|api[-_]?key|private[-_]?key|connection[-_]?string|credential|\bdsn\b)/i;
const SECRET_VALUE: [RegExp, string][] = [
  [/\b(postgres(ql)?|mysql|mariadb|mongodb(\+srv)?|redis|amqps?|sqlserver):\/\//i, "a database connection string"],
  [/[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@/i, "an address with a username and password in it"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "a private key"],
  [/(?<![A-Za-z0-9-])[A-Za-z0-9+/_=]{40,}(?![A-Za-z0-9-])/, "something that looks like a token or key"],
];

/** Finds anything in a manifest that looks like a secret, with where it is. */
export function findSecrets(value: unknown, path = "manifest"): string[] {
  if (typeof value === "string") {
    return SECRET_VALUE.filter(([pattern]) => pattern.test(value)).map(([, what]) => `${path} contains ${what}.`);
  }
  if (Array.isArray(value)) return value.flatMap((item, index) => findSecrets(item, `${path}[${index}]`));
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, inner]) => [...(SECRET_KEY.test(key) ? [`${path}.${key} is named like a secret. Secrets must come from the approved secrets store, never a manifest.`] : []), ...findSecrets(inner, `${path}.${key}`)]);
  }
  return [];
}

export type DeploymentCheck = { ok: true; manifest: ClientDeployment } | { ok: false; errors: string[] };

/** Checks a manifest's shape, its rules between fields and that it holds no secrets. */
export function validateClientDeployment(input: unknown): DeploymentCheck {
  const secrets = findSecrets(input);
  const parsed = clientDeploymentSchema.safeParse(input);
  if (parsed.success && secrets.length === 0) return { ok: true, manifest: parsed.data };
  return {
    ok: false,
    errors: [...secrets, ...(parsed.success ? [] : parsed.error.issues.map((issue) => `${issue.path.join(".") || "manifest"}: ${issue.message}`))],
  };
}
