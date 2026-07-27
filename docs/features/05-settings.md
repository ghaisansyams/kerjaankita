# FSD 05 — Settings (Configuration Hub)

The tenant-configuration surface: profile, branding, terminology, workflows,
roles, custom fields, templates, automation. Builds on [00-conventions.md](./00-conventions.md).

1. **Purpose** — Give admins the controls that make one product fit any industry: rename nouns, redesign workflows, define roles/permissions, add custom fields, and manage templates — all without code.
2. **User Story** — *As an admin I can configure my organization's language, workflow, roles, and fields so the tool matches how we actually work.*
3. **Actors** — Owner/Admin (each sub-area gated independently: `organization.settings.update`, `workflow.manage`, `organization.role.manage`, `customfield.manage`, `template.manage`, `automation.manage`). Read for members where relevant.
4. **Preconditions** — Active org member with the specific sub-area permission.
5. **Main Flow** — Settings shell with left sub-nav (Organization · Workspace · Configuration) → panel per section → edit → save (per-section) → toast + revalidate.
6. **Alternative Flow** — Editing a workflow/status/role that is **in use** requires a safe path (remap statuses on delete; reassign roles on delete); the UI validates the whole config before saving (e.g., a workflow must have exactly one initial status and at least one final status).
7. **Validation Rules** — terminology: string→string map; workflow status: unique key per workflow, valid `category`, exactly one `initial`, ≥1 `final`, `auto_progress` 0–100; transition: valid from/to within the workflow, optional `required_permission` ∈ catalogue; role: unique key, valid scope; custom field: valid type + type-appropriate options/validation; template: valid task offsets. Schemas: `orgSettingsSchema`, workflow/status/transition/role/field/template schemas.
8. **Business Rules** — Terminology drives every user-facing noun. Workflow `status_category` keeps progress/reporting universal even when names change. System roles are **read-only baselines**; only tenant roles are editable. Deleting a status remaps its tasks; deleting a role reassigns its members. Custom field scope cascades org → workspace → project.
9. **Permission Rules** — see Actors; each panel independently gated; **system roles cannot be edited**; changing role permissions requires `organization.role.manage`.
10. **Database Tables Used** — `organization_settings`, `workflows`, `workflow_statuses`, `workflow_transitions`, `roles`, `role_permissions`, `permissions`, `custom_field_definitions`, `project_templates`, `project_template_tasks`, `task_templates`, `automation_rules`, storage `branding`.
11. **Server Actions Used** — `updateOrganizationSettings`; workflow/status/transition CRUD; `createRole`/`updateRole`/`deleteRole`/`setRolePermissions`; custom-field CRUD; template CRUD; automation-rule CRUD. (Contracts: API §2, §5; workflow/field/template CRUD follow the CRUD template.)
12. **UI Components Used** — Settings shell + sub-nav; terminology editor with **live preview**; workflow editor (drag-reorder statuses + transition matrix table); role permission matrix; custom-field builder; template manager; `ConfirmDialog`; toasts.
13. **Notifications Triggered** — None (config changes are silent).
14. **Activity Logs Generated** — Optional internal entries: `settings.updated`, `workflow.updated`, `role.updated`, `customfield.updated` (org-scoped, not guest-visible).
15. **Realtime Events** — None (config; changes apply on next load/navigation).
16. **Loading State** — Standard Loading; matrix editors show placeholder grids; per-section save spinners.
17. **Empty State** — Custom fields/templates empty → "Create your first…" with a benefit explanation; roles list shows read-only system baselines.
18. **Error State** — Invalid workflow (no initial / unreachable status) → inline validation **before** save; permission-key conflict; delete-in-use → remap/reassign prompt; `FORBIDDEN` on system-role edit; save failure → banner + retry.
19. **Success State** — per-section toast + revalidate; terminology preview matches saved values; workflow changes reflected on boards immediately.
20. **Edge Cases** — Removing the only initial status; creating a transition to a non-existent status; two admins editing the same workflow concurrently (last-write-wins with a reload prompt); deleting a status that is a task's current status (block until remap); custom field type change with existing values (warn about coercion); terminology key the UI doesn't use (ignored safely).
21. **Acceptance Criteria** — (a) renaming Project→Site changes the noun app-wide; (b) a construction workflow (Planned→…→Handover) renders on boards and drives progress via categories; (c) a custom role's permission set governs its members' access and RLS honours it; (d) system roles are immutable; (e) invalid workflows can't be saved.
22. **QA Checklist** — Base +: workflow invariants (one initial, reachable finals); status remap on delete; role permission changes reflected in `has_permission`/RLS; custom-field type validation (trigger); terminology propagation; system-role immutability.
23. **Future Improvements** — Per-field permissions, workflow versioning, import/export config, automation execution engine (rules already stored), branded portal themes, org-level audit-log export, per-workspace overrides UI.

## CRUD breakout (per configurable entity)
- **Workflows/Statuses/Transitions** — Create/Update/Delete/Reorder; `workflow.manage`; delete-in-use → remap; reorder updates `position`.
- **Roles** — Create/Update/Delete tenant roles; `setRolePermissions` replaces the grant set; system roles read-only; delete-in-use → reassign members.
- **Custom fields** — Create/Update/Delete definitions per entity/scope; values validated by DB trigger.
- **Templates** — Project/task template CRUD; used by Projects (instantiate) and Tasks.
- **Archive/Restore/Duplicate/Bulk** — Duplicate applies to workflows, roles, templates (clone as a new tenant object); Archive via soft-delete; Bulk N/A (config volumes are small).

## State transitions
Config entities: `active → deleted` (soft, permission-gated, with in-use guards/remaps). No notifications/realtime.
