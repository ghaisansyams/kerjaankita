# FSD — Feature Specification Documents

The implementation-ready source of truth for **how every feature behaves**. Read
[00-conventions.md](./00-conventions.md) first — every module builds on it and
documents only its deviations.

Grounds in: [PRD](../PRD.md) · [SDD](../SDD.md) · [DATABASE](../DATABASE.md) ·
[design/UX-SPEC](../design/UX-SPEC.md) · [design/API-CONTRACT](../design/API-CONTRACT.md) ·
[ENGINEERING-STANDARDS](../ENGINEERING-STANDARDS.md).

## How to read a module spec

Every module covers all 23 facets: **Purpose · User Story · Actors · Preconditions ·
Main Flow · Alternative Flow · Validation · Business Rules · Permission Rules ·
DB Tables · Server Actions · UI Components · Notifications · Activity Logs ·
Realtime · Loading · Empty · Error · Success · Edge Cases · Acceptance Criteria ·
QA Checklist · Future Improvements** — plus a **CRUD breakout** (Create/Read/Update/
Delete/Archive/Restore/Duplicate/Bulk) and a **State-transition** table where they apply.
Read-only modules mark write-facets `N/A` with a reason (Conventions §K).

## Modules

| # | Module | File |
|---|---|---|
| — | Conventions & shared scaffolding | [00-conventions.md](./00-conventions.md) |
| 01 | Authentication | [01-authentication.md](./01-authentication.md) |
| 02 | Organization | [02-organization.md](./02-organization.md) |
| 03 | Workspace | [03-workspace.md](./03-workspace.md) |
| 04 | Member Management | [04-member-management.md](./04-member-management.md) |
| 05 | Settings (Configuration Hub) | [05-settings.md](./05-settings.md) |
| 06 | Projects | [06-projects.md](./06-projects.md) |
| 07 | Tasks | [07-tasks.md](./07-tasks.md) |
| 08 | Kanban | [08-kanban.md](./08-kanban.md) |
| 09 | Comments | [09-comments.md](./09-comments.md) |
| 10 | Attachments | [10-attachments.md](./10-attachments.md) |
| 11 | Notifications | [11-notifications.md](./11-notifications.md) |
| 12 | Activity Log | [12-activity-log.md](./12-activity-log.md) |
| 13a | Timeline | [13-views-and-insights.md](./13-views-and-insights.md#131-timeline) |
| 13b | Calendar | [13-views-and-insights.md](./13-views-and-insights.md#132-calendar) |
| 13c | Reports | [13-views-and-insights.md](./13-views-and-insights.md#133-reports) |
| 13d | Analytics | [13-views-and-insights.md](./13-views-and-insights.md#134-analytics-dashboard-metrics) |
| 13e | Search | [13-views-and-insights.md](./13-views-and-insights.md#135-search) |
| 14 | Guest Portal | [14-guest-portal.md](./14-guest-portal.md) |

All 18 requested modules are covered (Timeline/Calendar and Reports/Analytics/Search
are co-located in one file, each as its own complete section).

## Cross-module invariants (true for every feature)

- **RLS is authoritative.** Every permission rule names both the app-layer check and the RLS policy.
- **Activity is trigger-owned & append-only**; **notifications never self-notify** and only reach entitled recipients.
- **Soft delete** for tenant rows; **archive** is a separate reversible flag.
- **Every collection ships empty (empty *and* no-results), loading (skeleton), and error (field/section/page/permission) states.**
- **Terminology-aware** copy; **workflow-driven** statuses; **permission-driven** navigation.
- A feature is done only when it passes the [Definition of Done](../ENGINEERING-STANDARDS.md#14--definition-of-done).
