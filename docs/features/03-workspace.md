# FSD 03 — Workspace

CRUD module (org subdivision). Builds on [00-conventions.md](./00-conventions.md).

1. **Purpose** — Subdivide an organization into workspaces (department, office, product line, client portfolio) that scope projects and membership, and provide a workspace home.
2. **User Story** — *As a manager I can create workspaces to organize projects and control who sees what; as a member I work inside the workspaces I belong to.*
3. **Actors** — Owner/Admin/Manager (`workspace.create/update/delete`), Workspace Admin (`workspace.member.manage`, scoped), Member (read if a member or org-visible).
4. **Preconditions** — Active org member with the relevant permission for writes.
5. **Main Flow (see CRUD breakout).** Workspace home shows tabs: Projects · Teams · Members · Activity.
6. **Alternative Flow** — A member without workspace membership can still see a project inside it if the project's visibility is `organization`, or if they're a project member — workspace membership is one of several visibility paths (see `can_view_project`).
7. **Validation Rules** — name 2–80; slug unique per org (auto-derived, editable); color ∈ palette; description ≤ 500. Schema `workspaceSchema`, `workspaceMemberSchema`.
8. **Business Rules** — Every project belongs to exactly one workspace; the project's `organization_id` is derived from the workspace (trigger). One default workspace ("General") is created at org bootstrap and cannot be deleted while it's the only one.
9. **Permission Rules** — create `workspace.create`; update `workspace.update` (scoped); delete `workspace.delete`; member management `workspace.member.manage` (scoped to the workspace).
10. **Database Tables Used** — `workspaces`, `workspace_members`, `projects` (counts), `roles`, `teams` (workspace tab).
11. **Server Actions Used** — `createWorkspace`, `updateWorkspace`, `archiveWorkspace`, `addWorkspaceMember`, `changeWorkspaceMemberRole`, `removeWorkspaceMember`; queries `listWorkspaces`, `getWorkspace`.
12. **UI Components Used** — Workspace switcher, workspace home (tabs), workspace form modal, member management drawer, project cards/table, `EmptyState`.
13. **Notifications Triggered** — Optional `member_added` notice to the added user (in-app). None required in MVP.
14. **Activity Logs Generated** — `workspace.created` / `workspace.updated` (internal, org-scoped) — optional; project-level activity remains the primary feed.
15. **Realtime Events** — None (config-level; refresh on navigation).
16. **Loading State** — Standard Loading; tab content streams; header skeleton.
17. **Empty State** — No projects in workspace → "No projects yet" + Create (permitted). No workspaces beyond default → the switcher shows only "General".
18. **Error State** — `VALIDATION`, `CONFLICT` (slug), `FORBIDDEN`, `NOT_FOUND`; archived/no-access workspace → "You don't have access to this workspace".
19. **Success State** — create/update → toast + revalidate; member add/remove → optimistic list update + toast.
20. **Edge Cases** — Deleting/archiving a workspace containing projects → warn + require moving/confirming; last (default) workspace can't be deleted; removing a workspace member who is a project member elsewhere doesn't remove project access; slug collision → auto-suffix.
21. **Acceptance Criteria** — (a) a project created in a workspace inherits its org; (b) workspace-visibility projects are visible to workspace members and hidden from non-members; (c) archived workspaces disappear from default lists but are restorable; (d) default workspace is protected.
22. **QA Checklist** — Base +: visibility matrix (org vs workspace vs private) tested; default-workspace protection; slug uniqueness; scoped permission (`workspace.update` only affects that workspace).
23. **Future Improvements** — Workspace-level default workflow/fields, per-workspace branding, cross-workspace project moves with history, workspace templates, guest workspaces.

## CRUD breakout
- **Create** — `createWorkspace` (name, description?, color?). Permission `workspace.create`. Creator auto-added as workspace admin. Activity `workspace.created`.
- **Read** — `listWorkspaces` (org), `getWorkspace` (members, projectCount). RLS: org members.
- **Update** — `updateWorkspace` (patch). Permission `workspace.update` (scoped). `CONFLICT` on slug.
- **Delete** — `workspace.delete`; blocked/guarded if it holds projects (offer to move) and if it's the last workspace.
- **Archive** — `archiveWorkspace` sets `is_archived` (hidden from default views, projects retained). **Restore** clears it (`workspace.update`).
- **Duplicate** — N/A (MVP). Roadmap: clone settings + membership, not projects.
- **Bulk** — N/A (few workspaces per org).
- **Members** — add/change-role/remove via `workspace_members`; per-row permission `workspace.member.manage`; bulk add supported (partial-success report).

## State transitions
`workspace`: `active ⇄ archived` (`archiveWorkspace`/restore, permission `workspace.update`, DB `is_archived`, no notif, audit `workspace.archived`, no realtime); `active → deleted` (soft, guarded by project-count + last-workspace).
