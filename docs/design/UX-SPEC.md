# FlowDesk — UI/UX Specification (Pages)

Page-by-page design spec. Each page documents: **Purpose · Target User · Layout ·
Components · Actions · User Flow · Empty State · Loading State · Error State ·
Responsive Behaviour · Accessibility.**

Foundations: [DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md) · shared elements:
[UX-PATTERNS.md](./UX-PATTERNS.md). All nouns adapt to the tenant's
`terminology` map; access is by **permission**, not role name.

## Page map

| # | Page | Route | Scope | Gate |
|---|---|---|---|---|
| 1 | Login | `/login` | public | — |
| 2 | Register | `/register` | public | — |
| 3 | Forgot Password | `/forgot-password`, `/reset-password` | public | — |
| — | Onboarding | `/onboarding` | authed | any signed-in user with no org |
| 4 | Dashboard | `/dashboard` | org | member |
| 5 | Workspace | `/workspaces/[id]` | workspace | workspace member |
| 6 | Team | `/team`, `/team/[id]` | org | `team.manage` to edit |
| 7 | Members | `/members` | org | `organization.member.manage` |
| 8 | Projects | `/projects` | org/workspace | member (RLS-scoped) |
| 9 | Project Detail | `/projects/[id]` (+ tabs) | project | `can_view_project` |
| 10 | Task Detail | `…?task=[id]` (drawer) / `/tasks/[id]` | task | `can_view_task` |
| 11 | Kanban | `/projects/[id]/board` | project | `can_view_project` |
| 12 | Timeline | `/timeline`, `/projects/[id]/timeline` | org/project | internal |
| 13 | Calendar | `/calendar` | org | internal |
| 14 | Reports | `/reports` | org | `report.view` |
| 15 | Notifications | `/notifications` | user | self |
| 16 | Guest Portal | `/portal`, `/portal/projects/[id]` | account | guest |
| 17 | User Settings | `/settings/profile` | user | self |
| 18 | Workspace Settings | `/settings`, `/settings/*` | org/workspace | `*.settings.update` |

---

# 1 · Login

- **Purpose:** authenticate an existing user and route them into their active organization.
- **Target User:** everyone — internal members and guests.
- **Layout:** split screen. Left (≥ lg): dark brand panel — logo, one-line value prop, 3 proof points, indigo glow. Right: centred form card, max 360px.

```
┌───────────────────────────┬───────────────────────────┐
│  ◆ FlowDesk               │        Welcome back        │
│                           │   Sign in to your workspace│
│  One workspace for your   │  ┌──────────────────────┐  │
│  whole delivery team.     │  │ Email                │  │
│  ✓ See work in real time  │  ├──────────────────────┤  │
│  ✓ Keep clients in loop   │  │ Password    [Forgot?]│  │
│  ✓ Know if you're on track│  └──────────────────────┘  │
│                           │      [   Sign in   ]        │
│                           │   No account? Create one    │
└───────────────────────────┴───────────────────────────┘
```

- **Components:** brand panel, email field, password field (+ "Forgot?" link), primary submit, link to Register, inline alert region.
- **Actions:** submit → sign in; go to Forgot; go to Register. (SSO buttons are a placeholder slot for a roadmap item.)
- **User Flow:** enter credentials → submit (button → loading) → success routes to `?redirectTo` or `/dashboard`; if the user belongs to no org → `/onboarding`. Failure returns an inline error, credentials retained (password cleared).
- **Empty State:** n/a (form is the content).
- **Loading State:** submit shows spinner + "Signing in…", form disabled.
- **Error State:** single friendly alert above the form ("The email or password is incorrect") — never reveal which field; identical timing to avoid user enumeration.
- **Responsive:** brand panel hidden `< lg`; on mobile the logo sits above the form; inputs 16px.
- **Accessibility:** labelled fields; error in a live region; submit reachable via Enter; visible focus; password field has show/hide with a labelled toggle.

---

# 2 · Register

- **Purpose:** create a new account. (First-ever account of a *fresh* deployment becomes the platform's first owner via bootstrap; in normal use, new users then land on Onboarding to create or join an org.)
- **Target User:** new internal users; invited users (via token link pre-fills email + joins the inviting org).
- **Layout:** identical split screen; right card holds the form.
- **Components:** full-name, email, password (with strength/requirement hint), primary submit, link to Login, invite-context banner when arriving from an invitation.
- **Actions:** submit → create account; navigate to Login.
- **User Flow:** fill → submit → (a) email confirmation required → success panel "Check your email"; (b) session created → invited users join the org and land in `/dashboard`; un-invited users → `/onboarding`.
- **Empty State:** n/a.
- **Loading State:** submit spinner "Creating account…".
- **Error State:** field-level (invalid email, weak password) + form-level (email already registered → offer Login).
- **Responsive:** as Login.
- **Accessibility:** password requirements announced and programmatically associated; not colour-only strength meter (text + meter).

---

# 3 · Forgot / Reset Password

- **Purpose:** recover access. Two steps: request a link (`/forgot-password`), set a new password (`/reset-password`, reached from the emailed link via `/auth/callback`).
- **Target User:** any locked-out user.
- **Layout:** same auth shell, single field (request) or two fields (reset).
- **Components:** email field + submit (request); new-password + confirm + submit (reset); back-to-login link.
- **Actions:** request reset; set new password.
- **User Flow:** request → **always** show the same success ("If an account exists, a link is on its way") to prevent enumeration → user clicks email link → callback exchanges the code → reset form → on success, signed in → `/dashboard`.
- **Empty State:** n/a.
- **Loading State:** submit spinners ("Sending link…", "Updating…").
- **Error State:** reset link expired/invalid → explain + offer to request again; mismatched passwords → inline on confirm field.
- **Responsive:** as Login.
- **Accessibility:** clear step context in the heading; success is a live-region announcement; new-password rules associated with the field.

---

# 4 · Dashboard

- **Purpose:** answer the viewer's core question in <10s — *"Do I need to worry / what needs me / what do I do next?"* — adapting to the viewer's permissions, not a fixed persona.
- **Target User:** internal members. Composition varies by capability:
  - `project.view.all` + `report.view` → **portfolio/executive** emphasis.
  - manager (project/task manage) → **triage + my projects**.
  - contributor (`task.update.own`) → **My Work** emphasis.
  - *(Guests never see this — they're routed to the Guest Portal.)*
- **Layout:** page header (greeting + org/plan context + member-type badge) → KPI stat row → 2-column body (primary widgets left, secondary rail right), collapsing to one column `< lg`.

```
┌ Welcome back, Ada ─────────────────  [Member] ───────────┐
│ [Active 12] [Completed 34] [Overdue 5] [At risk 3]       │  ← KPI row
├──────────────────────────────┬───────────────────────────┤
│ Needs attention (at-risk/    │ Upcoming deadlines         │
│  delayed projects + reason)  │ (7 days)                   │
│ ──────────────────────────── │ ────────────────────────── │
│ My projects (cards w/ ring)  │ Recent activity (feed)     │
│ Portfolio health (donut)     │ Workload (team capacity)   │
└──────────────────────────────┴───────────────────────────┘
```

- **Components:** StatCard row; "Needs attention" list (health chip + reason + owner); Project cards; Health donut; Completion sparkline/trend; Workload bars; Activity feed; Upcoming deadlines list. Each widget is permission-gated (workload/health only for managers; reports link only with `report.view`).
- **Actions:** open a project/task; jump via ⌘K; drill a red project; "Create project" (if permitted); switch org.
- **User Flow:** land → scan KPIs → click the one red item → land in that project's board/detail. Contributor variant: land → see My Work buckets → open today's first task.
- **Empty State:** brand-new org → a **guided empty dashboard**: "Create your first project" primary CTA, plus "Invite your team" and "Set up your workflow" secondary cards. Per-widget empties ("No overdue work — nice.").
- **Loading State:** skeleton KPI tiles + skeleton cards/feed; widgets stream in independently (no full-page spinner).
- **Error State:** a widget that fails shows an inline "Couldn't load — Retry" card without taking down the page; a total failure shows a page-level error boundary with Retry.
- **Responsive:** KPI row 4→2→1; body 2-col→1-col; secondary rail drops below primary on mobile.
- **Accessibility:** one `h1` (greeting); each widget is a labelled `section`; donut/sparkline carry text summaries + data tables; KPI deltas are text, not colour-only.

---

# 5 · Workspace

- **Purpose:** the home of one workspace (a department, office, product line, client portfolio) — its projects, teams and members in one place. Explains the org→**workspace**→project layer to users.
- **Target User:** members of that workspace; managers configuring it.
- **Layout:** header (workspace name + colour, description, member avatars, settings gear if permitted) → tabs: **Projects** (default) · **Teams** · **Members** · **Activity** → tab content.
- **Components:** workspace header; project cards/table (filter + sort + view toggle); team list; member list; activity feed; "New project" primary (if `project.create`).
- **Actions:** create project in this workspace; add/manage members (permitted); open a project; switch workspace (from a workspace picker in the header or sidebar).
- **User Flow:** pick a workspace → see its projects → open one, or create a new project pre-scoped to this workspace.
- **Empty State:** no projects → "This workspace has no projects yet" + Create (if permitted) or a read-only "Nothing here yet" for viewers.
- **Loading State:** header skeleton + card/table skeletons per tab.
- **Error State:** per-tab retry; not-a-member or archived → friendly "You don't have access to this workspace".
- **Responsive:** tabs become a scrollable strip; cards reflow; header condenses.
- **Accessibility:** tabs use the tab/tabpanel pattern with keyboard support; workspace colour is decorative (name is the identifier).

---

# 6 · Team

- **Purpose:** manage **teams** (durable groups of people — "Backend Guild", "Site Crew A", "Night Shift") that exist independently of projects.
- **Target User:** managers/admins (`team.manage`) to edit; all members to view.
- **Layout:** list view (team cards/rows: name, colour, lead, member count, avatar stack) → **team detail** (members table, the projects the team is attached to, activity).
- **Components:** team list, "New team" primary (permitted), team card, member management drawer/modal, lead selector, remove-member action, team detail tabs.
- **Actions:** create/edit/delete team; add/remove members; assign lead; attach team to a project.
- **User Flow:** managers create a team → add members → attach it to projects so staffing is reusable. Viewers browse who's on which team.
- **Empty State:** "No teams yet — group people who work together" + Create (permitted) / neutral message (not).
- **Loading State:** skeleton rows; detail skeleton.
- **Error State:** delete-with-dependencies warns (team attached to N projects) and confirms; failed mutation toasts with retry.
- **Responsive:** list → cards on mobile; detail tables → card lists.
- **Accessibility:** avatar stacks expose names; destructive delete requires confirm; tables keyboard-navigable.

---

# 7 · Members

- **Purpose:** the organization's people roster — invite, assign roles, set member vs guest, activate/suspend, and read workload.
- **Target User:** admins/owners (`organization.member.manage`).
- **Layout:** header (search + filters: role, status, type; "Invite" primary) → members table.

```
┌ Members            [search]      [Role▾][Status▾]  [Invite]┐
├───────────────────────────────────────────────────────────┤
│ □ Name            Role         Type    Status   Workload ⋯ │
│ □ Ada Lovelace    Owner        Member  Active   ▓▓▓░ 74%  ⋯│
│ □ Budi (Client)   Guest        Guest   Active   —         ⋯│
└───────────────────────────────────────────────────────────┘
```

- **Components:** members table (avatar+name, role select, type badge, status badge, workload bar, `⋯`), invite modal (email, role, member/guest, optional workspace/account for guests), bulk selection toolbar, role-change confirm.
- **Actions:** invite; change role; change status (activate/suspend); convert member↔guest; link a guest to an account; remove; bulk role/status; resend/revoke invitation.
- **User Flow:** admin invites → invitee accepts via token (joins org with the chosen role) → appears Active. Admin adjusts roles inline (guarded: cannot remove the last owner).
- **Empty State:** only the founder present → "Invite your team" hero + Invite; guests section empty until a guest is added.
- **Loading State:** skeleton table; invite modal fields disabled while submitting.
- **Error State:** last-owner protection surfaces a clear message ("At least one owner is required"); duplicate invite → "Already invited"; permission failure → RLS-safe message.
- **Responsive:** table → member cards; filters collapse into a filter sheet.
- **Accessibility:** role selects are labelled per row; status changes announced; destructive actions confirmed; workload bar has a text value.

---

# 8 · Projects

- **Purpose:** browse, filter and create the org's projects; the main entry to work.
- **Target User:** all internal members (RLS scopes what they see); guests use the portal instead.
- **Layout:** header (title + count, search, filters, view toggle grid/table, "New project" if permitted) → content grid **or** table.

```
┌ Projects (12)   [search] [Status▾][Health▾][Owner▾] ⊞≣ [New]┐
├──────────────┬──────────────┬──────────────────────────────┤
│▎Website Redes│▎Clinic Intake│▎Bridge Retrofit               │
│ Acme · WEB   │ StGiles·CASE │ CityGov · SITE                │
│ ◕ 62% ·◉Risk │ ◔ 20%·◉Late  │ ◕ 80% · ◉On track             │
│ 👤👤👤 +2 · Aug│ 👤👤 · Jul   │ 👤👤👤 · Dec                    │
└──────────────┴──────────────┴──────────────────────────────┘
```

- **Components:** filter bar (status, health, owner, workspace, account, tag) + active chips; Project cards (accent bar, name, account, progress ring, health chip, avatars, deadline) or DataTable rows; view toggle; new-project modal (name, workspace, account, template, dates, owner, colour, visibility).
- **Actions:** search/filter/sort; toggle grid/table; open project; create project (optionally **from a template** — instantiates tasks/milestones); archive (permitted).
- **User Flow:** filter to "at-risk" → open the worst → act. Or "New project" → choose template → land in the new project's board.
- **Empty State:** none yet → "Create your first project" hero + template picker preview; **no-results** (filters exclude all) → "No projects match — Clear filters".
- **Loading State:** skeleton cards/rows; filter bar interactive immediately.
- **Error State:** load failure → retry card; create failure → modal keeps input + shows reason.
- **Responsive:** grid 3→2→1; table → cards; filters → sheet; "New" becomes a FAB on mobile.
- **Accessibility:** each card is one labelled link; progress ring + health have text equivalents; filter chips are removable with labels; view toggle is a labelled control group.

---

# 9 · Project Detail

- **Purpose:** the operating surface for one project — overview, work, schedule, files, activity, settings.
- **Target User:** project members and managers; read-only for viewers.
- **Layout:** project header (colour, name + id, account, health chip, progress, owner, member avatars, primary action) → **tabs**: Overview · Board · Timeline · Files · Activity · Settings → tab content. Overview = main column (description, milestones, key tasks) + meta rail (dates, health reason, team, account, custom fields).

```
┌ ▎Website Redesign  WEB   ◉At risk   ◕62%      [+ New task]│
│ Acme Corp · Owner: Ada · 👤👤👤 +2                          │
│ [Overview] [Board] [Timeline] [Files] [Activity] [Settings]│
├───────────────────────────────┬───────────────────────────┤
│ Description…                  │ Dates  Jun 1 – Aug 30      │
│ Milestones ◇──◆──◇            │ Health at-risk: 12d behind │
│ Recent / key tasks            │ Team · Account · Fields    │
└───────────────────────────────┴───────────────────────────┘
```

- **Components:** project header; tab bar; description (rich text, editable if permitted); milestone strip; task list preview; meta rail (dates, health-with-reason, team, account, tenant custom fields); progress ring; member management; `⋯` (archive/delete, permitted).
- **Actions:** edit project (permitted); new task; manage members/milestones; change status; toggle client-visible files; archive/delete (confirmed). Tabs deep-link.
- **User Flow:** open from list → Overview to orient → Board to work → Files/Activity as needed. Managers edit dates/scope from the rail.
- **Empty State:** new project → Overview prompts "Add a description", "Create milestones", "Add tasks"; Board empty prompts first task; Files/Activity empty messages.
- **Loading State:** header skeleton + tab skeletons; tabs load independently.
- **Error State:** no access → "You don't have access to this project"; not found/deleted → friendly 404 with back link; tab load failure → inline retry.
- **Responsive:** tabs scroll; meta rail moves **below** main content `< lg`; header condenses (avatars collapse to +N).
- **Accessibility:** tab pattern; `h1` = project name; health reason is text; editable regions have clear edit affordances and labels.

---

# 10 · Task Detail

- **Purpose:** view and update everything about one task; the highest-frequency editing surface.
- **Target User:** assignee (edit own), managers (edit any), reviewers/QA (transition), viewers/guests (read, guest sees limited).
- **Layout:** right **drawer** over the board/list (deep-linkable `?task=…`); full-page fallback at `/tasks/[id]`. Two zones: main (title, description, checklist, comments) + meta rail (status, assignee, priority, dates, estimate/actual, custom fields, evidence links).

```
┌ WEB-42                                    ⋯   ✕ │
│ Redesign homepage hero                          │
│ ┌ Status  [In Progress ▾] ← workflow-driven    │
│ │ Assignee [Ada ▾]  Priority [High ▾]           │
│ │ Start Jun 4 · Due Jun 12 · Est 8h / Act 5h    │
│ │ Progress ▓▓▓▓▓▓░░░░ 60%                        │
│ └ Fields: PR ⧉ · Figma ⧉ · Staging ⧉           │
│ Description………                                  │
│ Checklist  3/5  �!add                            │
│ 📎 Files (2)                                    │
│ 💬 Comments ───────── @mention ─── [Send]        │
└─────────────────────────────────────────────────┘
```

- **Components:** title (inline-edit), status select (**constrained by workflow transitions**), assignee/priority selects, date pickers, estimate/actual, progress selector (0–100 by 10), description editor, checklist editor, evidence field chips, file upload, comment section, `⋯` (move/duplicate/delete/convert to subtask), subtask list, dependency chips.
- **Actions:** change status (validated; reason required where the transition demands it); reassign; set dates/estimate (managers); update progress/actual (assignee); add checklist/subtask/comment/attachment; mark file guest-visible; block (reason) / unblock; delete (confirm).
- **User Flow:** open from board/list → set In Progress → tick checklist, bump progress, attach evidence → move to Review → reviewer/QA transitions → Done (progress auto-100). Column edit permissions enforced (assignee can't move their own dates).
- **Empty State:** no description ("Add a description"); no checklist/comments/files → per-section prompts.
- **Loading State:** drawer opens instantly with a skeleton, content streams; optimistic writes for status/progress/checklist.
- **Error State:** illegal transition → inline "That move isn't allowed in this workflow"; permission denied → the field is read-only with a tooltip; save failure → revert optimistic change + toast retry; comment failure → inline retry.
- **Responsive:** drawer → full screen `< md` → bottom sheet `≤ sm`; meta rail becomes a collapsible top section.
- **Accessibility:** dialog semantics + focus trap + restore focus to the source row; every control labelled; inline-edit has clear affordance + Esc-cancel/Enter-save; status/priority selects are keyboard combo-boxes.

---

# 11 · Kanban (Project Board)

- **Purpose:** move work across the project's workflow visually.
- **Target User:** project members; managers.
- **Layout:** full-width board; **one column per workflow status** (from the tenant's workflow — a construction board reads Planned/Materials/Execution/Inspection/Handover). Optional board toolbar (group-by, filter, quick-add).

```
┌ Board   [filter] [group: status ▾]              [+ Task]  │
├── To Do ──┬ In Progress ┬ Review ┬ Testing ┬ Done ┬ Block ┤
│ ▎WEB-40   │ ▎WEB-42     │ ▎WEB-39│         │▎WEB-1│▎WEB-7 │
│  High ●   │  60% ▓▓▓░   │        │         │ ✓    │ ⛔    │
│  👤 · Jun9 │  👤 3/5 💬2  │  👤     │         │      │       │
│ ▎WEB-41   │             │        │         │      │       │
│  + add    │             │        │         │      │       │
└───────────┴─────────────┴────────┴─────────┴──────┴───────┘
```

- **Components:** columns (status dot + name + count + quick-add), Kanban cards (see UX-PATTERNS §17), drag layer, column "show more" (>50), board filters, WIP hint.
- **Actions:** drag card between/within columns (status change, validated by allowed transitions); quick-add card to a column; open card (drawer); filter/group; keyboard "Move to…".
- **User Flow:** grab a card → drop in the next allowed column → optimistic move + activity logged. Illegal drops are refused with feedback.
- **Empty State:** no tasks → centered "Create the first task"; empty column → subtle "Drop here"/"No tasks".
- **Loading State:** skeleton columns + cards; board interactive when loaded.
- **Error State:** rejected move (RLS/transition) → snap back + toast reason; save failure → revert + retry.
- **Responsive:** `< md` horizontal snap-scroll one column at a time; tap opens the drawer; drag replaced by the card menu's "Move to…".
- **Accessibility:** full **keyboard drag alternative** (focus card → menu → Move to <status>); moves announced via live region; columns are labelled regions; cards are focusable with complete names.

---

# 12 · Timeline

- **Purpose:** see scheduling — who's doing what, when things start/end, overlaps, milestones — across a project or the whole org.
- **Target User:** internal members; managers for capacity.
- **Layout:** left sticky lanes (toggle: by **assignee** or by **project**) + right scrollable time axis (day/week/month zoom); today marker; milestone diamonds. Filter bar above.
- **Components:** timeline (UX-PATTERNS §16), zoom control, lane-group toggle, filters (project, assignee, status), bar popover, milestone markers.
- **Actions:** zoom; switch grouping; filter; hover/focus a bar → details; click → Task Detail. (Drag-reschedule is roadmap; read-only in MVP.)
- **User Flow:** manager groups by assignee → spots an overloaded week → opens the offending task → reassigns from the drawer.
- **Empty State:** no dated work → "Add start/due dates to see the timeline" + link to affected tasks.
- **Loading State:** skeleton lanes + bars.
- **Error State:** load failure → retry; date inconsistencies flagged softly (a warning tint), never blocking.
- **Responsive:** `< md` collapses to a **condensed agenda list** grouped by day/week.
- **Accessibility:** bars are focusable buttons with full names; the agenda list is the accessible equivalent; keyboard moves between bars; today marker is labelled.

---

# 13 · Calendar

- **Purpose:** deadline- and milestone-centric view of due work by date.
- **Target User:** internal members (personal + team scope).
- **Layout:** month grid (default) with week/day toggles; each cell shows due tasks + milestones as chips; a "My items / All" scope toggle; side mini-list for the selected day.
- **Components:** month/week/day views, date cells, event chips (status-tinted), day detail panel, scope + filter controls, "New task" with a preset due date.
- **Actions:** switch view; navigate months; filter (project, assignee); click an event → Task Detail; click a day → create a task due that day (permitted).
- **User Flow:** open month → see a heavy Friday → click through to rebalance.
- **Empty State:** no dated items in range → "Nothing due here" with a hint to add due dates.
- **Loading State:** skeleton grid; events fill in.
- **Error State:** load failure → retry; overflow days show "+N more" → day panel.
- **Responsive:** `< md` month grid → **agenda list** (upcoming by day); week/day views scroll.
- **Accessibility:** grid uses a proper date-grid pattern (arrow-key navigation, `aria-selected`); events are labelled buttons; not colour-only (status text in the chip/aria).

---

# 14 · Reports

- **Purpose:** aggregate insight — completion, on-time rate, throughput, health distribution, workload, estimate accuracy — with export.
- **Target User:** managers/owners (`report.view`; export needs `report.export`).
- **Layout:** header (date range, scope: org/workspace/project, filters, Export) → KPI row → chart grid (2-up) → detail tables.
- **Components:** date-range picker, scope selector, StatCards, charts (trend line, health donut, throughput bars, estimate-accuracy), data tables with export, empty/loading per widget.
- **Actions:** change range/scope/filters; export CSV/PDF (to the private `exports` bucket, downloaded via signed URL); drill a chart into its underlying table.
- **User Flow:** pick last-quarter + a workspace → read completion trend → export for the leadership deck.
- **Empty State:** insufficient data → "Not enough data yet for this range" with guidance; a fresh org shows a friendly "Reports populate as work completes".
- **Loading State:** skeleton KPIs + chart placeholders; charts stream independently.
- **Error State:** a failed widget shows inline retry; export failure toasts with reason; no-permission hides export.
- **Responsive:** charts stack 1-up; tables → card lists or horizontal-scroll containers; range picker → sheet.
- **Accessibility:** every chart pairs with a data table + text summary; export is a labelled action with progress; KPI deltas are text.

---

# 15 · Notifications (full page)

- **Purpose:** the complete, filterable history of personal alerts (the panel shows recent; this shows all).
- **Target User:** every user (self only).
- **Layout:** header (filter: type, read/unread; "Mark all read") → grouped list (Today / Earlier) → pagination.
- **Components:** notification rows (type icon, title, snippet, relative time, unread emphasis), filters, bulk mark-read, empty state.
- **Actions:** open (→ entity, marks read); mark one/all read; filter; load more.
- **User Flow:** open bell → "View all" → filter to unread mentions → clear them.
- **Empty State:** "You're all caught up" (no unread) / "No notifications yet" (none ever).
- **Loading State:** skeleton rows.
- **Error State:** load/mark failure → toast + retry; a dead entity link → graceful "This item no longer exists".
- **Responsive:** single column; full width; filters → sheet.
- **Accessibility:** semantic list; unread conveyed by text + dot (not colour only); relative time has absolute `title`; bulk action labelled.

---

# 16 · Guest Portal

- **Purpose:** a **separate, read-only** experience for external guests (clients, patients, contractors, agencies, citizens) — progress, timeline, completed work, shared files — without any internal chrome.
- **Target User:** `member_type = 'guest'`, scoped to their account's projects.
- **Layout:** simplified shell (portal topbar with tenant branding + account name; minimal nav). Landing = account overview (their projects); project view = progress hero + tabs (Progress · Timeline · Files · Updates).

```
┌ ◆ Acme  ·  Client: BigCo                    [account ▾] │
├─────────────────────────────────────────────────────────┤
│  Website Redesign                                        │
│        ◕ 62%     ◉ On track     · 34 days remaining      │
│  [Progress] [Timeline] [Files] [Updates]                 │
│  ✔ Completed (10) · ▷ In progress (4) · ◇ Upcoming (6)    │
│  Contact: Ada Lovelace  ·  ada@acme.dev                  │
└─────────────────────────────────────────────────────────┘
```

- **Components:** progress hero (ring + health + days remaining), milestone timeline, task lists grouped by completed/current/upcoming (title, status, dates — **no hours, no internal comments**), shared-files list (guest-visible only, signed-URL download), curated updates feed (guest-visible activity), project-contact card, account/project switcher.
- **Actions:** view progress/timeline; download shared files; switch project/account. **No create/edit/delete anywhere** — enforced by RLS, not hidden buttons.
- **User Flow:** guest logs in → sees their project(s) → checks progress + downloads the latest deliverable — without asking anyone.
- **Empty State:** no shared files ("No files shared yet"); no active projects ("No active projects right now"); pre-kickoff project shows 0% + timeline only.
- **Loading State:** hero + list skeletons.
- **Error State:** access to a non-owned project → "You don't have access to this"; expired file link → auto-refreshes the signed URL or prompts retry.
- **Responsive:** single column throughout; hero scales; lists stack; fully touch-friendly.
- **Accessibility:** same floor as internal; extra care that nothing internal leaks (no internal-only text in DOM); progress has text equivalents; contact is a real mailto link.

---

# 17 · User Settings

- **Purpose:** manage the individual's own profile and preferences (spans organizations).
- **Target User:** every authenticated user (self).
- **Layout:** settings shell with left sub-nav (Profile · Preferences · Notifications · Security) + form panel.
- **Components:** avatar uploader; name/title/phone/timezone/locale fields; theme preference (system/light/dark); notification preferences (per type/channel — in-app now, email later); security (change password, active sessions, sign out everywhere); danger zone (leave organization / delete account, heavily confirmed).
- **Actions:** save profile; upload/remove avatar; set theme/locale/timezone; toggle notification prefs; change password; leave org; delete account.
- **User Flow:** open from the user menu → update avatar + timezone → save (toast). Timezone feeds date/deadline rendering.
- **Empty State:** n/a (always populated); avatar has an initials fallback.
- **Loading State:** field skeletons on first load; per-section save spinners.
- **Error State:** avatar too large/wrong type → inline; password change wrong current → field error; save failure → banner + retry.
- **Responsive:** left sub-nav → top tabs/sheet; single-column forms.
- **Accessibility:** labelled fields + sections; avatar uploader keyboard-operable; destructive actions typed-confirm; theme control announces state.

---

# 18 · Workspace / Organization Settings

- **Purpose:** configure the tenant — profile & branding, **terminology**, **workflows & statuses**, roles & permissions, custom fields, templates, members/accounts, billing (later). This is where the platform's industry-adaptability is actually operated.
- **Target User:** owners/admins (`organization.settings.update`, `workflow.manage`, `organization.role.manage`, etc.); each sub-area gated independently.
- **Layout:** settings shell with left sub-nav grouped **Organization** (Profile, Branding, Terminology, Members, Roles, Billing) and **Workspace** (General, Members, Default workflow) + **Configuration** (Workflows, Custom fields, Templates, Automation) → panel per section.
- **Components:**
  - *Profile/Branding:* name, logo (branding bucket), colours, website.
  - *Terminology:* editable noun map with live preview ("Project → Site", "Account → Client") — the single biggest industry-fit control.
  - *Workflows:* per-entity status editor (name, colour, category, order, auto-progress, initial/final) + transition matrix (allowed moves, required permission, requires-comment) with a visual preview.
  - *Roles:* role list + permission matrix editor (grant/deny by permission key); create custom roles.
  - *Custom fields:* per-entity field builder (type, options, validation, required, guest-visible, scope).
  - *Templates:* project/task template manager.
  - *Members/Accounts:* links to Members (#7) and Accounts management.
- **Actions:** edit any of the above (each guarded); reorder statuses (drag); edit the transition matrix; add/edit roles & permissions; define custom fields; manage templates; danger zone (rename/delete org, transfer ownership — heavily confirmed).
- **User Flow:** a construction admin opens Terminology → renames Project→Site, Task→Work Order → opens Workflows → adjusts statuses to Planned/Materials/Execution/Inspection/Handover → the whole product now speaks their language, no code.
- **Empty State:** custom fields/templates empty → "Create your first…" with an explanation of the benefit; roles show the seeded system roles as read-only baselines.
- **Loading State:** section skeletons; matrix editors show placeholder grids.
- **Error State:** invalid workflow (e.g. no initial status, unreachable status) → inline validation before save; permission-key conflicts flagged; save failure → banner + retry; deleting a status in use warns and offers remap.
- **Responsive:** left sub-nav → top select/sheet; matrices scroll horizontally within their container; drag-reorder has button fallbacks on touch.
- **Accessibility:** the permission/transition matrices are real tables with header associations and keyboard cell navigation; drag-reorder has keyboard "move up/down"; terminology preview updates a live region; every toggle labelled.

---

## Cross-page conventions

- **Route protection is layered:** middleware (authed) → route guard (permission) → **RLS (authoritative)**. UI hides what a user can't do, but the database is the real gate.
- **Deep-linking:** tabs, board, timeline, and the task drawer all encode state in the URL so views are shareable and refresh-safe.
- **Every collection page** ships all three states — empty (with an action), loading (skeleton, not spinner), error (inline retry). No page is "done" without them.
- **Guests** never reach internal pages; they are routed to the Guest Portal, and RLS guarantees it even if a link is shared.
- **Terminology & workflow** are read from tenant config on every page — the same components render every industry.
