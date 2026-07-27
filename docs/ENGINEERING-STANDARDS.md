# FlowDesk — Engineering Standards

**Status: enforced, not advisory.** Every PR is reviewed against this document and
the [Definition of Done](#14--definition-of-done). Code that violates a rule here
does not merge, regardless of whether it "works".

**Stack of record:** Next.js 15 (App Router, Server Actions) · React 19 · TypeScript
(strict) · Supabase (Postgres + Auth + Storage, RLS-first) · TanStack Query v5 ·
React Hook Form 7 + Zod 4 · Tailwind v4 + shadcn/ui (radix-nova) · Vercel.

**Document precedence** (higher wins on conflict): this file → [API-CONTRACT](./design/API-CONTRACT.md) → [DATABASE](./DATABASE.md) → [UX-SPEC](./design/UX-SPEC.md)/[DESIGN-SYSTEM](./design/DESIGN-SYSTEM.md) → [PRD](./PRD.md)/[SDD](./SDD.md).

**Three laws that override everything below:**
1. **The database is the source of truth.** RLS is the real access boundary; never trust the client for tenancy, permission, progress, numbering, or audit.
2. **One-way dependency flow.** `app → features → services → repositories → supabase`. Never import upward.
3. **No feature is done without its empty, loading, and error states, and a passing RLS check.**

---

## 1 · Project folder structure

```
src/
  app/            Routing ONLY. Thin route files: fetch via services, render features.
                  Route groups: (auth) public · (app) internal shell · (portal) guest
                  · auth/callback · api/ (route handlers: cron, webhooks, downloads).
  components/     SHARED, PRESENTATIONAL. No data fetching, no services.
    ui/           shadcn primitives (generated). Do not hand-edit; wrap instead.
    layout/       page-header, section, split-pane, shells.
    data/         data-table, empty-state, loading-skeleton, error-state.
    domain/       status-badge, priority-badge, progress-ring, avatar-stack, health-badge.
  features/       VERTICAL SLICES by capability. One folder per feature.
    <feature>/
      components/  feature-specific UI (not reused elsewhere)
      hooks/       feature-specific hooks (React Query wrappers)
      actions.ts   Server Actions (mutations) for this feature
      queries.ts   client query fns + query-key factory
  repositories/   DATA ACCESS. The ONLY place that imports a Supabase client.
  services/       BUSINESS LOGIC. Pure. No React, no SQL, no Supabase import.
  hooks/          Cross-feature React hooks (useDebounce, useMediaQuery…).
  lib/            Framework/infra wiring: supabase clients, auth context, env, utils(cn).
  schemas/        Zod schemas. Source of truth for validation AND inferred input types.
  types/          database.types.ts (generated) + shared domain/UI types.
  constants/      Enums-as-const, labels, badge styles, nav config, permission keys.
  utils/          Pure, dependency-free helpers (date, string, number).
supabase/
  migrations/     Versioned SQL — the schema source of truth.
  seed/           Local dev seed ONLY. Never production data.
docs/             PRD, SDD, DATABASE, design/, this file.
```

**Why each layer exists** (and what breaks without it):

| Folder | Reason to exist | Rule |
|---|---|---|
| `app/` | Next routing contract | Route files stay thin — no business logic, no direct Supabase queries beyond calling a service/repository. |
| `components/` | Cross-feature reuse without feature↔feature coupling | Presentational only; take props, emit callbacks. |
| `features/` | Group by capability; delete a feature = delete a folder | A feature may import `components/`, `services/`, `schemas/`, `hooks/`, `lib/`, `constants/`, `types/`. It must **not** import another feature. Shared code graduates to `components/` or `services/`. |
| `repositories/` | One place that knows table shapes | **Only** repositories import `@/lib/supabase/*`. A schema change touches this layer, not the whole app. |
| `services/` | Business rules in one testable place | No React, no Supabase. Pure functions over inputs → outputs. `permission.service`, `progress.service`, `health.service` live here so rules can't diverge between screens. |
| `schemas/` | Validation + types from one definition | Every action/route input has a schema; input types are `z.infer`, never re-declared. |
| `constants/` | Kill magic strings | Permission keys, labels, badge classes, nav — imported, never inlined. |

If you cannot decide where code goes, use the ["Where does this go?" table in SDD §6.4](./SDD.md#64-where-does-this-go).

---

## 2 · Naming conventions

| Kind | Convention | Example |
|---|---|---|
| **React component** | `PascalCase`; file `kebab-case.tsx`; one component per file (co-locate tiny subcomponents) | `ProjectCard` in `project-card.tsx` |
| **Component prop types** | `PascalCase` + `Props` suffix | `type ProjectCardProps = {…}` |
| **Hook** | `useCamelCase`; file matches | `useProjectFilters` in `use-project-filters.ts` |
| **Server Action** | `camelCase` **verb-first**; file `actions.ts` | `createProject`, `updateTaskStatus`, `inviteMember` |
| **Query fn / key factory** | `getX`/`listX`; `<entity>Keys` | `listProjects`, `projectKeys` |
| **Repository fn** | `verbEntity`, `camelCase`; file `<entity>.repository.ts` | `insertTask`, `findProjectById` |
| **Service fn** | pure verb; file `<name>.service.ts` | `computeWeightedProgress`, `canApprove` |
| **Zod schema** | `camelCase` + `Schema`; file `<entity>.schema.ts` | `createProjectSchema` |
| **Inferred input type** | `PascalCase` via `z.infer` | `type CreateProjectInput = z.infer<typeof createProjectSchema>` |
| **DB row/insert/update types** | via generated helpers | `Tables<'projects'>`, `TablesInsert<'tasks'>` |
| **DB enum union** | via generated helper | `DbEnums<'priority_level'>` |
| **Domain type / interface** | `PascalCase`, **`type` preferred** over `interface` (use `interface` only for extendable public contracts) | `type OrgContext = {…}` |
| **Enum values** | **No TS `enum`.** Use `as const` object or string union | `const PERMISSIONS = {…} as const` |
| **Constant** | `SCREAMING_SNAKE_CASE` | `PROGRESS_STEPS`, `ACTIVE_ORG_COOKIE` |
| **Boolean** | `is/has/can/should` prefix | `isGuest`, `canEdit` |
| **File (non-component)** | `kebab-case.ts` | `task.repository.ts` |
| **Folder** | `kebab-case`, singular for a thing, plural for a collection | `features/projects/`, `repositories/` |
| **Route segment** | `kebab-case`; dynamic `[id]`; groups `(name)` | `app/(app)/projects/[id]/board` |
| **Env var** | `SCREAMING_SNAKE_CASE`; public prefixed `NEXT_PUBLIC_`; server-only never prefixed | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Realtime channel** | `<domain>:<id>` | `board:{projectId}` |

**Rules:** no abbreviations except the well-known (`id`, `url`, `db`). No default exports except Next's required `page`/`layout`/`route`/`middleware`/`error`/`loading`. Filenames match their primary export's kebab form.

---

## 3 · Component rules

Layered by responsibility. A component belongs to exactly one category.

**Presentational (`components/domain`, `components/data`, `components/layout`)**
- Pure: props in, JSX out, callbacks up. **No** data fetching, no Server Actions, no Supabase, no router navigation logic beyond `Link`.
- Take domain objects, not loose primitives: `<TaskCard task={task} />`, not 8 props.
- Must render `hover / focus-visible / active / disabled` and, for collections, ship **empty / loading / error** variants.
- Default to Server Components; add `"use client"` only when interactivity/hooks require it.

**Container / Feature components (`features/<x>/components`)**
- May call feature `hooks`/`queries`, dispatch Server Actions, read `OrgContext`.
- Own state and orchestration; delegate rendering to presentational components.
- Never contain business rules — call a `service`.

**Reusable / Shared components (`components/`)**
- Graduate here only when used by **≥2 features**. Until then, keep them in the feature.
- Never import from `features/` (would invert the dependency graph).
- Wrap shadcn primitives; **never fork** `components/ui/*`.

**Universal rules**
- One responsibility per component; if it needs a paragraph to explain, split it.
- No business logic in JSX (extract to a service/util); no inline hex colours or spacing magic numbers (use tokens/scale).
- Client components are leaves where possible — push `"use client"` down the tree, not up.
- Accessibility is part of the component, not a later pass (labels, roles, focus — see §9 and DESIGN-SYSTEM §14).

---

## 4 · Server Action rules

**Where they live:** `features/<feature>/actions.ts`, first line `"use server"`. Cross-feature primitives (e.g. `setActiveOrganization`) live in the most-owning feature.

**Naming:** `camelCase`, verb-first, matching the [API contract](./design/API-CONTRACT.md) inventory.

**Signature & return:** every action returns the envelope — never throws for *expected* failure:
```
type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ApiError }
```
Actions that navigate call `redirect()` on success (and still return `{ ok:false }` on failure so the form renders it). Throwing is reserved for the truly unexpected (→ error boundary).

**Order of operations (mandatory sequence):**
1. **Configured?** short-circuit with `NOT_CONFIGURED` if Supabase env missing.
2. **Validate** input with the feature's Zod schema (`safeParse`). Fail → `VALIDATION` + `fields`.
3. **Resolve context** (`getOrgContext`) and **check permission** (`has_permission`/`can()`), for fast, friendly failure.
4. **Delegate**: call a `repository` (data) and/or `service` (rules). Actions orchestrate; they don't contain SQL or business math.
5. **Revalidate** affected paths/tags (`revalidatePath`/`revalidateTag`).
6. **Return** `{ ok:true, data }` or `redirect()`.

**Error handling:** map Supabase/Postgres errors to the code taxonomy (`23505`→`CONFLICT`, RLS denial→`FORBIDDEN`, `check_violation` from a transition→`TRANSITION_NOT_ALLOWED`, last-owner→`LAST_OWNER`). Never leak raw Postgres messages to the UI; log the technical detail server-side.

**Validation:** the server action is the **authoritative** validation boundary. Client-side validation is UX only and never trusted.

**Permission checking:** the app-layer check (step 3) is for UX; **RLS is the real gate**. Both must agree. Never implement authorization *only* in the action.

**Transactions / atomicity:** the Supabase client cannot run multi-statement transactions. If an operation must be atomic across rows/tables (tenant bootstrap, template instantiation, multi-row reorder), it goes into a **Postgres function** called via `rpc()` (see `bootstrap_organization`, `instantiate_project_template`). Do not simulate transactions with sequential client calls.

**Never:** put a Server Action's logic in a component; call the service-role client from an action except the three audited cases (accept invite, sign guest download URL, cron) with an explicit permission check first.

---

## 5 · Supabase rules

**Client selection**
- `lib/supabase/client.ts` — browser (Client Components).
- `lib/supabase/server.ts` — RSC / Server Actions / Route Handlers (per-request, cookie-bound).
- `lib/supabase/admin.ts` — **service role, server-only**, audited use only.
- Only `repositories/` import these. Everything else calls a repository.

**Query style**
- **Select explicit columns** in lists (`select('id, name, status_id, …')`). `select('*')` is allowed only for single-row detail fetches where every column is used.
- Embed relations instead of N+1: `select('*, account:accounts(name), assignee:profiles(full_name, avatar_url)')`.
- Always filter soft-deletes: `.is('deleted_at', null)` on every read of a soft-deletable table.
- `single()` when exactly one row is required (errors otherwise); `maybeSingle()` when zero is valid.
- Always handle `error` — never ignore it. Repositories return typed data or throw a mapped error.
- Aggregate in the database (`count`, `head:true`, RPC) — never fetch rows to count in JS.
- Order + keyset paginate every unbounded list (`.order().limit()` + cursor).

**Insert / Update / Delete**
- **Insert:** never set `organization_id`, `created_by`, task `number`, or `progress` from the client — triggers own them. Provide only user-authored fields.
- **Update:** patch only changed fields; never write derived columns (`progress`, `health`, `completed_at`). Status changes go through the dedicated action so the transition trigger runs.
- **Delete:** **soft delete** (`deleted_at = now()`), never hard `DELETE`, for any tenant-owned row. Cascading soft delete uses the provided RPCs (`soft_delete_project`).

**Realtime**
- Subscribe per **project/user**, never workspace/org-wide. Use the channels in [API-CONTRACT §0.8](./design/API-CONTRACT.md#08-realtime).
- Reconcile events into the React Query cache; do not trigger refetch storms.
- **Unsubscribe on unmount** (leaked channels exhaust connection limits).
- Ephemeral signals (drag position, presence) use broadcast/presence — no DB writes.

**Storage**
- Private `attachments`/`exports` buckets; **downloads via short-TTL signed URLs** generated server-side after a permission check. No public URLs for user files.
- Path is tenant-scoped: `{organization_id}/{project_id}/{uuid}-{filename}`. Validate MIME + size server-side (client checks are advisory).

**RLS**
- **Never bypass RLS.** The service role is used only for the three audited operations, each preceded by an explicit ownership/permission check in code.
- New tables ship with RLS enabled and policies **in the same migration** — never "add policies later".
- Policies call the `SECURITY DEFINER` helper functions (`has_permission`, `can_view_project`), never inline role strings.
- Realtime and Storage are governed by RLS too — verify a new table's policies cover the realtime/storage path, not just direct queries.

---

## 6 · React Query (TanStack Query v5) rules

**Query keys** — one factory per entity in `features/<x>/queries.ts`; keys are hierarchical and typed:
```
export const projectKeys = {
  all:    ['projects'] as const,
  lists:  () => [...projectKeys.all, 'list'] as const,
  list:   (orgId: string, filters: ProjectFilters) => [...projectKeys.lists(), orgId, filters] as const,
  detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
}
```
Never hand-write array keys at call sites — always the factory. Org id (or scope) is part of the key for every tenant-scoped query.

**Defaults** (set in the QueryClient): `staleTime` 60s, `refetchOnWindowFocus` false, `retry` 1. Override per-query intentionally, not by habit.

**Invalidation** — after a mutation, invalidate the narrowest key that covers the change (`projectKeys.detail(id)` and/or `projectKeys.lists()`). Never `queryClient.invalidateQueries()` with no key (nukes the cache). Realtime events invalidate/patch the same keys.

**Mutation pattern** — mutations wrap Server Actions and normalise the envelope:
```
useMutation({
  mutationFn: (input) => updateTaskStatus(input),   // server action
  onMutate: async (input) => { /* optimistic: cancel, snapshot, patch */ return { prev } },
  onError: (_e, _input, ctx) => { /* rollback ctx.prev; toast the error */ },
  onSettled: () => queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) }),
})
```
A failed action (`{ ok:false }`) is treated as an error path (rollback + toast), not a silent success.

**Optimistic update** — apply only to actions that rarely reject and where latency is felt: kanban move, checklist toggle, progress change, mark-read, post-comment. **Never** optimistic for create/delete/assign (permissions may reject). Always snapshot in `onMutate`, roll back in `onError`, reconcile in `onSettled`.

**Prefetch** — for known navigations, prefetch in the RSC (server) and hydrate, or `queryClient.prefetchQuery` on hover/intent. Detail data for a list item is prefetched on row hover.

**Caching** — server-fetched initial data is passed to the client and used as `initialData`/hydration; the client query then keeps it fresh. Don't double-fetch the same data on mount that the server already rendered.

**Never:** fetch in `useEffect`; store server data in `useState`; use React Query for form state (that's RHF).

---

## 7 · TypeScript rules

- **Strict mode on** (`strict: true`), plus `noUncheckedIndexedAccess` recommended. No loosening `tsconfig` to make errors disappear.
- **No `any`.** Use `unknown` at boundaries and narrow. `eslint` bans `any`. The escape hatch is a documented `// eslint-disable-next-line` with a reason, reviewed case-by-case.
- **No non-null `!`** except where invariants are proven and commented; prefer explicit guards/`?.`/`??`.
- **Generated DB types are the source of truth** for data shapes: `Tables<'…'>`, `TablesInsert<'…'>`, `DbEnums<'…'>` from `src/types/database.types.ts`. Regenerate on every schema change (`supabase gen types …`); never hand-edit rows.
- **Zod owns input types:** `type X = z.infer<typeof xSchema>`. Never declare an input interface that duplicates a schema.
- **Discriminated unions** for results/state (`ActionResult`, loading/error/success), so the compiler forces exhaustive handling.
- **`type` over `interface`** except for extendable public contracts. **No TS `enum`** — use `as const` unions (tree-shakeable, matches DB enum unions).
- Shared cross-feature types live in `types/`; feature-local types stay local. No `types/index.ts` dumping ground.
- Return types on exported functions are explicit; internal inference is fine.

---

## 8 · Form rules

- **React Hook Form + `zodResolver`** for every non-trivial form. The Zod schema is the **same** one the Server Action validates with (shared from `schemas/`) — one definition, both sides.
- **Submission:** RHF `handleSubmit` → call the Server Action → branch on the envelope. Map `error.fields` back onto RHF via `setError` so server validation shows inline. Simple forms may use `useActionState` directly; either way the server schema is authoritative.
- **Loading:** disable the form and show the button's loading state (`isSubmitting` / `useFormStatus`); label becomes the present-tense verb ("Saving…").
- **Toast (sonner):** success → concise confirmation toast; unexpected error → destructive toast. **Field/validation** errors render **inline**, not as toasts. Never both.
- **Error messages:** human, specific, actionable, next to the field (`aria-describedby`, `aria-invalid`, red border + icon). Form-level errors (e.g. `CONFLICT`) show in a banner above the form.
- **Validation timing:** on blur + on submit; never on every keystroke. First error is focused/scrolled into view on submit.
- **Inputs:** labels above (never placeholder-as-label); required marked on the label; mobile inputs ≥16px; destructive/irreversible submits require confirmation.

---

## 9 · UI rules

Follow [DESIGN-SYSTEM.md](./design/DESIGN-SYSTEM.md); it is the source of truth. Enforced specifics:

- **Tokens only.** Colours, spacing, radius, shadow come from tokens/scale (`bg-card`, `text-muted-foreground`, spacing steps). **No inline hex, no arbitrary `[13px]` magic values** except genuinely one-off layout.
- **Cards:** `card` surface, 1px border, `lg` radius, 24px padding, flat at rest; interactive cards lift to elevation-1 + `primary/30` border on hover; never scale (layout shift).
- **Buttons:** one Primary per view; verbs as labels; `destructive` behind confirmation; icon-only buttons carry `aria-label`; ≥44px touch target.
- **Inputs:** shadcn primitives, `md` radius, 2px indigo focus ring; disabled = muted + no pointer.
- **Tables:** sticky header, chip cells for status/priority, right-aligned tabular numerics, `⋯` row actions, **card-list fallback below `md`**; wide tables scroll inside their own container — the page body never scrolls sideways.
- **Dialogs:** ≤640px form / ≤480px confirm; focus-trapped; Esc/scrim close unless dirty; **bottom sheet below `sm`**.
- **Spacing & typography:** 4px scale; Body 14px base, never <12px; headings `tracking-tight` + balance; measure ≤70ch for prose.
- **Icons:** Lucide only, one set, sizes 16/18/20/24, no emoji-as-icon.
- **Dark mode:** never hard-code a colour — reference tokens so `.dark` resolves automatically; depth via surface lightness, not heavier shadow; re-check contrast in dark.
- **Reuse before build:** if a `components/ui` or `components/domain` element exists, use it; do not re-implement a Badge/Button/Table.
- Every interactive element renders hover, focus-visible, active, disabled.

---

## 10 · Performance rules

- **Pagination:** keyset (cursor) for every unbounded list/feed; kanban/Done columns capped with "show more"; never offset-paginate deep feeds.
- **Server-first data:** fetch in RSC where possible; pass to client as hydrated `initialData`. Avoid client fetch waterfalls; parallelise independent fetches (`Promise.all`).
- **Lazy loading / code-split:** `dynamic()` for heavy, conditionally-used modules — DnD engine (@dnd-kit), charts, timeline/Gantt renderer, rich-text, date picker, file preview. Keep initial shared JS **< 200KB gzipped**.
- **Memoization:** measure first. `memo`/`useMemo`/`useCallback` only for proven hot paths or to stabilise deps for expensive children — not by reflex. Prefer cheaper renders and correct keys over memo everywhere.
- **Virtualization:** lists/boards/tables that can exceed ~100 rows virtualize (windowing). Timelines virtualize lanes.
- **Suspense & streaming:** wrap slow sections in `Suspense` with skeleton fallbacks so the shell streams first; dashboards stream widgets independently — no full-page spinner.
- **Images:** `next/image` with explicit dimensions (no CLS), AVIF/WebP, lazy below the fold; initials fallback over placeholder images.
- **No blocking work in render:** derive with services/selectors; don't compute health/progress in a component.

---

## 11 · Security rules

- **Authentication:** Supabase Auth; session in httpOnly/secure/sameSite cookies (never localStorage). Use `getUser()` (revalidates with the auth server) — **never** trust `getSession()` alone for authorization. Middleware refreshes the session each request.
- **Authorization:** permission check in the action/route (UX) **and** RLS (authoritative). Guests are routed to the portal; RLS guarantees isolation even on shared links. Role changes are owner-only, DB-enforced. Never gate access in the UI alone.
- **Storage:** private buckets; signed URLs only; tenant-scoped paths; re-check visibility server-side before signing (especially guest downloads).
- **Uploads:** validate **MIME and size server-side** against the allow-list; enforce bucket size limits; reject on the server even if the client "checked". Virus scanning is roadmap — flag, don't assume.
- **Rate limiting:** throttle auth endpoints, invitations, password reset, and uploads (per-IP + per-user). Abuse-prone Server Actions get a limiter.
- **Input validation:** Zod at every server boundary; unknown keys stripped; ids validated as UUID; numeric/string bounds enforced. No trusting request shape.
- **Sanitization / XSS:** rely on React escaping; **no `dangerouslySetInnerHTML`** on user content. Comments are plain text or sanitized markdown (allow-list renderer). No building SQL by hand (Supabase parameterises).
- **Secrets:** `SUPABASE_SERVICE_ROLE_KEY` and cron secrets are server-only, never imported into a client module; `NEXT_PUBLIC_*` is treated as public. Enforced by module boundaries (`import "server-only"`).
- **Enumeration:** auth and password-reset responses are identical for existing/unknown accounts.
- **Audit:** never write to `activities` from the client; it's trigger-owned and append-only.

---

## 12 · Git rules

**Branch naming:** `<type>/<short-kebab-summary>` — types: `feature`, `fix`, `chore`, `refactor`, `docs`, `perf`, `test`. Example: `feature/project-crud`, `fix/kanban-drag-order`. Never work on the default branch directly.

**Commit convention:** Conventional Commits — `type(scope): summary` in the imperative mood.
- types: `feat` `fix` `chore` `refactor` `docs` `perf` `test` `build` `ci`.
- scope: the feature/area (`projects`, `tasks`, `db`, `auth`, `shell`).
- Example: `feat(projects): add create-project action and form`, `fix(tasks): reject illegal workflow transition`.
- One logical change per commit; keep them small and revertible. The message describes **the change and why**, not the tooling used to produce it.

**PR convention:**
- Small and focused — one feature/fix per PR; large work is split into stacked PRs.
- Title uses the commit convention; description states **what**, **why**, and **how verified**, and links the relevant spec section(s).
- Body includes the **Definition of Done checklist** (§14) with each item ticked.
- Self-review the diff before requesting review; CI (typecheck + lint + build + tests) must be green.
- No merge with unresolved review threads or a red pipeline. Squash-merge; the squash message follows the convention.

---

## 13 · Testing rules

Test the **rules and the boundaries**, not the framework. Coverage is targeted, not vanity-100%.

**Unit (Vitest)** — pure `services/`, `utils/`, and Zod `schemas/`.
- Mandatory for business rules: weighted project progress (BR-2), health computation (BR-5), workload/utilisation (BR-6), transition legality, permission resolution. These have exact expected values and must be locked by tests.
- No Supabase, no React — pure in/out.

**Integration (Vitest + PGlite / a real Postgres)** — the schema and RLS.
- Run migrations into an ephemeral Postgres, mock `auth.uid()` + roles, then assert: tenant isolation, guest containment, capability enforcement, trigger behaviour (numbering, progress rollup, activity logging), soft delete, last-owner protection. (The harness in `scratchpad/dbcheck` is the reference model — promote it into the repo's test suite.)
- Every new table/policy/trigger ships with an integration test proving the RLS intent — **an untested policy is an unverified policy**.

**E2E (Playwright)** — critical user journeys only:
- auth (sign in → dashboard), create project (+ from template), create/assign/move task on the kanban, guest sees only their account and cannot mutate, permission denial redirects.
- Run against a seeded test project; assert on visible outcomes and access boundaries, not implementation details.

**Rules:** tests are deterministic (no `Date.now()`/random without control); fixtures over shared mutable state; a bug fix adds the regression test that would have caught it; CI runs unit + integration on every PR, E2E on the critical set.

---

## 14 · Definition of Done

A feature is **complete only when every box is checked** — verified, not assumed. This is the literal PR checklist.

| # | Gate | How it is verified |
|---|---|---|
| 1 | **TypeScript passes** | `tsc`/`next build` type step green; zero `any`; no suppressed errors without a reviewed reason |
| 2 | **ESLint passes** | `npm run lint` clean; no disabled rules without justification |
| 3 | **Build passes** | `npm run build` succeeds; initial JS budget respected |
| 4 | **RLS works** | Integration test proves tenant isolation + the feature's permission matrix; guest containment where relevant |
| 5 | **Responsive works** | Verified at 375 / 768 / 1024 / 1440px; no horizontal body scroll; tables→cards, dialogs→sheets on mobile |
| 6 | **Loading state exists** | Skeletons matching final layout; streamed where slow; never a bare spinner on a full page |
| 7 | **Empty state exists** | `empty` (offer the action) and `no-results` (offer clear-filters) both handled with real copy |
| 8 | **Error state exists** | Field, section (retry), and page (boundary) errors handled; no raw exceptions surfaced |
| 9 | **Permission works** | UI hides what the role can't do **and** RLS blocks it; tested for at least one allowed + one denied role |
| 10 | **Documentation updated** | Relevant spec/contract/README updated; new tables → migration + regenerated types + `DATABASE.md`; new action → `API-CONTRACT.md` |

Additional standing gates (always apply):
- New DB objects have migrations **and** policies **and** an integration test in the same PR.
- New user-facing nouns route through the terminology map (no hard-coded "Project"/"Client").
- Accessibility floor met (labels, focus, keyboard, contrast, not-colour-only).
- No feature-to-feature imports; no Supabase import outside `repositories/`; no business logic in components.

> A feature that "works on my machine" but misses any gate above is **not done** and does not merge.
