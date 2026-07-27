# FSD 08 — Kanban Board

A view/interaction layer over Tasks (07). Builds on [00-conventions.md](./00-conventions.md).

1. **Purpose** — Move work across the project's workflow visually, with drag-and-drop, in columns generated from the tenant's own statuses.
2. **User Story** — *As a project member I can see all tasks as cards in status columns and drag a card to change its status, so progress is fast and obvious.*
3. **Actors** — Project members (view + move own/any per permission), Managers/Leads/QA (move any), Viewers/Guests (view only; guests via portal, read-only).
4. **Preconditions** — A visible project with a task workflow; tasks exist (else empty state).
5. **Main Flow** — Load board → **one column per `workflow_status`** (ordered by `position`, header shows dot+name+count+quick-add) → drag a card to another column → optimistic status change → server validates the transition → activity + notifications + progress rollup → realtime broadcast to other viewers.
6. **Alternative Flow** — Reorder within a column (priority ordering via fractional `position`). Quick-add creates a task directly in a column's status. Keyboard move: focus a card → menu → "Move to <status>". Filter/group toolbar narrows the board.
7. **Validation Rules** — Drop target must be an **allowed transition** for the card's workflow (else rejected); quick-add uses `createTaskSchema` (title required). Move uses `moveSchema { taskId, statusId, beforeId?, afterId? }`.
8. **Business Rules** — Columns are **data-driven** (never hard-coded), so a construction board reads Planned→…→Handover and a clinic reads Intake→…→Discharged. Moving to a `done` column forces 100%/completed_at; to `blocked` sets blocked state (reason prompt if the transition requires a comment). Columns cap at ~50 cards with "show more"; boards default to the current period.
9. **Permission Rules** — move: `task.update.any` or (`task.update.own` + assignee); some transitions require a specific `required_permission` (e.g., QA close). Quick-add: `task.create`. RLS + transition trigger are authoritative.
10. **Database Tables Used** — `tasks`, `workflow_statuses`, `workflow_transitions`, `projects`, `profiles` (assignee avatars).
11. **Server Actions Used** — `moveTask`, `updateTaskStatus`, `createTask` (quick-add). Reads via `listTasks` (board grouping).
12. **UI Components Used** — `KanbanColumn`, `KanbanCard`, drag layer/overlay, column quick-add, board filter/group toolbar, WIP hint, drop indicator, skeleton cards.
13. **Notifications Triggered** — Inherited from Tasks on the resulting transition (`task_assigned`/`task_completed`/`task_blocked`).
14. **Activity Logs Generated** — Inherited: `task.status_changed` (+ `task.created` on quick-add).
15. **Realtime Events** — `board:{projectId}` (task INSERT/UPDATE/DELETE) reconciled into the board; ephemeral drag position via **broadcast** (no DB write until drop).
16. **Loading State** — Skeleton columns + cards; board interactive when loaded; **drag is optimistic** (card moves immediately).
17. **Empty State** — No tasks → centered "Create the first task"; empty column → subtle "No tasks" / "Drop here".
18. **Error State** — Illegal drop → **snap back** + toast ("That move isn't allowed"); RLS/permission denial → snap back + toast; save failure → revert + retry. A rejected drop never leaves the card in the wrong column.
19. **Success State** — Card settles in the new column; count badges update; project header progress updates; other viewers see the move via realtime.
20. **Edge Cases** — Two users drag the same card (last-write-wins + realtime reconcile); dragging to a column whose transition needs a reason (prompt before committing); very large "Done" column (capped + "show more"); workflow edited while board open (reload prompt); offline/slow network (optimistic with reconcile on reconnect); touch drag on mobile (one-column snap-scroll).
21. **Acceptance Criteria** — (a) columns exactly match the project's workflow statuses & order; (b) only allowed transitions succeed; illegal drops snap back; (c) moves are optimistic and reconcile with the server; (d) done/blocked side-effects apply; (e) keyboard users can move cards without a mouse; (f) other viewers see moves live.
22. **QA Checklist** — Base +: data-driven columns; allowed vs illegal drop; optimistic + rollback; keyboard move alternative; realtime reconciliation; reason-required transitions; mobile one-column scroll; WIP/cap behavior.
23. **Future Improvements** — Swimlanes (by assignee/priority), WIP limits with enforcement, board filters saved as views, card cover images, multi-select drag, sub-task mini-boards, group-by other than status.

## CRUD breakout
Kanban is not a data owner — it manipulates Tasks (07). Applicable ops: **Read** (board grouping) and **Update** (status/position via `moveTask`) and **Create** (quick-add). Delete/Archive/Restore/Duplicate/Bulk are performed from the task/list surfaces.

## State transitions
Delegated entirely to Tasks (07) — the board is the trigger surface; validation, DB changes, notifications, audit, and realtime are exactly the Task status-transition matrix.
