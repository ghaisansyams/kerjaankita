# FSD 12 — Activity Log

Append-only audit trail + human-readable feed. Read-only from the app's side.
Builds on [00-conventions.md](./00-conventions.md).

1. **Purpose** — Provide an immutable record of what happened (the audit spine) and a human feed that replaces status meetings, scoped correctly for internal users and guests.
2. **User Story** — *As a team member I can see a running feed of changes on my projects; as a guest I see only the updates meant for me; as an admin the trail is complete and tamper-evident.*
3. **Actors** — Internal members (read project/org feed), Guest (read guest-visible subset), System (the **only** writer — triggers/actions). No user edits or deletes activity.
4. **Preconditions** — The referenced project/entity is visible to the reader.
5. **Main Flow** — Open a feed (dashboard = org/my-projects; project tab = project-scoped; task = entity-scoped) → reverse-chronological, day-grouped, humanised sentences ("Ada moved WEB-42 to Review") → infinite scroll (keyset) → click an item to open its entity.
6. **Alternative Flow** — Filter by type/actor (internal). Guest feed shows only `is_guest_visible=true` entries (no internal comments, no assignment/blocked internals).
7. **Validation Rules** — Read-only; filters validated (type/actor/date). No write validation from clients (writes are system-side).
8. **Business Rules** — **Append-only, never edited/deleted by the app.** Written by triggers (task/project/comment/attachment) and by actions via `log_activity` (SECURITY DEFINER). `is_guest_visible` per the [activity catalog](./00-conventions.md#g--activity-catalog-canonical-action-values). Hot retention 12 months, then archived (per scalability plan).
9. **Permission Rules** — read `activities_read`: org member + (project visible) + (guest → only guest-visible). **No** insert/update/delete policy for users — triggers write with definer rights; admin-only delete exists solely for compliance purges.
10. **Database Tables Used** — `activities`, `profiles` (actor), `projects` (scope). (Writers touch tasks/projects/comments/attachments.)
11. **Server Actions Used** — **None for writes.** Read via `listActivities` query (repository). Writes happen through the emitting features' triggers/actions.
12. **UI Components Used** — `ActivityFeed`, `ActivityItem`, day-group headers, actor avatars, type icons, filters, infinite-scroll sentinel, empty/loading states.
13. **Notifications Triggered** — N/A (activity is the record, not the alert).
14. **Activity Logs Generated** — N/A — this module **reads** the log; every other module generates it (see catalog).
15. **Realtime Events** — `project:{projectId}` (activities INSERT) → live feed prepend.
16. **Loading State** — Skeleton lines; page-by-page skeleton on infinite scroll.
17. **Empty State** — "No activity yet" (new project) / guest "No updates yet".
18. **Error State** — Load failure → section retry; a referenced entity since deleted → the sentence still renders with a neutral link state.
19. **Success State** — Feed streams new entries live; filters narrow instantly; clicking routes to the entity.
20. **Edge Cases** — High-volume projects (keyset pagination + virtualization); guest must never see internal actions (RLS + `is_guest_visible`); actor deleted (shows "Someone"/former-name); clock/timezone (relative time + absolute on hover in the org timezone); back-fill/import events.
21. **Acceptance Criteria** — (a) every audited mutation appears with correct actor, action, and guest-visibility; (b) guests see only guest-visible entries (RLS-proven); (c) the log is append-only from the app; (d) feed paginates and streams live; (e) sentences are human-readable without relying on colour/icon.
22. **QA Checklist** — Base +: guest visibility filter (RLS); append-only (no client write path); keyset pagination; realtime prepend; humanised copy for every action type; timezone rendering.
23. **Future Improvements** — Advanced audit search/export (compliance), diff view for updates (before/after), per-entity timeline, retention/archival tiering, activity digests, filtering saved views, `task_status_history` promotion for cycle-time analytics.

## CRUD breakout
- **Read** — `listActivities` (scope: org/project/entity; filters type/actor/date; keyset). Only operation exposed to users.
- **Create** — system-only (triggers/`log_activity`).
- **Update/Delete** — **Not permitted** (append-only); admin compliance-purge is an out-of-band operation.
- **Archive/Restore/Duplicate/Bulk** — N/A (archival is an infra retention job, not a user action).

## State transitions
None — activity rows are immutable facts. Lifecycle is `created → (archived by retention tier)`.
