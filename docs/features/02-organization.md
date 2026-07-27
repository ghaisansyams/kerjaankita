# FSD 02 — Organization

CRUD module (tenant root). Builds on [00-conventions.md](./00-conventions.md).

1. **Purpose** — Create and administer a tenant, its identity/branding, business-rule settings, and industry terminology; and let a user switch between the organizations they belong to.
2. **User Story** — *As a user I can create an organization and, as its admin, configure it; as any member I can switch between my organizations.*
3. **Actors** — Any authenticated user (create), Owner/Admin (`organization.update`, `organization.settings.update`, `organization.delete`), Member (read + switch), System (bootstrap function).
4. **Preconditions** — Authenticated. For update/settings/delete: active member with the permission. For switch: active membership in the target org.
5. **Main Flow (see CRUD breakout).**
6. **Alternative Flow** — Creating an org with a name whose slug collides → server auto-appends a numeric suffix (user cannot check slugs across tenants). Switching to an org the user was just removed from → RLS returns nothing → fall back to first membership or `/onboarding`.
7. **Validation Rules** — name 2–80; industryKey ∈ seeded industries; settings: `weekStart` 0–6, `healthTolerancePoints` 0–100, `capacityHoursPerWeek` > 0, `terminology`/`features` are JSON maps of string→string / string→bool. Schemas: `createOrganizationSchema`, `updateOrganizationSchema`, `orgSettingsSchema`.
8. **Business Rules** — `bootstrap_organization` atomically creates org + settings + default workspace + **industry-specific workflow** + owner membership; a user may only create an org **for themselves** (enforced in the SECURITY DEFINER function). Terminology + settings are the industry-adaptation surface (Project→Site, tolerance, capacity). Health tolerance and capacity here feed BR-5/BR-6 everywhere.
9. **Permission Rules** — create: any authenticated (self-owner); update: `organization.update`; settings: `organization.settings.update`; delete: `organization.delete` (owner); switch: membership only.
10. **Database Tables Used** — `organizations`, `organization_settings`, `organization_members`, `workspaces`, `workflows`, `workflow_statuses`, `industries`, `roles`, `role_permissions`.
11. **Server Actions Used** — `createOrganization` (→ RPC `bootstrap_organization`), `updateOrganization`, `updateOrganizationSettings`, `setActiveOrganization`, `deleteOrganization`; queries `listMyOrganizations`, `getOrganization`.
12. **UI Components Used** — Onboarding page + `CreateOrganizationForm` (industry select), org switcher (in `NavUser`), Settings → Organization panels (profile, branding, terminology editor with live preview), `ConfirmDialog` (typed-name for delete).
13. **Notifications Triggered** — None for org CRUD itself (member changes handled in Member Management).
14. **Activity Logs Generated** — Org-level create/update may emit `organization.updated` (optional, internal). Org create is the genesis event; per-project activity begins later.
15. **Realtime Events** — Optional `organization_settings` change on the active org (low value; refresh-on-focus suffices). None required.
16. **Loading State** — Standard Loading; create shows "Creating…" then routes to `/dashboard`; settings panels save per-section.
17. **Empty State** — No organizations → Onboarding hero "Create your organization". Org switcher lists memberships + "New organization".
18. **Error State** — create: `VALIDATION`, `FORBIDDEN` (spoofed owner); update/settings: `FORBIDDEN`, `NOT_FOUND`; delete: typed-name mismatch → `VALIDATION`; switch: not-a-member → silent reroute to dashboard.
19. **Success State** — create → active-org cookie set + dashboard; update/settings → toast + revalidate; delete → soft-deleted + redirect to org picker; switch → cookie set + dashboard, whole shell re-scopes.
20. **Edge Cases** — Slug collision (auto-suffix); user in zero orgs after leaving/removal → onboarding; last owner tries to delete/leave (guarded — see Member Management); stale org cookie (invalid) → fall back; concurrent settings edits (last-write-wins on scalar fields, JSON maps replaced wholesale).
21. **Acceptance Criteria** — (a) create yields a fully working tenant (workspace + industry workflow + owner) in one call; (b) a user cannot create an org owned by someone else; (c) terminology edits propagate to all screens' nouns; (d) switching re-scopes every subsequent query; (e) soft-deleted org disappears from the switcher.
22. **QA Checklist** — Base +: bootstrap atomicity (no partial tenants on failure); ownership guard tested; slug auto-dedupe tested; terminology live-preview matches saved output; cross-tenant isolation after switch.
23. **Future Improvements** — Custom domains/subdomains, org logo via branding bucket, billing/plans/quotas, ownership transfer UI, org-level audit export, SCIM provisioning, org deletion grace period + purge job.

## CRUD breakout

- **Create** — Trigger: onboarding submit / "New organization". Actor: any authenticated (self-owner). Validation: `createOrganizationSchema`. DB: full bootstrap (9 tables). Notif: none. Activity: genesis. Realtime: none. States: standard; routes to dashboard. Edge: slug collision → suffix; spoofed owner → `FORBIDDEN`. AC: one atomic tenant.
- **Read** — Query `getOrganization` (with settings) + `listMyOrganizations`. RLS: members only. Guests read a minimal org profile via portal, not here.
- **Update** — `updateOrganization` (name/logo/website). Permission `organization.update`. Activity `organization.updated`. Revalidate shell.
- **Settings update** — `updateOrganizationSettings` (timezone/capacity/tolerance/terminology/features). Permission `organization.settings.update`. Drives business rules globally.
- **Delete** — Soft delete, owner only, typed-name confirm; cascades via background job; redirect to picker.
- **Archive / Restore** — N/A (orgs are soft-deleted, not archived; restore is an admin/support operation within retention).
- **Duplicate** — N/A.
- **Bulk** — N/A (single-tenant operations).
- **Switch (special)** — `setActiveOrganization(orgId)`: validate membership → set cookie → revalidate layout → dashboard.

## State transitions
`organization`: `active → deleted` (soft). Trigger: owner delete. Guard: typed-name + owner permission. DB: `deleted_at`. Notif: none. Audit: `organization.deleted` (internal). Realtime: none (user is redirected).
