# FSD 14 — Guest Portal

Separate, read-only external experience. Builds on [00-conventions.md](./00-conventions.md).

1. **Purpose** — Give external guests (clients, patients, contractors, agencies, citizens) a branded, **read-only** window into the progress, timeline, completed work, and shared files of *their* projects — without any internal chrome or data.
2. **User Story** — *As a client I can log in and see how my project is going and download what's shared with me, without asking anyone.*
3. **Actors** — Guest (`member_type='guest'`, scoped to their `account_id`). System (signed URLs). Internal users do **not** use this surface.
4. **Preconditions** — Authenticated user whose active membership is a guest; the account has ≥1 visible project. Middleware/route-group routes guests here and internal pages away.
5. **Main Flow** — Portal shell (tenant branding + account name, minimal nav) → account overview (their projects w/ progress + health) → open a project → progress hero (ring + health + days remaining) + tabs **Progress · Timeline · Files · Updates** → download a shared file (signed URL).
6. **Alternative Flow** — Account/project switcher when a guest is linked to multiple projects. Pre-kickoff project shows 0% + timeline only. `getPortalFileDownload` uses a **service-role signed URL after re-checking** `is_guest_visible`.
7. **Validation Rules** — Read-only; the only action (`getPortalFileDownload { attachmentId }`) validates visibility. No create/update inputs exist.
8. **Business Rules** — **No writes anywhere** — enforced by RLS, not hidden buttons. Guests see: project name/description/dates/progress/health, task title/status/dates/progress, assignee display name, milestones, **guest-visible** files, and **guest-visible** activity. Guests never see: internal comments, hours/estimates, unshared files, team roster beyond assignees, other accounts' anything.
9. **Permission Rules** — Guest role (zero write permissions). RLS: `can_view_project` (guest + account match), `attachments_read`/`activities_read` guest-visible filters, `comments` internal fully hidden. A shared link cannot bypass this.
10. **Database Tables Used** — `organization_members` (guest + account), `accounts`, `projects`, `milestones`, `tasks`, `workflow_statuses`, `activities` (guest-visible), `attachments` (guest-visible), `profiles` (PIC contact).
11. **Server Actions Used** — `getPortalFileDownload` (service-role assisted). Queries `getPortalOverview`, `getPortalProject`, `listPortalFiles`.
12. **UI Components Used** — Portal shell (branding topbar, account switcher), progress hero (`ProgressRing` + `HealthBadge` + days-remaining), milestone timeline, grouped task lists (completed/current/upcoming — no hours/comments), shared-files list, curated updates feed, project-contact card.
13. **Notifications Triggered** — Guests **receive** `project_completed` (as account users) and can receive shared-file notices (roadmap). This surface does not create notifications.
14. **Activity Logs Generated** — N/A (read-only surface; guests generate no activity).
15. **Realtime Events** — Optional `project:{id}` progress for the guest's project; none required (refresh-on-visit is acceptable).
16. **Loading State** — Hero + list skeletons.
17. **Empty State** — No shared files ("No files shared yet"); no active projects ("No active projects right now"); pre-kickoff (0% + timeline).
18. **Error State** — Access to a non-owned project → "You don't have access to this"; expired signed URL → auto re-sign/retry; no guest membership → routed away.
19. **Success State** — Progress + timeline + completed work render; shared file downloads via signed URL.
20. **Edge Cases** — Guest linked to multiple accounts/projects (switcher); project unshared/deleted while viewing (RLS denies on next read); a file's guest-visibility revoked (sign-time re-check denies; short TTL bounds any live URL); internal data must never appear in the DOM (no internal fields fetched at all); guest with an internal-looking deep link (RLS + route group block).
21. **Acceptance Criteria** — (a) a guest sees only their account's projects and nothing internal (RLS-proven, incl. no internal comments/hours in payloads); (b) all guest mutations are impossible (no action exists + RLS denies); (c) shared-file downloads work and respect revocation; (d) a shared internal link cannot expose internal data; (e) the portal shell never renders internal navigation.
22. **QA Checklist** — Base +: **cross-account isolation** (guest A cannot see account B); **no internal data in any portal payload** (comments/hours/unshared files); write-impossibility (RLS denies inserts/updates); signed-URL re-check on revocation; route-group + middleware routing of guests; branding shows the tenant, not FlowDesk internals.
23. **Future Improvements** — Client Request Inbox (guests submit requests → PM triage), approvals/sign-off on milestones, threaded client-visible comments, client notifications (email), white-label domains/theming, downloadable status PDF, multi-language portal.

## CRUD breakout
- **Read** — `getPortalOverview` (account + projects), `getPortalProject` (progress/milestones/tasks/updates), `listPortalFiles` (guest-visible), `getPortalFileDownload` (signed URL). All strictly read.
- **Create / Update / Delete / Archive / Restore / Duplicate / Bulk** — **N/A by design** — guests have zero write capability; RLS guarantees it.

## State transitions
None — read-only surface. (Guest membership status transitions are owned by Member Management 04.)
