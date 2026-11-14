# New client deployment checklist

**Status of this checklist:** a process for a future, authorised production phase. In the current prototype phase none of the provisioning steps (4, 5, 8) may be carried out. Steps 1 to 3 can be done as paperwork.

Tick each item when done and record who did it and when. Keep the completed checklist with the client's manifest.

## 1. Agreement
- [ ] The customer agreement is signed and approved by HIMARK.
- [ ] The approved subscription is recorded: Core, Operations – Single Site, Operations, Enterprise or Group.
- [ ] For Group: the licensed number of sites is written in the agreement (at least 7). The client may activate fewer.
- [ ] Any Enterprise or Group tailoring in the agreement is listed, with its owner.

## 2. Prepare the manifest
- [ ] Copy `deployment/templates/client-deployment.example.json` to the client's private manifest.
- [ ] Fill in the organisation, subscription, edition, contracted sites, first sites and release version.
- [ ] Run the manifest through `validateClientDeployment`. It passes.
- [ ] No secret is in the manifest.
- [ ] A second engineer reviews it. Status: `ready_for_provisioning`.

## 3. Choose the release
- [ ] The release version is one that has passed HIMARK's release checks (see release management in the deployment architecture document).
- [ ] The client's manifest records that version.

## 4. Provision (production phase only)
- [ ] One hosting project is created for the client, named in the manifest. **Not one per site.**
- [ ] A dedicated `staging` branch is the UAT source. Its Preview environment variables are scoped to that branch (`vercel env add NAME --environment preview --git-branch staging`), using the variable names in the manifest. Custom Environments are not used.
- [ ] The UAT deployment has restricted access. It is not publicly reachable and is not indexed.
- [ ] A production environment is created.
- [ ] Secrets are loaded through the approved secrets store. None is typed into a chat, ticket or file.
- [ ] Status: `provisioned`.

## 5. Databases (production phase only)
- [ ] A UAT database and a production database are created, **one each for the client**. None per site.
- [ ] The standard VESPER schema is applied to both, at the version the release expects.
- [ ] The UAT environment points only at the UAT database. The production environment points only at the production database. This is checked, not assumed.
- [ ] Backups and restore are configured and a restore has been tested.

## 6. Activate the subscription
- [ ] The subscription record is created for the organisation, with the contracted sites for Group.
- [ ] The entitlements match the plan configuration for that subscription.
- [ ] The client entitlement record is created from the template: agreement reference, effective date, approval and audit history. Any feature override is explicit, has a reason and is approved.
- [ ] The first sites from the manifest are created inside the databases, within the licence.

## 7. Initial setup by the client's administrator
- [ ] The first administrator signs in and sets a password of their own.
- [ ] They add or confirm mining sites (within the allowance), operational areas, employees, roles and shift structures.

## 8. UAT, then go-live (production phase only)
- [ ] The client validates the main workflows in UAT with their own sample data.
- [ ] HIMARK confirms entitlements, site limits and role permissions behave as contracted.
- [ ] Sign-off from the client and from HIMARK is recorded. Status: `uat_validated`.
- [ ] The same release is promoted to production. The same schema version is confirmed.
- [ ] Production is checked and the client is told. Status: `live`.
- [ ] The release is recorded against the client so HIMARK knows who runs which version.

## 9. After go-live
- [ ] Subscription changes follow the upgrade process, never a rebuild.
- [ ] Any client-specific change is configuration or an agreed extension point, never a fork.
