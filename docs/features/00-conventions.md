# FSD — Conventions & Shared Scaffolding

Read this first. Every module spec in `docs/features/` builds on the definitions
here and only documents its **deviations**. This keeps each module dense and
prevents 18 copies of the same boilerplate from drifting apart.

Grounded in: [DATABASE.md](../DATABASE.md) · [API-CONTRACT.md](../design/API-CONTRACT.md) · [UX-SPEC.md](../design/UX-SPEC.md) · [ENGINEERING-STANDARDS.md](../ENGINEERING-STANDARDS.md).

---

## A · Global preconditions (assumed by every feature)

Unless a module says otherwise, every operation assumes:
1. Supabase is configured; otherwise the UI shows the setup screen and actions return `NOT_CONFIGURED`.
2. The user is **authenticated** (valid Supabase session) — else redirected to `/login`.
3. The user has an **active organization** resolved from the `flowdesk_org` cookie (validated against membership); else redirected to `/onboarding`.
4. Every read and write is executed **under the caller's session** and is ultimately gated by **RLS**. The database is the source of truth.
5. Tenant columns (`organization_id`, `created_by`, task `number`, `progress`) are **database-owned** — never sent by the client.

---

## B · Actors glossary

Access derives from a permission set, not a role name. Named roles below are the
**seeded system roles**; tenants may define custom ones with any permission mix.

| Actor | Scope | Typical permissions | Notes |
|---|---|---|---|
| **Owner** | organization | all | Cannot be the *last* owner removed (guarded). |
| **Admin** | organization | all except `organization.delete` | |
| **Manager** | organization | project/task/account/report management | Runs delivery; no org administration. |
| **Member** | organization | `task.create`, `task.update.own`, `comment.create`, `attachment.upload`, `report.view` | Baseline internal contributor. Sees only projects they belong to (or org/workspace-visible). |
| **Lead** | project | project.update (its project), member.manage, task.* | A project-scoped role layered on top. |
| **Reviewer / QA** | project | `task.update.any` (the approval gate out of review/test) | |
| **Contributor** | project | `task.update.own`, comment, attachment | |
| **Viewer** | project | read-only | |
| **Guest** | organization (`member_type='guest'`) | **none** (read via RLS, scoped to their `account_id`) | External. Never sees internal comments/hours/unshared files. |
| **System** | — | — | Triggers, cron. Emits activity/notifications; owns derived state. |
| **Anonymous** | — | — | Only public auth routes. |

**Permission keys** are the 35 in `constants/PERMISSIONS` (seeded in `0010_seed.sql`).
Effective permission = union of the caller's **organization + workspace + project**
role grants, resolved by `has_permission(org, key, workspace?, project?)`.

---

## C · Reusable state definitions

Modules reference these by name and note only differences.

**Standard Loading**
- First paint: skeletons that match the final layout (never a bare full-page spinner).
- Independent regions stream (Suspense); a slow widget never blocks the shell.
- In-flight mutations: button shows inline spinner + present-tense verb; the form disables.
- Optimistic surfaces (kanban move, checklist, progress, mark-read, post-comment) update immediately and reconcile on settle.

**Standard Empty** — two distinct cases:
- *Empty* (nothing exists): explanatory copy + the primary CTA (permission-gated). Terminology-aware ("No projects yet" renders the tenant's noun).
- *No-results* (filters exclude everything): "Nothing matches" + **Clear filters**.

**Standard Error**
- *Field*: inline message + red border + `aria-invalid`.
- *Section*: inline card "Couldn't load — Retry".
- *Page*: error boundary with retry + back.
- *Permission*: "You don't have access" (never a raw 403/stack).
- *Transient*: destructive toast, auto-dismiss.
- Raw Postgres/exception text is **never** shown; logged server-side only.

**Standard Success**
- Optimistic patch reconciled → affected React Query keys invalidated → RSC paths revalidated.
- Confirmation toast for non-obvious results; silent for obviously-completed inline edits.
- Navigation only when the flow implies it (create → detail).

---

## D · CRUD operation template

For CRUD modules, each of **Create / Read / Update / Delete / Archive / Restore /
Duplicate / Bulk** is specified with this micro-structure:

`Trigger · Actor + Permission · Validation · DB effect · Notifications · Activity · Realtime · States · Edge cases · Acceptance`

Defaults that apply unless overridden:
- **Delete = soft delete** (`deleted_at`), never hard delete, for tenant-owned rows.
- **Archive** = a reversible "hidden from default views" flag (`is_archived`) distinct from delete; archived rows are restorable and still queryable.
- **Restore** = clear `deleted_at`/`is_archived`; permission mirrors delete/archive; only within retention.
- **Duplicate** = deep or shallow copy per module; new identity, reset derived state (progress, numbers), copy authored content; never copies audit/notifications.
- **Bulk** = the same permission checked per row; partial success reported (`{ succeeded, failed:[{id,reason}] }`); one confirmation, per-row RLS still applies.

---

## E · State-transition template

Every state change (task status, membership status, invitation status, project
status) is specified as:

`Transition · What triggers it · Who may perform it (permission) · Validation/guard · Database changes · Notification · Audit log · Realtime`

---

## F · Notification catalog (canonical `type` values)

`type` is TEXT (open set). Canonical values, recipients, generation source, dedupe:

| type | Recipient | Source | Dedupe |
|---|---|---|---|
| `task_assigned` | new assignee (≠ actor) | trigger (task insert/assignee change) | — |
| `task_completed` | reporter + project owner (≠ actor) | trigger (→ done category) | — |
| `task_blocked` | project owner + lead (≠ actor) | trigger (is_blocked→true) | — |
| `deadline_today` | assignee | cron (`generate_deadline_notifications`) | 1 / task / day |
| `deadline_tomorrow` | assignee | cron | 1 / task / day |
| `mentioned` | mentioned users who can view the entity | trigger (comment insert) | — |
| `project_completed` | owner + org managers + guest users of the account | action (project→completed) | — |
| `invitation_accepted` | inviter | action (accept) | — |
| `member_role_changed` | affected member | action | — |

**Global rules:** never self-notify (actor excluded); recipient must already have read access; notifications are personal (`user_id` only); retention 90 days.

---

## G · Activity catalog (canonical `action` values)

`action` is TEXT (open set). Append-only, trigger/action-emitted, `is_guest_visible`
controls guest feed inclusion.

| action | Emitted on | Guest-visible |
|---|---|---|
| `project.created` | project insert (trigger) | ✅ |
| `project.status_changed` | project status change (trigger) | ✅ |
| `project.updated` | project field edits (action) | ✅ (non-sensitive) |
| `project.deleted` | soft delete (trigger) | ❌ |
| `member.added` / `member.removed` | project member change (action) | ❌ |
| `milestone.created` / `milestone.reached` | milestone (action/trigger) | ✅ |
| `task.created` | task insert (trigger) | ✅ |
| `task.status_changed` | status change (trigger) | ✅ |
| `task.progress_updated` | progress change (trigger) | ✅ |
| `task.assigned` | assignee change (trigger) | ❌ |
| `task.blocked` / `task.unblocked` | block state (trigger) | ❌ |
| `task.deleted` | soft delete (trigger) | ❌ |
| `comment.created` | comment insert (trigger) | ✅ only if not internal |
| `attachment.uploaded` | attachment insert (trigger) | ✅ only if guest-visible |

**Rule:** activity is **never written by the client** — triggers own the audit spine; actions that need custom entries call `log_activity` (SECURITY DEFINER).

---

## H · Realtime channels

| Channel | Publishes | Drives |
|---|---|---|
| `notifications:{userId}` | notifications INSERT (RLS-filtered) | live unread badge + toast |
| `board:{projectId}` | tasks INSERT/UPDATE/DELETE for the project | live kanban / list |
| `task:{taskId}` | comments for the task | live thread |
| `project:{projectId}` | projects UPDATE + activities INSERT | header progress + activity feed |

Ephemeral drag position / presence use **broadcast/presence** channels (no DB writes). Subscriptions unsubscribe on unmount.

---

## I · Result envelope & error codes

Actions return `{ ok:true, data } | { ok:false, error:{ code, message, fields? } }`
(never throw for expected failures). Codes: `UNAUTHENTICATED · FORBIDDEN ·
VALIDATION · NOT_FOUND · CONFLICT · TRANSITION_NOT_ALLOWED · LAST_OWNER ·
RATE_LIMITED · PAYLOAD_TOO_LARGE · UNSUPPORTED_MEDIA_TYPE · NOT_CONFIGURED ·
INTERNAL`. See [API-CONTRACT §0.3](../design/API-CONTRACT.md#03-error-codes).

---

## J · Base QA checklist (every feature inherits; modules add specifics)

- [ ] TypeScript, ESLint, and `build` pass (Definition of Done §14).
- [ ] RLS proven: an integration test shows an allowed role succeeds and a denied role is blocked (incl. cross-tenant and guest where relevant).
- [ ] Responsive at 375 / 768 / 1024 / 1440; no horizontal body scroll; tables→cards, dialogs→sheets on mobile.
- [ ] Loading, Empty (empty *and* no-results), Error (field/section/page/permission), and Success states all present.
- [ ] Permission-gating hides disallowed actions **and** RLS blocks them.
- [ ] All validation enforced server-side (client is advisory).
- [ ] Notifications fire to the right recipients, never to the actor.
- [ ] Activity entries created with correct `is_guest_visible`.
- [ ] Realtime updates observed on the specified channels; subscriptions cleaned up.
- [ ] Terminology-aware copy (no hard-coded "Project"/"Client").
- [ ] Accessibility floor met (labels, focus, keyboard, contrast, not colour-only).
- [ ] Docs updated (migration + regenerated types + relevant spec).

---

## K · Facet applicability for read-only modules

Read/derived modules (Timeline, Calendar, Reports, Analytics, Search, Activity Log
read side, Guest Portal) legitimately have **N/A** facets. Where a facet does not
apply, the module states `N/A — <reason>` rather than inventing content. Facets
that are commonly N/A for reads: Notifications Triggered, Activity Logs Generated,
Delete/Archive/Restore/Duplicate/Bulk, most Realtime writes.
