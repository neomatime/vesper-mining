# VESPER deployment architecture

**Status:** a documented process and a validated manifest. **Nothing is provisioned.** No project, environment, branch, variable, database or credential is created, changed or implied by this work, and no automatic production deployment is configured.
**Updated:** 14 November 2026, with the product owner's decision on Vercel UAT. The tenancy and deployment wording is still **proposed** for the TRD: see `VESPER_PROPOSED_SPECIFICATION_AMENDMENTS.md`, amendment 5.

## 1. The arrangement

One centrally maintained codebase. For each client organisation:

| Item | Count |
| --- | --- |
| Vercel project | **1** |
| Production environment, deployed from the approved production release | 1, with its own database |
| UAT environment, deployed from a dedicated `staging` branch | 1, restricted, with its own database |
| Databases | 2 (UAT and production), never per site |
| Mining sites | As many as the subscription licenses, all inside the client's databases |

Both environments run the **same release** against **compatible schema versions**. UAT never uses the production database. A site never has its own project, environment or database.

## 2. How UAT works on Vercel

The simplest approach that works on the current plan:

- **Production** deploys from the approved production release (`main`).
- **UAT** deploys from a long-lived **`staging` branch**. Vercel builds every branch as a Preview, so `staging` is the UAT environment.
- **Environment-specific configuration** uses Vercel's **Preview environment variables scoped to the `staging` branch** for UAT, and Production variables for production. The variable **names** are the same in both. Only the values differ, and only the UAT values point at the UAT database.
- **UAT is restricted.** It uses deployment protection or restricted access, never a hidden address (TRD 18.1), and is not indexed.

**Verified, not assumed.**
- Vercel's documentation states that **only Preview variables can target a Git branch**: `vercel env add NAME --environment preview --git-branch staging`.
- The team's limit for **Custom Environments is 0** (read from the Vercel project's account limit). Custom Environments are therefore not available on this plan, and branch-scoped Preview variables are the only approach. If the plan changes and Custom Environments become available, they are worth it only if they bring a demonstrated operational benefit.
- Whether branch-scoped Preview variables are available on the plan in use has not been confirmed by a live change, because none was made. Confirm it when the first client project is created.

**Standard variable names** (the names the manifest lists; values are never written down):

| Name | Meaning |
| --- | --- |
| `VESPER_ENVIRONMENT` | `uat` or `production` |
| `VESPER_ORGANISATION_ID` | The client |
| `VESPER_DATABASE_URL` | Connection to that environment's database (a secret, held in Vercel, never in Git) |

The application does not read these yet. They are the agreed names for the production phase.

## 3. The deployment manifest

`deployment/templates/client-deployment.example.json` is the template for one client. The rules are code, in `packages/api-contracts/src/deployment.ts`, and tests run the template through them.

| Field | Meaning |
| --- | --- |
| `organisation.id`, `displayName` | The client |
| `subscription.id`, `edition`, `contractedSites` | The approved subscription. The edition must match. Group needs a licensed number (at least 7) |
| `release.appVersion` | The approved release the client runs |
| `hosting.provider`, `projectName` | Vercel, and the one project for this client |
| `environments.uat` | Address (empty until provisioned), **branch** (`staging`), a **database reference name**, restricted access, and the **variable names** |
| `environments.production` | Address, **branch** (the production release branch), a database reference name, and the variable names |
| `sites` | The first sites, by code and name only. At most the licensed number. Fewer is allowed |
| `status` | `draft`, `ready_for_provisioning`, `provisioned`, `uat_validated`, `live`, `suspended` |

The validator refuses: an unknown subscription, a mismatched edition, a Group without a valid licensed number, more sites than licensed, UAT and production sharing a database, an address or a branch, UAT on `main`, different variable names between the two environments, database references not ending `-uat-db` and `-prod-db`, any key or value that looks like a secret, and anything that gives a site its own database or environment.

**A manifest never holds a password, token, key or connection string.**

A client's **entitlement record** is separate (`client-entitlements.example.json`) because it changes for different reasons and has its own approval and audit history. The manifest says which plan a client has. The entitlement record says what that client may use.

## 4. The process

| Step | What happens | Phase |
| --- | --- | --- |
| 1. New client | HIMARK receives an approved customer agreement | Paperwork |
| 2. Subscription | The agreed subscription sets the default configuration. For Group, the licensed site count is recorded | Paperwork |
| 3. Manifest and entitlement record | Both templates are copied and filled in, validated and reviewed by a second engineer | Paperwork |
| 4. Infrastructure | One Vercel project is created. The `staging` branch and its branch-scoped Preview variables are set up for UAT, Production variables for production | **Future, authorised production phase only** |
| 5. Databases | The standard schema, at the release's version, is applied to the UAT and production databases | **Future only** |
| 6. Activation | The subscription record is created with the plan's entitlements and any approved overrides. The first sites are created | **Future only** |
| 7. Initial setup | The client's administrator configures sites (within the licence), areas, employees, permissions and shift structures through VESPER's administration | Future |
| 8. UAT and go-live | The client validates in UAT. HIMARK confirms entitlements, site limits and permissions. The same release is promoted to production | **Future only** |

The full checklist is `deployment/DEPLOYMENT_CHECKLIST.md`.

## 5. Subscription upgrades

An upgrade is a configuration change, not a rebuild. Operations – Single Site to Operations raises the allowance from 1 to 3. Core to Operations adds the coordination capabilities. Enterprise to Group adds the Group capabilities and the licensed capacity. The code, the schema and the data stay as they are. A future production change is an authorised HIMARK action, recorded with a reason, an effective date and approval, with a site-count check for downgrades. There is no billing integration.

## 6. Enterprise and Group tailoring

Configuration first (a client entitlement record), then a new feature code shipped to everyone, then a defined extension point when a second client needs it. **No client gets a fork.** Every customisation must keep working as the product releases and is covered by the compatibility tests below.

## 7. Versioning and release management

1. **One version number** for the product, in semantic form (`1.4.0`). A release is a Git tag on `main`.
2. **Approved releases.** A version is approved only after CI passes (typecheck, lint, unit tests, build, browser tests) and a release note exists. Only approved versions appear in a client manifest.
3. **Client version tracking.** A single register (a private repository or table) lists every client, version, environment status and date. It is the answer to "who runs what".
4. **UAT validation.** A version reaches the client's `staging` branch first, is validated, and only then promoted to production. Same build, same release.
5. **Production promotion** is a deliberate, recorded step per client. **No automatic production deployment across client projects.**
6. **Database migration compatibility.** Each release declares the schema version it needs. Migrations are additive and reversible where possible, applied to UAT first, then production. A release must run against the previous schema version for one release.
7. **Recovery and rollback.** Keep the previous approved build for instant redeploy. Back up before every production migration. A data rollback is a planned restore.
8. **Enterprise and Group compatibility.** Before approving a release, run the standard suite plus each tailored client's own entitlement and extension tests.

## 8. Not done, and not authorised

No live deployment credentials were created or changed. No project, branch, variable or environment was provisioned. No database was created. No automatic cross-client deployment exists. The `staging` branch described here has **not** been created, because creating it would start a deployment. All of this needs explicit authorisation in a production phase.

## 9. Required before production

An approved secrets store, a chosen database product and migration method, server-side enforcement of subscriptions and roles, real authentication, backups and a tested restore, the client version register, confirmation of branch-scoped Preview variables on the plan in use, and a release approval process that is actually run.
