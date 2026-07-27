# FlowDesk — Shared UI Patterns

Reusable structures used across every page. Each entry: **Purpose · Anatomy ·
Variants · States · Behaviour · Responsive · Accessibility.** Tokens reference
[DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md). All copy adapts to the tenant's
`terminology` map (e.g. "Project" may read "Site" / "Case" / "Campaign").

---

## 1 · Sidebar (primary navigation)

- **Purpose:** move between the tenant's top-level areas; carry identity + org switch.
- **Anatomy:** header (org logo/name → home) · grouped nav (`Workspace`, `Insights`, `Manage`) · footer (user + org menu). Width 264px; icon-rail 56px collapsed.
- **Variants:** internal shell (full nav) · **guest shell** (reduced: Overview, Projects, Files only) · collapsed icon rail.
- **States:** item default / hover (`accent`) / **active** (`accent` fill, indigo icon, medium weight) / focus ring. Active resolves by longest-matching path.
- **Behaviour:** nav items are **permission-filtered** — an item a role can't use is *removed, not disabled*. Collapse state persists per user. Groups with no visible items disappear.
- **Responsive:** `< md` becomes an off-canvas drawer over a scrim, opened by the topbar trigger, closing on navigation. `md–lg` defaults to icon rail. `≥ lg` full.
- **A11y:** `<nav aria-label>`; current item `aria-current="page"`; full keyboard traversal; collapsed items expose labels via tooltip *and* accessible name.

---

## 2 · Top navigation (topbar)

- **Purpose:** contextual controls that aren't navigation — search, notifications, theme, mobile menu.
- **Anatomy (left→right):** sidebar trigger · divider · **search launcher** (input-styled ⌘K button) · flex spacer · notification bell (unread dot) · theme toggle. Sticky, 56px, translucent + blur.
- **Variants:** internal · guest (search hidden or account-scoped; account name shown).
- **States:** scrolled (subtle bottom border strengthens) · bell has-unread (dot).
- **Behaviour:** search launcher opens the Command Palette; identity/org live in the sidebar footer, not here (identity ≠ navigation).
- **Responsive:** search collapses to an icon `< sm`; controls stay right-aligned.
- **A11y:** `role="banner"`; each control labelled; bell announces unread count.

---

## 3 · Breadcrumb

- **Purpose:** show location in the hierarchy and let users jump up.
- **Anatomy:** `Area / Parent / Current` with chevron separators; last item is plain text (current).
- **Behaviour:** appears at **depth ≥ 2** only (e.g. Projects → *Website* → Board). Dynamic segments show real names, never UUIDs. Long names truncate with tooltip.
- **Responsive:** `< sm` collapses the middle to `…` (expandable), keeping first + current.
- **A11y:** `<nav aria-label="Breadcrumb">` + ordered list; current has `aria-current="page"`.

---

## 4 · Search (in-context)

- **Purpose:** filter the current collection (a project list, member roster, file grid).
- **Anatomy:** input with leading search icon, debounced (~250ms), trailing clear (`×`) + optional result count.
- **States:** idle · typing (spinner in trailing slot) · results · no-results (offers *Clear*).
- **Behaviour:** distinct from **global** search — scoped to the page's dataset; combines with active filter chips.
- **Responsive:** full-width above the collection on mobile.
- **A11y:** `role="searchbox"`, labelled; results update announced via live region; `Esc` clears.

---

## 5 · Global command palette (⌘K / Ctrl-K)

- **Purpose:** search everything + jump anywhere + run actions, from anywhere.
- **Anatomy:** centred overlay (elevation 5): input · grouped results — **Projects**, **Tasks**, **People**, **Jump to** (nav), **Actions** (e.g. "Create project", permission-gated).
- **Behaviour:** opens on ⌘K/Ctrl-K or the topbar launcher. Debounced query hits org-scoped, RLS-protected data. Arrow keys move, Enter selects, Esc closes; recent items show on empty query.
- **States:** empty (recents + suggested actions) · searching · results · empty-results.
- **Responsive:** full-screen sheet on mobile.
- **A11y:** `role="dialog"` + combobox pattern; focus trapped; active option via `aria-activedescendant`; returns focus to launcher on close.

---

## 6 · Modal / dialog

- **Purpose:** focused create/edit/confirm without leaving context.
- **Anatomy:** scrim (black 50–60%) · panel (elevation 4, `xl` radius) · title (H3) + optional description · content · footer (Cancel ghost, then Primary/Destructive right-aligned).
- **Variants:** confirm (max 480px) · form (max 640px) · destructive (typed-name confirmation for high risk).
- **Behaviour:** Esc + scrim-click close **unless** a form is dirty (then confirm discard). Focus trapped; returns to trigger on close. One dialog at a time.
- **Responsive:** `≤ sm` becomes a **bottom sheet** (drag-to-dismiss).
- **A11y:** `role="dialog" aria-modal="true"`, labelled by title, described by description; background inert.

---

## 7 · Drawer / side sheet

- **Purpose:** view/edit a record beside its context — chiefly **Task Detail** — without a full navigation.
- **Anatomy:** right-anchored panel (elevation 3), 480–640px; header (title + `⋯` + close) · scrollable body · optional sticky footer.
- **Behaviour:** opens from a list/board row; deep-linkable (`?task=<id>`), so it survives refresh and share. Esc/close/scrim dismiss (dirty-guard as modal). Content lazy-loads.
- **Responsive:** `< md` becomes full-screen; `≤ sm` a bottom sheet.
- **A11y:** dialog semantics, focus trap, restore focus to the originating row.

---

## 8 · Dropdown menu

- **Purpose:** a compact list of actions or options from a trigger.
- **Anatomy:** trigger → floating menu (elevation 2, `lg` radius); items with optional leading icon, trailing shortcut/checkmark; separators; section labels; destructive items in `destructive`.
- **Variants:** actions · single-select · multi-select (checkbox items) · nested submenu.
- **Behaviour:** click/Enter opens; type-ahead; auto-flips to stay in viewport; closes on select/Esc/outside-click.
- **Responsive:** may become a bottom sheet on mobile for long menus.
- **A11y:** `role="menu"`/`menuitem` (or `listbox` for selects), roving focus, arrow-key navigation, labelled trigger.

---

## 9 · Context menu (right-click)

- **Purpose:** power-user shortcut to row/card actions (kanban card, table row, file).
- **Anatomy:** same visual language as the dropdown, anchored at the pointer.
- **Behaviour:** opens on right-click / long-press (touch); mirrors the `⋯` menu so it's never the *only* path to an action. Closes on select/Esc/scroll.
- **Responsive:** long-press on touch; the `⋯` menu remains the primary discoverable path.
- **A11y:** reachable without right-click via the `⋯` trigger + keyboard; announced as a menu.

---

## 10 · Tables

See [DESIGN-SYSTEM §10](./DESIGN-SYSTEM.md#10--tables). Recap of behaviours: sortable headers, chip cells, avatar cells, right `⋯` actions, checkbox selection → bulk toolbar, sticky header + sticky first column, **card-list fallback below `md`**, empty/loading/error handled by the DataTable wrapper (skeleton rows, empty state, retry).

---

## 11 · Cards

- **Purpose:** summarise one entity (project, member, stat) as a scannable unit.
- **Anatomy:** container (`card`, 1px border, `lg` radius, 24px pad) · optional colour accent bar (tenant colour) · header (title + `⋯`) · body · footer meta.
- **Variants:** **Project card** (accent bar, name, account, progress ring, health chip, member avatars, deadline) · **Member/Developer card** (avatar, name, role, workload bar) · **Stat card** (label, big value, delta, icon) · **Entity card** (generic).
- **States:** rest (flat) · hover (elevation 1 + `primary/30` border) if interactive · selected · dragging (kanban).
- **Behaviour:** entire card is the click target when it represents one navigable entity; `⋯` and inner controls stop propagation. Never scale on hover (layout shift).
- **Responsive:** reflow 3→2→1 columns; padding drops to 16 on mobile.
- **A11y:** interactive card is a single focusable link/button with a full accessible name; nested actions are separately reachable.

---

## 12 · Forms

See [DESIGN-SYSTEM §11](./DESIGN-SYSTEM.md#11--forms). Adds: **dynamic custom fields** — the platform renders tenant-defined fields (`custom_field_definitions`) by type (text, number, date, select, multi-select, user, currency…) using the same field primitives; required/validation come from the definition. Guest-visible fields are marked and read-only for guests.

---

## 13 · Progress indicators

- **Progress bar:** linear track + indigo fill; height 6–8px; optional right-aligned `%` in mono. Health-tinted variant (emerald/amber/rose) for project rows.
- **Progress ring:** circular, sizes sm/md/lg; centre shows `%`; stroke colour follows health; used on cards and the guest hero.
- **Determinate vs indeterminate:** known % = filled; unknown = a slim indeterminate shimmer (used for uploads before size is known).
- **Rules:** progress values change **without animation flourish** (no bouncing); the number and the fill update together. 0% renders an empty track, not a hidden bar.
- **A11y:** `role="progressbar"` with `aria-valuenow/min/max`; ring/bar has a text equivalent nearby (never % by colour alone).

---

## 14 · Charts

- **Purpose:** trends and distributions on dashboards/reports — not decoration.
- **Types & fit:** line/area = trend over time (completions/week); bar = comparison (per-member throughput); **donut** = distribution (health split, status mix); stacked bar = composition over time; sparkline = inline micro-trend on stat cards.
- **Anatomy:** title · optional legend (omit when ≤2 series or directly labelled) · plot · axis labels · tooltip on hover/focus · empty + loading (skeleton) states.
- **Palette:** the categorical ramp from DESIGN-SYSTEM §2.4; sequential/diverging as specified; ≤6 categories.
- **Rules:** start bar axes at zero; label directly over legends where possible; every chart offers a **table alternative** for screen readers and export.
- **Responsive:** reduce ticks/labels on small screens; long horizontal series scroll inside their container; consider swapping to a compact stat on mobile.
- **A11y:** `role="img"` with a text summary, plus a visually-hidden data table; tooltips reachable by keyboard; not colour-only.

---

## 15 · Badges & chips

- **Status badge:** dot + label; category tint (DESIGN-SYSTEM §2.3); uses the tenant status name + colour.
- **Priority badge:** dot + label; may render icon-only in dense rows (with tooltip + aria-label).
- **Health badge:** on-track/at-risk/delayed; hovering reveals the *reason* (e.g. "12 days behind expected").
- **Count/notification badge:** small pill or dot on an icon; shows number up to 99, then `99+`.
- **Tag/label chip:** tenant tag colour; removable variant has an `×` with its own label.
- **Rules:** chips never rely on colour alone (always a label or tooltipped dot); consistent height (20–22px) and `sm` radius; keep to one line, truncate with tooltip.
- **A11y:** meaningful badges are readable text (not background-only); removable chips expose "Remove <tag>".

---

## 16 · Timeline (schedule / Gantt-lite)

- **Purpose:** show *who* is doing *what* and *when* — starts, ends, overlaps, milestones.
- **Anatomy:** left sticky lane labels (by assignee **or** by project — toggle); right scrollable time axis (day/week/month zoom); **bars** positioned by start→due, coloured by status category, with a **today** marker; **milestone diamonds** on the axis; overdue bars carry a rose edge.
- **Behaviour:** horizontal scroll/zoom; hover/focus a bar → popover (title, dates, assignee, status); click → opens Task Detail drawer. Drag-to-reschedule is a later enhancement (read-only in MVP); dependencies render as connectors when present.
- **States:** empty (no dated work → prompt to add dates) · loading (skeleton lanes) · dense (virtualised rows).
- **Responsive:** `< md` collapses to a **condensed agenda list** grouped by day/week (a horizontal Gantt is unusable on phones).
- **A11y:** bars are focusable buttons with full accessible names ("<Task>, <assignee>, <start>–<due>, <status>"); the condensed list is the accessible equivalent; keyboard moves between bars.

---

## 17 · Kanban cards & board

- **Board anatomy:** one **column per workflow status** (driven by the tenant's workflow, *not* fixed) with header (status dot + name + count + `+`), a scrollable card stack, and a drop indicator. Columns cap at ~50 cards with "show more".
- **Kanban card anatomy:** tenant colour accent · title · id (`WEB-42`, mono) · priority dot · due chip (rose if overdue) · assignee avatar · small meta (checklist `3/5`, comment/attachment counts) · blocked flag if blocked.
- **Behaviour:** drag to move between/within columns → **optimistic** status change (snap-back + toast on failure); the workflow's allowed transitions constrain valid drops (illegal target shows a "not allowed" affordance). WIP hints when a column exceeds a soft limit.
- **States:** dragging (lifted, elevation) · drop-target (column highlight) · empty column (subtle "Drop here") · loading (skeleton cards).
- **Responsive:** `< md` horizontal snap-scroll, one column at a time; card tap opens the drawer.
- **A11y:** drag has a **keyboard alternative** — focus a card, open its menu, "Move to <status>"; moves announced via live region; cards are focusable with complete names.

---

## 18 · Comment section

- **Purpose:** threaded discussion on a task/project (internal by default).
- **Anatomy:** chronological list · each item = avatar, author, relative time (absolute on hover), body, edited flag, reactions (later), reply + `⋯` (edit/delete own; moderate if permitted) · one-level replies indented · composer at the bottom (textarea, @mention autocomplete, attach, submit).
- **Behaviour:** posting is **optimistic** (pending style → confirmed/failed-retry). @mention notifies mentioned users who can already see the item. Internal comments are **never** visible to guests. Editing marks "edited"; history preserved in the activity log.
- **States:** empty ("No comments yet — start the discussion") · loading (skeleton bubbles) · sending · failed (inline retry) · realtime (new remote comments animate in on an open task).
- **Responsive:** composer sticks to the bottom of the drawer/sheet; full-width on mobile.
- **A11y:** semantic list; composer labelled; mention menu is a combobox; new-comment live-region announcement; edit/delete reachable by keyboard.

---

## 19 · File upload & files

- **Purpose:** attach and manage deliverables/evidence on tasks and projects.
- **Anatomy:** dropzone (drag-drop + browse) · per-file row (type icon, name, size, progress, cancel) · uploaded **file card/grid** (thumbnail/type icon, name, size, uploader, date, `⋯`) · a **"Visible to client/guest"** toggle (permission-gated).
- **Behaviour:** validates type + size **client-side (advisory) and server-side (authoritative)**; shows per-file progress; retriable failures; stored privately, served via short-TTL **signed URLs**; guest downloads only for files flagged guest-visible. Path is tenant-scoped.
- **States:** idle dropzone · drag-over (highlight) · uploading (progress) · success · error (type/size/network, with reason) · empty ("No files yet").
- **Responsive:** grid 4→2→1; dropzone full-width; large previews open in a modal.
- **A11y:** the dropzone has a real file `input` + button (keyboard/screen-reader path); progress announced; images have alt = filename; the visibility toggle is a labelled switch.

---

## 20 · Activity feed

- **Purpose:** the audit trail that replaces "any update?" — a running log of what happened.
- **Anatomy:** reverse-chronological list grouped by day; each item = actor avatar, a **humanised sentence** ("Ada moved *WEB-42* to Review"), relative time, and a link to the entity; type icon on the left.
- **Variants:** global (dashboard) · project-scoped (project tab) · entity-scoped (on a task). **Guest** feed shows only guest-visible events (no internal comments).
- **Behaviour:** infinite scroll (keyset), newest first; filter by type/actor (internal); never editable.
- **States:** empty ("No activity yet") · loading (skeleton lines) · end-of-list.
- **Responsive:** single column; timestamps shorten.
- **A11y:** semantic list; each item a self-contained sentence (not colour/icon-dependent); relative time carries an absolute `title`/`aria-label`.

---

## 21 · Notification center

- **Purpose:** personal, per-user alerts (assignments, mentions, deadlines, blocks, completions).
- **Anatomy:** bell (unread dot) → panel: header ("Notifications" + "Mark all read") · list (unread emphasised with a leading dot + tint) · each item = type icon, title, snippet, relative time · empty state · footer "View all" (full page for history).
- **Behaviour:** unread badge from a light poll (~60s); opening marks-as-seen optionally; clicking an item routes to its entity and marks it read; "Mark all read" is optimistic. Types map to `notification_type`.
- **States:** empty ("You're all caught up") · loading (skeleton) · has-unread.
- **Responsive:** panel becomes a full-height sheet on mobile.
- **A11y:** bell announces unread count; panel is a labelled menu/dialog; items are links with full names; mark-read has an accessible control.

---

## Cross-cutting content rules

- **Terminology:** every user-facing noun passes through the tenant terminology map. Specs say "Project/Task/Account" generically; the UI renders the tenant's word.
- **Numbers:** mono + tabular; relative time everywhere with absolute on hover.
- **Truncation:** always paired with a tooltip/`title`; never drop information silently.
- **Voice:** plain, calm, second person. Errors say what happened *and* the next step. Empty states tell the user what to do, never just "no data".
