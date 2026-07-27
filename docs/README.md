# FlowDesk — Architecture Blueprint

Master design documents. **Read before implementing any phase.**

| Document | Contains |
|---|---|
| [PRD.md](./PRD.md) | Product requirements — what it does and why |
| [SDD.md](./SDD.md) | System design — how it's built |
| [DATABASE.md](./DATABASE.md) | **Multi-tenant v2 schema** (supersedes SDD §5) — 37 tables, RLS, functions |
| [design/DESIGN-SYSTEM.md](./design/DESIGN-SYSTEM.md) | Design foundations — colour, type, spacing, radius, elevation, icons, grid, buttons, tables, forms, dark mode |
| [design/UX-PATTERNS.md](./design/UX-PATTERNS.md) | 21 shared UI patterns (sidebar, command palette, kanban, comments, uploads…) |
| [design/UX-SPEC.md](./design/UX-SPEC.md) | Page-by-page UI/UX spec (18 pages, each with 11 facets) |
| [design/API-CONTRACT.md](./design/API-CONTRACT.md) | Backend API contract — Server Actions, Route Handlers, RLS, realtime (16 areas) |
| [ENGINEERING-STANDARDS.md](./ENGINEERING-STANDARDS.md) | **The rulebook every phase must pass** — structure, naming, actions, Supabase, RQ, TS, forms, UI, perf, security, git, testing, Definition of Done |
| [features/](./features/) | **Feature Specification Documents (FSD)** — implementation-ready behaviour for all 18 modules (23 facets each + CRUD + state transitions) |

> **Provenance note.** PRD/SDD were written for the single-company MVP. The
> platform was then generalised to **multi-tenant, multi-industry**; the
> authoritative data design is now `DATABASE.md`, and the design specs under
> `design/` reflect the generalised product (configurable workflows,
> terminology, permission-based access, guest portal). Where PRD/SDD conflict
> with these, the newer docs win.

## Section index

| § | Topic | Document |
|---|---|---|
| 1 | Business Flow | [PRD](./PRD.md#section-1--business-flow) |
| 2 | User Journey | [PRD](./PRD.md#section-2--user-journey) |
| 3 | Role Permission Matrix | [PRD](./PRD.md#section-3--role-permission-matrix) |
| 4 | Business Rules | [PRD](./PRD.md#section-4--business-rules) |
| 5 | Database Planning | [SDD](./SDD.md#section-5--database-planning-conceptual) |
| 6 | Folder Structure | [SDD](./SDD.md#section-6--folder-structure) |
| 7 | Design System | [SDD](./SDD.md#section-7--design-system) |
| 8 | Reusable Components | [SDD](./SDD.md#section-8--reusable-components) |
| 9 | Dashboard Widgets | [PRD](./PRD.md#section-9--dashboard-widgets) |
| 10 | Navigation | [SDD](./SDD.md#section-10--navigation) |
| 11 | Security | [SDD](./SDD.md#section-11--security) |
| 12 | Performance Strategy | [SDD](./SDD.md#section-12--performance-strategy) |
| 13 | Scalability | [SDD](./SDD.md#section-13--scalability) |
| 14 | Future Roadmap | [PRD](./PRD.md#section-14--future-roadmap-excluded-from-mvp) |

## Blocking decisions

Five decisions change the Phase 1 data model and need sign-off before Phase 2.
See **[PRD → Decisions requiring sign-off](./PRD.md#️-decisions-requiring-sign-off)**.

| # | Decision |
|---|---|
| D1 | Two-axis roles: workspace role + per-project function (adds QA & Designer) |
| D2 | Rename workspace role `developer` → `member` |
| D3 | CEO = `super_admin` with an executive dashboard variant (no new role) |
| D4 | Project progress becomes effort-weighted, not a simple average |
| D5 | Clients stay read-only in MVP; request intake is roadmap |

## Implementation status

| Phase | Scope | Status |
|---|---|---|
| 1 | Auth, roles, dashboard layout, DB schema, sidebar, navigation | ✅ Built, awaiting live verification |
| 2 | Project CRUD, Team Members, Client CRUD | ⏸ Blocked on D1–D5 sign-off |
| 3 | Task CRUD, Task Detail, File Upload, Comments | ⏸ |
| 4 | Kanban, Timeline, Calendar | ⏸ |
| 5 | Client Portal, Reports, Analytics | ⏸ |

**Phase 2 opens with a refactor** (introduce `services/` + `repositories/`) — see
[SDD §6.5](./SDD.md#65-refactor-required-before-phase-2).
