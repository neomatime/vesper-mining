// @vitest-environment node

/**
 * Unit tests (Vitest). The deployment manifest rules and the templates in deployment/.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { clientDeploymentSchema, findSecrets, validateClientDeployment } from "@vesper/api-contracts";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..", "..", "..", "..");
/** The manifest is edited as loose JSON, so these tests can break it in ways its types would not allow. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Draft = Record<string, any>;
const example = JSON.parse(readFileSync(join(root, "deployment", "templates", "client-deployment.example.json"), "utf8")) as Draft;

/** A copy of the example with changes applied. */
const make = (change: (draft: Draft) => void) => {
  const draft = structuredClone(example);
  change(draft);
  return draft;
};
const errors = (input: unknown) => {
  const result = validateClientDeployment(input);
  return result.ok ? [] : result.errors;
};
const mentions = (input: unknown, text: RegExp) => errors(input).some((message) => text.test(message));

describe("the example deployment manifest", () => {
  it("is valid, and is the model for every client", () => {
    const result = validateClientDeployment(example);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest.subscription.id).toBe("operations");
      expect(result.manifest.status).toBe("draft");
    }
  });

  it("holds no secrets, and its database references are names, not connection strings", () => {
    expect(findSecrets(example)).toEqual([]);
    expect(JSON.stringify(example)).not.toMatch(/:\/\/[^"]*@|password|token|secret/i);
  });
});

describe("required fields", () => {
  it("are all required: removing any one is refused", () => {
    const required: string[][] = [
      ["manifestVersion"],
      ["organisation"],
      ["organisation", "id"],
      ["organisation", "displayName"],
      ["subscription"],
      ["subscription", "id"],
      ["subscription", "edition"],
      ["release", "appVersion"],
      ["hosting", "provider"],
      ["hosting", "projectName"],
      ["environments", "uat", "databaseRef"],
      ["environments", "uat", "branch"],
      ["environments", "uat", "variables"],
      ["environments", "production", "databaseRef"],
      ["environments", "production", "branch"],
      ["environments", "production", "variables"],
      ["status"],
    ];
    for (const path of required) {
      const draft = make((copy) => {
        let parent = copy;
        for (const key of path.slice(0, -1)) parent = parent[key];
        delete parent[path[path.length - 1]!];
      });
      expect(validateClientDeployment(draft).ok, path.join(".")).toBe(false);
    }
  });

  it("must name a real application version, a hosting provider and a status from the list", () => {
    expect(validateClientDeployment(make((d) => (d.release.appVersion = "latest"))).ok).toBe(false);
    expect(validateClientDeployment(make((d) => (d.hosting.provider = "somewhere-else"))).ok).toBe(false);
    expect(validateClientDeployment(make((d) => (d.status = "launched"))).ok).toBe(false);
  });
});

describe("subscriptions and site allowances", () => {
  it("reject a subscription identifier that is not one of the five", () => {
    expect(validateClientDeployment(make((d) => (d.subscription.id = "platinum"))).ok).toBe(false);
  });

  it("reject an edition that does not match the subscription", () => {
    expect(mentions(make((d) => (d.subscription.edition = "enterprise")), /operations edition, not enterprise/)).toBe(true);
    expect(mentions(make((d) => { d.subscription.id = "core"; d.subscription.edition = "operations"; }), /core edition/)).toBe(true);
  });

  it("accept Group on the Enterprise edition, with a contracted number of sites", () => {
    const group = make((d) => { d.subscription = { id: "group", edition: "enterprise", contractedSites: 12 }; });
    expect(validateClientDeployment(group).ok).toBe(true);
  });

  it("reject Group without a valid contracted number of sites", () => {
    for (const contractedSites of [null, 0, 6, 7.5, -3]) {
      const group = make((d) => { d.subscription = { id: "group", edition: "enterprise", contractedSites }; });
      expect(validateClientDeployment(group).ok, String(contractedSites)).toBe(false);
    }
    expect(mentions(make((d) => { d.subscription = { id: "group", edition: "enterprise", contractedSites: null }; }), /never unlimited/)).toBe(true);
  });

  it("reject a contracted number that contradicts a fixed allowance", () => {
    expect(validateClientDeployment(make((d) => (d.subscription.contractedSites = 5))).ok).toBe(false);
    expect(validateClientDeployment(make((d) => (d.subscription.contractedSites = 3))).ok).toBe(true);
  });

  it("reject more listed sites than the subscription allows, and repeated site codes", () => {
    const tooMany = make((d) => { d.subscription = { id: "core", edition: "core", contractedSites: null }; });
    expect(mentions(tooMany, /2 sites are listed but the subscription allows 1/)).toBe(true);
    expect(mentions(make((d) => (d.sites = [d.sites[0], d.sites[0]])), /unique/)).toBe(true);
  });
});

describe("UAT and production", () => {
  it("stay separate: different databases, and different addresses once they exist", () => {
    expect(mentions(make((d) => (d.environments.uat.databaseRef = d.environments.production.databaseRef)), /UAT must not use the production database/)).toBe(true);
    expect(mentions(make((d) => { d.environments.uat.url = "https://vesper.example.com"; d.environments.production.url = "https://vesper.example.com"; }), /different addresses/)).toBe(true);
  });

  it("name each database for its environment, so one cannot be mistaken for the other", () => {
    expect(validateClientDeployment(make((d) => (d.environments.uat.databaseRef = "example-mining-prod-db"))).ok).toBe(false);
    expect(validateClientDeployment(make((d) => (d.environments.production.databaseRef = "example-mining-uat-db"))).ok).toBe(false);
  });

  it("keep UAT access restricted", () => {
    expect(validateClientDeployment(make((d) => (d.environments.uat.accessControl = "public"))).ok).toBe(false);
  });
});

describe("UAT from a staging branch with its own variables", () => {
  it("deploys UAT from a dedicated staging branch and production from the production branch", () => {
    expect(example.environments.uat.branch).toBe("staging");
    expect(example.environments.production.branch).toBe("main");
    expect(validateClientDeployment(example).ok).toBe(true);
  });

  it("refuses UAT on the production branch, or on main", () => {
    expect(mentions(make((d) => (d.environments.uat.branch = "main")), /UAT needs its own branch/)).toBe(true);
    expect(mentions(make((d) => { d.environments.production.branch = "release"; d.environments.uat.branch = "main"; }), /UAT cannot deploy from main/)).toBe(true);
  });

  it("keeps environment-specific configuration to variable names, the same in both environments, with no values", () => {
    expect(mentions(make((d) => d.environments.uat.variables.pop()), /same variable names/)).toBe(true);
    expect(mentions(make((d) => d.environments.uat.variables.push(d.environments.uat.variables[0])), /unique|same variable names/)).toBe(true);
    expect(validateClientDeployment(make((d) => (d.environments.uat.variables[0] = "database url"))).ok).toBe(false);
    expect(validateClientDeployment(make((d) => (d.environments.uat.variables[0] = "VESPER_DATABASE_URL=postgres://x:y@h/db"))).ok).toBe(false);
  });
});

describe("Group licensed and activated sites", () => {
  it("accepts a Group that licenses 10 sites and starts with 4, and refuses more than the licence", () => {
    const four = make((d) => { d.subscription = { id: "group", edition: "enterprise", contractedSites: 10 }; d.sites = ["a", "b", "c", "d"].map((code) => ({ code: `site-${code}`, name: `Site ${code.toUpperCase()}` })); });
    expect(validateClientDeployment(four).ok).toBe(true);
    const eleven = make((d) => { d.subscription = { id: "group", edition: "enterprise", contractedSites: 10 }; d.sites = Array.from({ length: 11 }, (_, i) => ({ code: `site-${i}`, name: `Site ${i}` })); });
    expect(mentions(eleven, /11 sites are listed but the subscription allows 10/)).toBe(true);
  });
});

describe("secrets", () => {
  it("are refused anywhere in a manifest: by key name", () => {
    for (const key of ["password", "apiToken", "connectionString", "privateKey", "clientSecret"]) {
      expect(mentions(make((d) => (d.hosting[key] = "x")), /named like a secret/), key).toBe(true);
    }
  });

  it("are refused anywhere in a manifest: by what the value looks like", () => {
    expect(mentions(make((d) => (d.environments.uat.url = "postgres://user:hunter2@db.example.com/vesper")), /connection string/)).toBe(true);
    expect(mentions(make((d) => (d.organisation.displayName = "https://admin:s3cret@example.com")), /username and password/)).toBe(true);
    expect(mentions(make((d) => (d.hosting.projectName = "x".repeat(8) + "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v2")), /token or key/)).toBe(true);
    expect(mentions(make((d) => (d.organisation.displayName = "-----BEGIN RSA PRIVATE KEY-----")), /private key/)).toBe(true);
  });
});

describe("mining sites", () => {
  it("never get a database or an environment of their own", () => {
    // A site is only a code and a name. The schema has nowhere to put infrastructure for it.
    const siteShape = Object.keys((clientDeploymentSchema.shape.sites.unwrap().element as unknown as { shape: Record<string, unknown> }).shape);
    expect(siteShape.sort()).toEqual(["code", "name"]);
    const environmentNames = Object.keys(clientDeploymentSchema.shape.environments.shape);
    expect(environmentNames.sort()).toEqual(["production", "uat"]);
  });

  it("are refused if a manifest tries to give one a database or an environment", () => {
    expect(validateClientDeployment(make((d) => (d.sites[0].databaseRef = "north-pit-prod-db"))).ok).toBe(false);
    expect(validateClientDeployment(make((d) => (d.sites[0].database = "north-pit"))).ok).toBe(false);
    expect(validateClientDeployment(make((d) => (d.environments["north-pit"] = { url: null, databaseRef: "north-pit-prod-db" }))).ok).toBe(false);
  });

  it("are listed inside one client's manifest, however many there are: one project, one UAT database, one production database", () => {
    const three = make((d) => { d.sites = ["a", "b", "c"].map((code) => ({ code: `site-${code}`, name: `Site ${code.toUpperCase()}` })); });
    const result = validateClientDeployment(three);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest.sites).toHaveLength(3);
      expect(Object.keys(result.manifest.environments)).toEqual(["uat", "production"]);
    }
  });
});
