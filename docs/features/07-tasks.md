# FSD 07 — Tasks

The core, highest-volume module. Full CRUD + workflow state machine. Builds on [00-conventions.md](./00-conventions.md).

1. **Purpose** — Create and manage the atomic unit of work (task/activity/work-order/ticket): its status, assignee, priority, dates, effort, progress, checklist, evidence, subtasks, and dependencies.
2. **User Story** — *As an assignee I can update my task's status and progress and attach evidence; as a manager I can create, assign, schedule, and prioritise tasks so work is accountable and trackable.*
3. **Actors** — Manager/Admin/Lead (`task.create/update.any/delete/assign`), Assignee (`task.update.own` — own tasks only), Reviewer/QA (`task.update.any` — the approval gate), Member (read if project-visible), Guest (read own account's tasks, limited fields), System (numbering, progress, activity, notifications).
4. **Preconditions** — Active org member; task's project visible; for edits, the relevant permission; project has a task workflow (from bootstrap).
5. **Main Flow (see CRUD breakout + transitions).** Primary surface is the **Task Detail drawer** (deep-linked `?task=<id>`).
6. **Alternative Flow** — Create from `task_templates` (prefilled title/checklist/estimate). Subtask: `parent_id` under a parent (parent progress aggregates children; only leaves count for project rollup). Quick-add on the board seeds a task in a column's status.
7. **Validation Rules** — title 1–200; `priority` ∈ enum; `statusId` ∈ the project's workflow; `start_date ≤ due_date`; `estimated_hours`/`actual_hours` ≥ 0; `progress` 0–100 in steps of 10; `assigneeId`/`milestoneId`/`parentId` valid & visible; block requires `reason` ≥ 3. `progress`/`number`/`completed_at` are **system-owned**. Schemas: `createTaskSchema`, `updateTaskSchema`, `taskStatusSchema`, `taskProgressSchema`, `assignSchema`, `blockSchema`, `moveSchema`.
8. **Business Rules** — `number` is per-project, immutable, auto-assigned (trigger). Entering a `done` category forces `progress=100` + sets `completed_at`; leaving `done` clears it. A status with `auto_progress` applies it on entry (without clobbering an explicit value on create). Entering a `blocked` category sets `is_blocked` + `blocked_since`. **Transitions are constrained by the workflow's `workflow_transitions`** (trigger rejects illegal moves). **Column-level edit rights:** non-managers may change only status/progress/actual-hours/evidence/checklist on their **own** task — the trigger reverts protected fields.
9. **Permission Rules** — create `task.create`; general edit `task.update.any`; own-task edit `task.update.own` (assignee); status transitions requiring `required_permission` (e.g., "close testing") enforced; assign `task.assign`/`task.update.any`; delete `task.delete`. RLS `tasks_*` + `can_edit_task`.
10. **Database Tables Used** — `tasks`, `task_checklist_items`, `task_dependencies`, `workflows`, `workflow_statuses`, `workflow_transitions`, `projects` (`task_seq`, `progress`), `activities`, `notifications`, `profiles`, `custom_field_values`.
11. **Server Actions Used** — `createTask`, `updateTask`, `updateTaskStatus`, `updateTaskProgress`, `assignTask`, `blockTask`/`unblockTask`, `moveTask`, `deleteTask`, checklist(×5), dependency(×2); queries `listTasks`, `getTask`.
12. **UI Components Used** — Task Detail drawer, inline title edit, status/assignee/priority selects (workflow-aware), date pickers, progress selector, description editor, `ChecklistEditor`, `EvidencePanel`, file upload, comment section, subtask list, dependency chips, `StatusBadge`/`PriorityBadge`, `ConfirmDialog`.
13. **Notifications Triggered** — `task_assigned` (new assignee ≠ actor); `task_completed` (reporter + project owner, on →done); `task_blocked` (owner + lead, on block); `mentioned` (via comments). Deadlines via cron.
14. **Activity Logs Generated** — `task.created`, `task.status_changed`, `task.progress_updated`, `task.assigned`, `task.blocked/unblocked`, `task.deleted` (guest-visibility per catalog).
15. **Realtime Events** — `board:{projectId}` (all task changes) drives live board/list; `project:{id}` header progress refresh; ephemeral drag order via broadcast.
16. **Loading State** — Standard Loading; drawer opens instantly with a skeleton, content streams; status/progress/checklist are **optimistic**.
17. **Empty State** — Project with no tasks → "Create the first task". Task with no description/checklist/subtasks/files/comments → per-section prompts.
18. **Error State** — `TRANSITION_NOT_ALLOWED` ("that move isn't allowed in this workflow"); `VALIDATION` (missing block reason, bad dates); `FORBIDDEN` (read-only field for non-assignee → tooltip); save failure → revert optimistic + toast retry.
19. **Success State** — status/progress → optimistic patch reconciled, activity + notifications fire, project progress recomputed, board/header update via realtime; create → task appears in its initial column with its number.
20. **Edge Cases** — Illegal transition attempt via drag; assignee edits a protected field (silently reverted by trigger — UI must reflect); reopening a done task (managers only, clears completed_at); block without reason; deleting a task with subtasks (cascade soft delete) or dependencies (links removed); dependency cycle (rejected); concurrent status changes (last-write-wins + realtime reconcile); progress set to 100 without `done` (allowed, not auto-completed).
21. **Acceptance Criteria** — (a) numbers auto-increment per project and never repeat; (b) done forces 100% + completed_at; (c) illegal transitions are rejected with a clear message; (d) assignees can change status/progress but not dates/priority; (e) project progress reflects weighted rollup after any task change; (f) notifications reach the right non-actor recipients; (g) board updates in realtime.
22. **QA Checklist** — Base +: per-project numbering; transition legality (allowed + illegal); column-guard (protected-field revert); done/blocked side-effects; weighted rollup; assignment notifications; dependency cycle rejection; optimistic rollback on failure; realtime board.
23. **Future Improvements** — Recurring tasks, task dependencies critical-path, multiple assignees/watchers, time tracking (timer + timesheets), rich subtasks kanban, task-level custom statuses, saved filters, task relations (blocks/duplicates/relates), bulk edit inline.

## CRUD breakout
- **Create** — `createTask`; `task.create`; reporter=self; triggers set number/org/workflow/initial status; notify assignee if set. Activity `task.created`.
- **Read** — `listTasks` (board grouped by status; list filters status-category/assignee/priority/due/tag/search; **My Work** buckets overdue/today/tomorrow/upcoming) + `getTask` (checklist, deps, custom fields, workflow). RLS `can_view_project`; guests see limited fields.
- **Update** — `updateTask` (manager fields) vs `updateTaskProgress` (assignee) vs `assignTask` vs `updateTaskStatus` — separated to mirror column-level rights.
- **Delete** — `deleteTask` soft delete (`task.delete`); recomputes project progress; cascades subtasks; removes dependency links.
- **Archive** — N/A as a distinct flag (tasks use status categories `done`/`cancelled`); "archive" = move to a `cancelled` status if the workflow defines one.
- **Restore** — Undo delete within retention (clears `deleted_at`), `task.delete` permission; recomputes progress.
- **Duplicate** — Copy title/description/priority/estimate/checklist to the same project; new number; reset status→initial, progress→0, assignee cleared (optional); exclude comments/attachments/activity. `task.create`.
- **Bulk** — Bulk status/assignee/priority/tag/delete; per-row permission (own vs any); transition legality per row; partial-success report.
- **Checklist** — add/toggle/update/delete/reorder (`can_edit_task`).
- **Dependencies** — add/remove (`task.update.any`); no self/cycle.

## State transitions (workflow-driven — statuses are tenant-defined; categories are stable)
| Transition (by category) | Trigger | Who | Validation/guard | DB changes | Notification | Audit | Realtime |
|---|---|---|---|---|---|---|---|
| todo → in_progress | select / drag | assignee, manager | allowed transition | status_id (+auto_progress) | — | task.status_changed | board |
| in_progress → review | select / drag | assignee, manager | allowed transition | status_id | — | task.status_changed | board |
| review → in_progress (reject) | select / drag | lead/manager/reviewer | allowed | status_id | — | task.status_changed | board |
| review/testing → done (approve) | select / drag | **reviewer/QA, manager** (may require permission) | allowed + `required_permission` | status_id, progress=100, completed_at | task_completed → reporter+owner | task.status_changed | board, project |
| testing → in_progress/blocked (fail) | select / drag | reviewer/QA, manager | allowed; reason if configured | status_id | task_blocked (if blocked) | task.status_changed | board |
| any → blocked | block action | assignee, QA, manager | **reason required** | is_blocked=true, blocked_since | task_blocked → owner+lead | task.blocked | board |
| blocked → in_progress | unblock | assignee, QA, manager | allowed | is_blocked=false, blocked_since=null | — | task.unblocked | board |
| done → in_progress (reopen) | reopen | **manager only** | allowed | completed_at=null | — | task.status_changed | board, project |
| progress change | slider | assignee, manager | 0–100 step 10 | progress; project rollup | — | task.progress_updated | board, project |
| assignee change | assign | manager | valid user | assignee_id | task_assigned → new assignee | task.assigned | board |
