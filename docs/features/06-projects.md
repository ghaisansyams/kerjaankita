# FSD 06 — Projects

Full CRUD module and primary security boundary. Builds on [00-conventions.md](./00-conventions.md).

1. **Purpose** — Create and manage the work container (project/site/case/campaign) — its scope, schedule, team, account, milestones, visibility, and health.
2. **User Story** — *As a manager I can set up a project with its team, dates, and milestones so work is organized and its health is visible; as a member I can see the projects I'm part of.*
3. **Actors** — Manager/Admin/Owner (`project.create/update/delete`, `project.member.manage`, `milestone.manage`), Project Lead (scoped), Member (read if member/org-visible/workspace-visible), Guest (read own account's projects via portal), Viewer (read-only).
4. **Preconditions** — Active org member; for writes, the relevant permission; a workspace exists; optionally an account and a template.
5. **Main Flow (see CRUD breakout).** Detail page tabs: Overview · Board · Timeline · Files · Activity · Settings.
6. **Alternative Flow** — Create **from template** → `instantiate_project_template` produces tasks/milestones/checklists with dates resolved from offsets. Sub-project: `parent_id` groups a programme. No-account project is allowed (internal).
7. **Validation Rules** — name 2–120; `key` 2–6 uppercase (unique per org, immutable once set); `visibility` ∈ {organization,workspace,private}; `start_date ≤ end_date`; color ∈ palette; `workspaceId`/`accountId`/`templateId`/`ownerId` must be visible/valid. `progress` is **derived, not settable**. Schemas `createProjectSchema`, `updateProjectSchema`.
8. **Business Rules** — `organization_id` derived from workspace (trigger). **Progress = effort-weighted mean of leaf tasks** (BR-2), maintained by trigger. **Health** derived at read time from progress vs schedule + tolerance (BR-5) — never stored. Key + task numbers are immutable. Visibility governs who (beyond members) can see it.
9. **Permission Rules** — create `project.create` (workspace scope); update `project.update`; delete `project.delete`; members `project.member.manage`; milestones `milestone.manage`; read via `can_view_project`. Managers with `project.view.all` see every project.
10. **Database Tables Used** — `projects`, `project_members`, `milestones`, `workspaces`, `accounts`, `profiles`, `workflows`, `workflow_statuses`, `tasks` (counts/progress), `custom_field_values`, `project_templates` (+ template path tables).
11. **Server Actions Used** — `createProject` (± RPC `instantiate_project_template`), `updateProject`, `archiveProject`, `deleteProject` (RPC `soft_delete_project`), `addProjectMember`/`changeProjectMemberRole`/`removeProjectMember`, milestone CRUD; queries `listProjects`, `getProject`.
12. **UI Components Used** — Projects list (cards/table, filter bar, view toggle), new-project modal (template picker), project header (health/progress/avatars), tabs, Overview (description, milestone strip, key tasks, meta rail), member manager, milestone editor, `ProgressRing`, `HealthBadge`, `ConfirmDialog`.
13. **Notifications Triggered** — `project_completed` → owner + managers + guest users of the account (on status→completed). Member add may notify the added user.
14. **Activity Logs Generated** — `project.created`, `project.status_changed`, `project.updated`, `project.deleted`, `member.added/removed`, `milestone.created/reached`.
15. **Realtime Events** — `project:{id}` (progress/status/header + activity feed); `projects` inserts on the org for the list.
16. **Loading State** — Standard Loading; list skeleton cards/rows; detail header + tab skeletons streaming independently.
17. **Empty State** — No projects → "Create your first project" hero + template preview. No-results (filtered) → "No projects match — Clear filters". Empty tabs prompt (add description/milestones/tasks/files).
18. **Error State** — `VALIDATION`, `CONFLICT` (key), `FORBIDDEN`, `NOT_FOUND` (workspace/account/template); no-access detail → "You don't have access"; deleted/missing → friendly 404.
19. **Success State** — create → redirect to `/projects/[id]`; update → toast + revalidate + realtime header; member/milestone ops → optimistic + toast.
20. **Edge Cases** — Duplicate key (`CONFLICT`); dates outside a template's assumptions; project with zero tasks (0% progress, health on_track if no end date); archiving vs deleting; deleting a project with a guest actively viewing (RLS then denies); changing owner to a non-member (auto-add as member or warn); very large template (instantiation runs server-side, progress recomputed once).
21. **Acceptance Criteria** — (a) create-from-template yields dated tasks/milestones atomically; (b) progress reflects effort-weighting, not simple average; (c) health matches BR-5 with the org's tolerance; (d) visibility rules govern non-member access exactly; (e) soft delete hides the project and cascades to its children; (f) key uniqueness enforced.
22. **QA Checklist** — Base +: weighted-progress correctness; health across on_track/at_risk/delayed; visibility matrix; template instantiation (dates, nesting, checklist); key immutability + uniqueness; cascade soft delete; realtime progress on the header.
23. **Future Improvements** — Project portfolios/programmes UI, per-project custom workflow override, budget/cost tracking, project baselines & change log, cross-workspace move with history, project cloning presets, archived-projects view.

## CRUD breakout
- **Create** — Trigger: "New project". Actor: `project.create` (workspace). Validation: `createProjectSchema`. DB: `projects` (+ template path). Notif: none. Activity: `project.created`. Realtime: `projects` insert. States: redirect to detail. Edge: key conflict, template dates. AC: atomic w/ template.
- **Read** — `listProjects` (filters: status, health, owner, workspace, account, tag, search; keyset/offset) + `getProject` (derived health, counts, members, milestones, account, custom fields). RLS `can_view_project`. Guests via portal only.
- **Update** — `updateProject` (name/desc/dates/owner/color/visibility/status). `progress` not settable. Status change → `project.status_changed` (+ completed → notifications).
- **Delete** — `deleteProject` → `soft_delete_project` (cascades tasks/milestones/members/comments/attachments). `project.delete` + typed-name confirm.
- **Archive** — `archiveProject` sets `is_archived` (hidden from default lists, fully restorable, still reportable). **Restore** clears it (`project.update`).
- **Duplicate** — Deep copy: name "(copy)", new key, copy tasks/milestones/checklists/custom-field defaults, **reset** progress/numbers/status to initial, **exclude** comments/attachments/activity/assignees (optional). Permission `project.create`.
- **Bulk** — Bulk archive / change status / add tag / assign owner; per-row `project.update`; partial-success report; single confirm.
- **Members** — add/change-role/remove (`project_members`); `project.member.manage`; `member.added/removed` activity.
- **Milestones** — create/update/delete/reorder; `milestone.manage`; always guest-visible.

## State transitions
| Transition | Trigger | Who | Guard | DB | Notif | Audit | Realtime |
|---|---|---|---|---|---|---|---|
| status (workflow) change | edit / status select | `project.update` | valid project-workflow status | `projects.status_id` | if completed → `project_completed` | `project.status_changed` | `project:{id}` |
| `active ⇄ archived` | archive/restore | `project.update` | — | `is_archived` | — | `project.archived` | list refresh |
| `active → deleted` | delete | `project.delete` | typed-name confirm | `deleted_at` (cascade) | — | `project.deleted` | list refresh |
