# VESPER client deployments

This folder holds what HIMARK needs to prepare one client's VESPER instance. **It describes a process. It does not provision anything.** No database, project or environment exists because of these files, and the current phase does not create any.

## The arrangement

```text
one VESPER codebase, one standard database schema, five subscription configurations
│
└── per client organisation
    ├── one Vercel project
    ├── UAT environment ──── UAT database
    └── Production environment ──── Production database
                                     └── the client's mining sites (records inside the database)
```

- **One project per client.** A client with three sites still has one project, one UAT database and one production database.
- **A site is a record, not infrastructure.** Never create a project, environment or database for a site.
- **UAT never uses the production database.** Both run the same approved release and the same schema.
- **A subscription is configuration, not a fork.** The subscription decides entitlements and site capacity. The code and the schema are the same for everyone.

## Files

| File | Purpose |
| --- | --- |
| `templates/client-deployment.example.json` | The manifest to copy for each new client. Safe to commit: it holds no secrets. |
| `DEPLOYMENT_CHECKLIST.md` | The steps from signed agreement to go-live, with who does what. |
| `../packages/api-contracts/src/deployment.ts` | The rules a manifest must satisfy. Tests run the example through them. |

## Filling in a manifest

1. Copy the example to `clients/<organisation-id>.deployment.json`. Keep client manifests in a private repository or store, not in this product repository.
2. Set `subscription.id` to the client's approved subscription: `core`, `operations_single`, `operations`, `enterprise` or `group`.
3. Set `subscription.edition` to match: `core`, `operations` (both Operations subscriptions) or `enterprise` (Enterprise and Group).
4. Set `subscription.contractedSites`:
   - **Group:** required. The number of sites in the client's agreement, at least 7.
   - **Every other subscription:** leave it `null`, or set it to the fixed allowance (1, 1, 3 or 6).
5. List the first `sites` by code and name. There must not be more than the allowance. The administrator can add the rest in VESPER.
6. Give each environment a `databaseRef`. It is a **name** for the database, not a connection string. It must end in `-uat-db` or `-prod-db`, and the two must differ.
7. Leave `url` as `null` until the environment exists.
8. Set `status` as the work moves on: `draft`, `ready_for_provisioning`, `provisioned`, `uat_validated`, `live` or `suspended`.

## Secrets

A manifest never contains a password, token, key or connection string. The validator rejects keys that are named like secrets and values that look like connection strings, private keys or tokens. Secrets are supplied to each environment through the approved secrets store at provisioning time. That mechanism is a decision for the production phase (see the deployment architecture document).

## Checking a manifest

The rules are in `packages/api-contracts/src/deployment.ts` (`validateClientDeployment`). To check a manifest, run it through that function. The unit tests in `apps/mine-operator/src/lib/deployment.test.ts` show how, and they check the example in this folder on every test run.

What it enforces: the subscription exists, the edition matches it, a Group has a valid contracted allowance, the listed sites fit the allowance, UAT and production are separate, no field holds a secret, and there is no database or environment per site.

See `docs/architecture/VESPER_DEPLOYMENT_ARCHITECTURE.md` for the full process, upgrades and release management.
