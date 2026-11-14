# VESPER deployment architecture

**Status:** a documented process and a validated manifest. **Nothing is provisioned.** No project, environment, database or credential is created, changed or implied by this work, and no automatic production deployment is configured.

## 1. The arrangement

One centrally maintained codebase. For each client organisation:

| Item | Count |
| --- | --- |
| Vercel project | **1** |
| Production environment | 1, with its own database |
| UAT environment | 1, controlled, with its own database |
| Databases | 2 (UAT and production), never per site |
| Mining sites | As many as the subscription allows, all inside the client's databases |

Both environments run the **same approved release** against **compatible schema versions**. UAT never uses the production database. A site never has its own project, environment or database.

## 2. The deployment manifest

`deployment/templates/client-deployment.example.json` is the template for one client. The rules are code, in `packages/api-contracts/src/deployment.ts`, and tests run the template through them.

| Field | Meaning |
| --- | --- |
| `organisation.id`, `displayName` | The client |
| `subscription.id`, `edition`, `contractedSites` | The approved subscription. Edition must match. Group needs a contracted number (at least 7) |
| `release.appVersion` | The approved release the client runs |
| `hosting.provider`, `projectName` | Vercel, and the one project for this client |
| `environments.uat`, `.production` | Address (empty until provisioned) and a **database reference name** each. UAT access is restricted |
| `sites` | The first sites, by code and name only. At most the allowance |
| `status` | `draft`, `ready_for_provisioning`, `provisioned`, `uat_validated`, `live`, `suspended` |

The validator refuses: an unknown subscription, a mismatched edition, a Group without a valid contract number, more sites than allowed, UAT and production sharing a database or address, database references not ending `-uat-db` and `-prod-db`, any key or value that looks like a secret, and anything that would give a site its own database or environment.

**A manifest never holds a password, token, key or connection string.** Secrets reach each environment through a secrets mechanism that is still to be approved.

## 3. The process

| Step | What happens | Phase |
| --- | --- | --- |
| 1. New client | HIMARK receives an approved customer agreement | Paperwork |
| 2. Subscription | The agreed subscription sets the default configuration. For Group, the contracted site count is recorded | Paperwork |
| 3. Manifest | The template is copied and filled in, validated and reviewed by a second engineer | Paperwork |
| 4. Infrastructure | The engineering process creates the client's one Vercel project, a restricted UAT environment and a production environment | **Future, authorised production phase only** |
| 5. Databases | The standard schema, at the release's version, is applied to the UAT and production databases | **Future only** |
| 6. Activation | The subscription record is created with the plan's entitlements and any agreed overrides. The first sites are created | **Future only** |
| 7. Initial setup | The client's first administrator configures sites (within the allowance), areas, employees, permissions and shift structures **through VESPER's administration**, not through engineers | Future |
| 8. UAT and go-live | The client validates in UAT. HIMARK confirms entitlements, site limits and permissions. The same release is then promoted to production | **Future only** |

The full checklist is `deployment/DEPLOYMENT_CHECKLIST.md`.

## 4. Subscription upgrades

An upgrade is a configuration change, not a rebuild. Moving Operations – Single Site to Operations raises the site allowance from 1 to 3. Core to Operations gains the Operations capabilities. Enterprise to Group adds the Group configuration and the contracted capacity. The code, the schema and the data stay as they are.

Process for a future production change: an authorised HIMARK action, recorded with a reason and effective date, a site-count check for downgrades, an update to the client's subscription record and manifest, and a note in the client's release record. There is no live billing or subscription-management integration and none is proposed here.

## 5. Enterprise and Group tailoring

Tailoring is configuration first, reusable components second, and a defined extension point only when a second client needs the same thing. **No client gets a fork.** Every customisation must keep working as the standard product releases, which means it is covered by the compatibility tests below. See the subscription architecture for the order of preference.

## 6. Versioning and release management

The goal is to always know which client runs which version, and never to maintain separate software by hand.

1. **One version number** for the product, in the app's package manifest, using semantic versions (`1.4.0`). A release is a Git tag on `main`.
2. **Approved releases.** A version becomes approved only after CI passes (typecheck, lint, unit tests, build, browser tests) and a release note exists. Only approved versions may appear in a client manifest.
3. **Client version tracking.** Each client's manifest records `release.appVersion` and status. A single register (a private repository or table) lists every client, version, environment status and date, and is the answer to "who runs what".
4. **UAT validation.** A new version goes to the client's UAT first. The client and HIMARK validate. Only then is the same build promoted to production. UAT and production never run different code for the same release.
5. **Production promotion** is a deliberate, recorded step per client. There is **no automatic production deployment across client projects.**
6. **Database migration compatibility.** Each release declares the schema version it needs. Migrations are additive and reversible where possible. A migration is applied to UAT, tested, and only then to production. A release must run against the previous schema version for one release, so a rollback of the code never needs a rollback of data.
7. **Recovery and rollback.** Keep the previous approved build available for instant redeploy. Take and test a backup before every production migration. A rollback means redeploying the previous build. A data rollback is a restore, planned in advance, and never improvised.
8. **Enterprise and Group compatibility.** Before approving a release, run the standard test suite plus each Enterprise or Group client's own configuration and extension tests, so a standard release cannot silently break a tailored client.

## 7. Vercel

The intended shape is one project per client with a production environment and a controlled UAT environment. **Which Vercel feature provides UAT (a protected preview branch, a custom environment, or a second project) depends on the plan and has not been verified.** Do not assume a paid feature. Choose and verify the approach against the plan in use before the first client, and record it here. The current repository uses one Vercel project with preview deployments, which is the prototype arrangement.

## 8. Not done, and not authorised

No live deployment credentials were created or changed. No project or environment was provisioned. No database was created. No automatic cross-client deployment exists. All of the above need explicit authorisation in a production phase.

## 9. Required before production

A chosen and verified UAT mechanism, an approved secrets store, an approved database product and migration method, server-side enforcement of subscriptions and roles, real authentication, backups and a tested restore, the client version register, and a release approval process that is actually run.
