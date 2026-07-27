# FSD 13 — Views & Insights

Five read/derived modules: **Timeline · Calendar · Reports · Analytics · Search.**
Each is a full feature spec; write-oriented facets are marked N/A per
[Conventions §K](./00-conventions.md#k--facet-applicability-for-read-only-modules).

---

## 13.1 Timeline

1. **Purpose** — Visualise scheduling: who is doing what and when (start→due bars), overlaps, and milestones, across a project or the org.
2. **User Story** — *As a manager I can see everyone's dated work on one timeline to spot overloads and slippage.*
3. **Actors** — Internal members (RLS-scoped); managers for capacity. Guests use the portal's timeline, not this.
4. **Preconditions** — Visible dated tasks/milestones in range.
5. **Main Flow** — Choose grouping (assignee/project) + zoom (day/week/month) + range → render sticky lanes + time axis + status-coloured bars + today marker + milestone diamonds → hover/focus a bar for details → click → Task Detail drawer.
6. **Alternative Flow** — Filter (project/assignee/status). Dependencies render as connectors when present. `< md` → condensed agenda list.
7. **Validation Rules** — `timelineSchema { from, to, groupBy, scope? }`; range bounded (perf).
8. **Business Rules** — Read-only in MVP (no drag-reschedule). Bars coloured by `status_category`; overdue bars carry a rose edge. Tasks without dates don't appear (backlog).
9. **Permission Rules** — internal member; RLS on tasks/projects; `project.view.all` widens org scope.
10. **Database Tables Used** — `tasks`, `milestones`, `task_dependencies`, `projects`, `profiles`, `workflow_statuses`.
11. **Server Actions Used** — None (query `getTimeline`).
12. **UI Components Used** — `Timeline`, `TimelineRow`, `TimelineBar`, `MilestoneMarker`, zoom control, group toggle, bar popover, agenda-list fallback.
13. **Notifications Triggered** — N/A (read).
14. **Activity Logs Generated** — N/A (read).
15. **Realtime Events** — Optional `board:{projectId}` refresh; none required.
16. **Loading State** — Skeleton lanes + bars.
17. **Empty State** — "Add start/due dates to see the timeline" + link to affected tasks.
18. **Error State** — Load failure → retry; inconsistent dates flagged softly (never blocking).
19. **Success State** — Bars render; interactions open tasks.
20. **Edge Cases** — Huge date spans (zoom/virtualize lanes); tasks with only a due date (default 1-day duration); overlapping bars per assignee (stacked); timezone (org tz); mobile (agenda).
21. **Acceptance Criteria** — (a) bars position correctly by start/due and colour by category; (b) today marker + overdue styling correct; (c) grouping toggle works; (d) keyboard users can traverse bars; (e) mobile falls back to an accessible agenda.
22. **QA Checklist** — Base +: bar math; RLS scoping; keyboard traversal; agenda equivalence; range-bound perf.
23. **Future Improvements** — Drag-to-reschedule (writes), dependency critical-path, capacity overlay, baseline vs actual, export to image/PDF.
- **CRUD/Transitions:** N/A — read-only view over Tasks/Milestones.

---

## 13.2 Calendar

1. **Purpose** — Deadline/milestone-centric view of due work by date (month/week/day).
2. **User Story** — *As a member I can see what's due on which day and jump to it.*
3. **Actors** — Internal members (personal + team scope).
4. **Preconditions** — Dated tasks/milestones in the visible range.
5. **Main Flow** — Month grid (default) → cells show due tasks + milestones as status-tinted chips → click a chip → Task Detail → click a day → create a task due that day (permitted).
6. **Alternative Flow** — Week/day views; "My items / All" scope toggle; filters; overflow "+N more" → day panel.
7. **Validation Rules** — `calendarSchema { from, to (≤ 62 days), scope?, filters? }`.
8. **Business Rules** — Shows due dates + milestone dates; respects org timezone. Creating from a day pre-sets `due_date`.
9. **Permission Rules** — internal member; RLS-scoped; create requires `task.create`.
10. **Database Tables Used** — `tasks`, `milestones`, `projects`, `workflow_statuses`.
11. **Server Actions Used** — `createTaskFromCalendar` (thin wrapper over `createTask`); query `getCalendar`.
12. **UI Components Used** — month/week/day grid, date cells, event chips, day detail panel, scope/filter controls, agenda fallback.
13. **Notifications Triggered** — Only via the wrapped `createTask` (assignment).
14. **Activity Logs Generated** — Only via `createTask` (`task.created`).
15. **Realtime Events** — Optional refresh; none required.
16. **Loading State** — Skeleton grid; events fill in.
17. **Empty State** — "Nothing due here" + hint to add due dates.
18. **Error State** — Range too large → `VALIDATION`; load failure → retry.
19. **Success State** — Events render; day-create adds a task and reflects it.
20. **Edge Cases** — Dense days (overflow panel); multi-day items (shown on due day in MVP); timezone boundaries; month with zero dated items; mobile → agenda list.
21. **Acceptance Criteria** — (a) events land on correct dates in org tz; (b) view/scope toggles work; (c) day-create sets due date; (d) grid is keyboard-navigable (date-grid pattern).
22. **QA Checklist** — Base +: date placement/tz; range bound; date-grid a11y; create-from-day; agenda fallback.
23. **Future Improvements** — Start–due spans across cells, drag to reschedule, external calendar sync (ICS/Google), team calendars, resource view.
- **CRUD/Transitions:** Read view; the only write is create-from-day (delegates to Tasks 07).

---

## 13.3 Reports

1. **Purpose** — Aggregated delivery insight with export: completion, on-time rate, throughput, health distribution, estimate accuracy.
2. **User Story** — *As a manager I can analyse delivery over a period and export it for leadership.*
3. **Actors** — Managers/Owners (`report.view`; export `report.export`).
4. **Preconditions** — Sufficient data in range; permission.
5. **Main Flow** — Choose scope (org/workspace/project) + range + filters → KPI row + charts + detail tables → drill a chart into its table → export CSV/PDF.
6. **Alternative Flow** — Reads `report_snapshots` when present, else computes live. Export writes to the private `exports` bucket → signed URL.
7. **Validation Rules** — `exportSchema { scope, scopeId, range, format }`; range/scope validated.
8. **Business Rules** — Metrics follow PRD BR-6 (throughput, on-time, estimate accuracy, cycle time). Snapshots are regenerable, never the source of truth.
9. **Permission Rules** — `report.view` to read; `report.export` to export; RLS scopes underlying rows.
10. **Database Tables Used** — `report_snapshots`, `tasks`, `projects`, `project_members`, `activities`, `organization_settings`; writes `storage.objects` (exports).
11. **Server Actions Used** — `generateReportExport`; query `getReport`; Route `POST /api/cron/snapshots`, `GET /api/reports/export`.
12. **UI Components Used** — date-range picker, scope selector, `StatCard`s, charts (line/donut/bar), data tables with export, per-widget empty/loading.
13. **Notifications Triggered** — N/A (read/export). (Scheduled report email = roadmap.)
14. **Activity Logs Generated** — Optional `report.exported` (internal).
15. **Realtime Events** — N/A.
16. **Loading State** — Skeleton KPIs + chart placeholders; charts stream independently.
17. **Empty State** — "Not enough data yet for this range" / fresh org guidance.
18. **Error State** — Widget failure → inline retry; export failure → toast; no permission → export hidden.
19. **Success State** — Metrics render; export produces a downloadable signed URL.
20. **Edge Cases** — Sparse data; very large range (snapshot-backed); timezone bucketing of "per week"; projects deleted mid-range (excluded); export of thousands of rows (server-side generation + progress).
21. **Acceptance Criteria** — (a) figures match the defined formulas; (b) scope/range/filters applied correctly and RLS-scoped; (c) export produces a valid, permission-gated file; (d) every chart has a table + text alternative.
22. **QA Checklist** — Base +: formula correctness vs fixtures; RLS scoping; export permission + signed URL; chart a11y (table alt); snapshot vs live parity.
23. **Future Improvements** — Custom report builder, scheduled email reports, saved report views, benchmarking, forecast/burndown, warehouse export.
- **CRUD/Transitions:** N/A — read + export only.

---

## 13.4 Analytics (Dashboard metrics)

1. **Purpose** — The always-on dashboard figures — portfolio KPIs, health split, completion trend, workload — assembled from snapshots + live aggregates. (Distinct from Reports: lighter, embedded, non-exportable.)
2. **User Story** — *As a user I open the dashboard and immediately see the state that matters to my role.*
3. **Actors** — Members (personal metrics); managers (portfolio + workload, permission-gated); guests excluded (portal instead).
4. **Preconditions** — Active org; `scope=all` requires `project.view.all`.
5. **Main Flow** — Dashboard requests metrics for the org and scope → KPI row + widgets (needs-attention, health donut, completion trend, workload, upcoming deadlines, recent activity) render, permission-gated → drill into an item.
6. **Alternative Flow** — Contributor scope shows My Work emphasis; manager scope shows portfolio + workload.
7. **Validation Rules** — `{ orgId, scope?: 'mine'|'all' }`; `all` gated.
8. **Business Rules** — Health per BR-5; workload/utilisation per BR-6 (remaining effort ÷ capacity, banded). Composition adapts to **permissions**, not fixed personas.
9. **Permission Rules** — base metrics: member; portfolio/workload: managers (`project.view.all`/member-manage); RLS scopes rows.
10. **Database Tables Used** — `projects`, `tasks`, `report_snapshots`, `activities`, `project_members`, `organization_settings`.
11. **Server Actions Used** — None (queries `getDashboardMetrics`, `getWorkload`).
12. **UI Components Used** — `StatCard`s, `DonutChart`, `MiniChart`/sparkline, needs-attention list, workload bars, deadlines list, `ActivityFeed`.
13. **Notifications Triggered** — N/A.
14. **Activity Logs Generated** — N/A.
15. **Realtime Events** — None (refresh on focus/navigation).
16. **Loading State** — Skeleton tiles + widgets streaming independently (no full-page spinner).
17. **Empty State** — New org → guided empty dashboard (create project / invite team / set up workflow); per-widget empties.
18. **Error State** — Per-widget inline retry; `FORBIDDEN` for `scope=all` without permission (falls back to `mine`).
19. **Success State** — Widgets render the role-appropriate picture; drill-through navigates.
20. **Edge Cases** — Empty org; single project; huge portfolio (snapshot-backed + capped lists); workload with unestimated tasks (weight defaults to 1); timezone for "this week".
21. **Acceptance Criteria** — (a) top row answers the role's core question <10s; (b) health/workload match BR-5/BR-6; (c) `scope=all` gated; (d) widgets stream and degrade independently.
22. **QA Checklist** — Base +: BR-5/BR-6 correctness; permission-gated widgets; independent widget error/empty; snapshot/live parity; scope gating.
23. **Future Improvements** — Configurable dashboards, saved widgets, anomaly highlights, trend deltas vs previous period, team vs personal toggles.
- **CRUD/Transitions:** N/A — read/derived only.

---

## 13.5 Search

1. **Purpose** — Global, org-scoped, RLS-safe search across projects, tasks, people, accounts — powering the ⌘K palette and the search page.
2. **User Story** — *As a user I can find and jump to anything I'm allowed to see, fast.*
3. **Actors** — Any member (results RLS-scoped); guests get only their account's data.
4. **Preconditions** — Active org; query ≥ 1 char.
5. **Main Flow** — Type in ⌘K / search box → debounced query → grouped results (Projects/Tasks/People/Accounts) + "Jump to" nav + permission-gated Actions → arrow/Enter to select → navigate.
6. **Alternative Flow** — Empty query shows recents + suggested actions. Full search page for broader, filterable results.
7. **Validation Rules** — `searchSchema { q: 1..100, scopeOrgId, types?, limit? ≤10/group }`.
8. **Business Rules** — Results are always RLS-scoped (never leak cross-tenant or unauthorized rows). Matching is **substring-based** via `ILIKE '%q%'` — it is *not* fuzzy/typo-tolerant, because `pg_trgm` is not enabled in this deployment. Trigram/FTS similarity ranking is a documented future improvement. Capped per group.
9. **Permission Rules** — authenticated member; RLS on every source table; guests restricted by account scope.
10. **Database Tables Used** — `projects`, `tasks`, `profiles`/`organization_members`, `accounts`.
11. **Server Actions Used** — None (query `globalSearch`; may log via an action).
12. **UI Components Used** — `CommandMenu`/`CommandDialog`, `SearchBox`, grouped result items, empty/recents state.
13. **Notifications Triggered** — N/A.
14. **Activity Logs Generated** — N/A (search analytics is a roadmap, privacy-reviewed).
15. **Realtime Events** — N/A.
16. **Loading State** — Inline "Searching…"; per-group skeletons on the full page.
17. **Empty State** — Empty query → recents + actions; no matches → "No results found".
18. **Error State** — `VALIDATION` (too long); transient failure → retry; never expose unauthorized rows.
19. **Success State** — Grouped results; selection navigates and closes.
20. **Edge Cases** — Very short/broad queries (min length + cap); special characters (escaped for ILIKE); large orgs (FTS migration trigger); guest scoping; duplicate names disambiguated by key/context.
21. **Acceptance Criteria** — (a) results are RLS-scoped (no leaks); (b) grouped, ranked, capped; (c) keyboard-first navigation; (d) guest results limited to their account; (e) debounced (no request per keystroke storm).
22. **QA Checklist** — Base +: RLS leak test (cross-tenant + guest); debounce; injection-safe `ILIKE`; keyboard nav; cap/rank; empty/recents.
23. **Future Improvements** — Postgres FTS + trigram, fuzzy matching, filters/scopes on the page, recent + saved searches, search within a project, dedicated search service (Typesense/Meili) at scale, command actions expansion.
- **CRUD/Transitions:** N/A — read-only.
