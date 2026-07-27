# FlowDesk — Implementation Notes

Living notes that supplement the frozen blueprint (they don't change it). Added
in response to the Sprint 1 review.

---

## 1 · Activity Log payload — old vs. new values

`activities.metadata` is `jsonb`; its shape depends on `action`. Three payload
families:

| Family | Example actions | Payload |
|---|---|---|
| **State change (from → to)** | `task.status_changed`, `task.progress_updated`, `project.status_changed` | `{ "from": <old>, "to": <new> }` — emitted by **triggers**, which have `OLD`/`NEW` natively |
| **Creation (identity)** | `project.created`, `task.created`, `comment.created`, `attachment.uploaded` | key identifying fields, e.g. `{ "name": "Website" }`, `{ "title": "…" }`, `{ "file_name": "…" }` |
| **Field edit (multi-field diff)** | `project.updated` | `{ "changes": [ { "field": "name", "from": "Website", "to": "Website Rebuild" }, … ] }` |

### How `project.updated` is diffed
Computed in the **action** (`updateProject`), not a trigger:
1. fetch the current row (`before`) — RLS-scoped, so it doubles as the edit-permission/existence check;
2. apply the update;
3. build `changes` = each patched column whose value actually differs, as `{ field, from, to }`;
4. `log_activity(… 'project.updated' …, { changes })`.

Only changed fields appear; an edit that changes nothing logs an empty `changes` array.

### Why app-layer for edits, triggers for state
- Triggers own the `from/to` of **single, high-frequency** columns (status, progress) — cheap, and impossible to bypass.
- **Multi-field** edits are diffed in the action to keep the payload readable and avoid a heavier generic before/after trigger. All edits go through the action (Engineering Standards §4), so coverage is complete.
- If we ever need this to be bypass-proof (e.g. edits via SQL/other services), a forward migration can move the diff into a `projects` `BEFORE UPDATE` trigger and drop the action-side call. Deferred until there's a reason.

### Guarantees
- `actor_id` is a **column**, never in metadata. `is_guest_visible` gates whether guests see the entry at all; guest-visible payloads never contain hours or internal-only fields.
- The audit table is append-only and trigger/definer-written — the client never inserts activity.

---

## 2 · React Query cache invalidation after mutations

**Confirmed strategy** (matches Engineering Standards §5–6):

### Sprint 1 project surfaces are server-rendered (RSC), not React-Query-cached
So mutations invalidate through **Next.js revalidation**, and that is the correct tool here:

| Mutation | Server side | Client side |
|---|---|---|
| `createProject` | `revalidatePath('/projects')` | `router.push('/projects/[id]')` (lands on fresh RSC detail) |
| `updateProject` | `revalidatePath('/projects')` + `revalidatePath('/projects/[id]')` | `router.refresh()` |
| `archiveProject` / restore | same two paths | `router.refresh()` |
| `deleteProject` | `revalidatePath('/projects')` | `router.push('/projects')` |

Because the list/detail are RSC, `router.refresh()` re-runs the repository query **under RLS** — there is no client cache holding project rows to go stale.

### React Query is reserved for client-cached / interactive surfaces
Currently only the shell uses it (notifications, command search). Those follow the standard: keyed queries + `invalidateQueries({ queryKey })` on the mutation (e.g. mark-all-read invalidates `['notifications']`).

### When a future sprint adds a client-cached collection (e.g. the Kanban board with realtime)
Apply the Engineering-Standards pattern verbatim:
- a per-entity **query-key factory** (`taskKeys.list(projectId)`, …);
- mutations wrap the Server Action; `onMutate` optimistic patch + snapshot, `onError` rollback, `onSettled` `invalidateQueries({ queryKey: <narrowest key> })`;
- realtime events reconcile into the same keys;
- **never** a keyless `invalidateQueries()`.

**Bottom line:** Sprint 1 has no stale-cache risk; RSC revalidation is deliberate and sufficient. React Query invalidation kicks in when we introduce client-cached data, and the pattern is already specified.

---

## 3 · Performance — project list pagination & indexing

### Current behaviour
`listProjects(orgId, { search?, workspaceId?, includeArchived? })` selects explicit
columns + **to-one** embeds (account, owner, status, workspace) for one org, with
`deleted_at IS NULL`, `is_archived = false` by default, ordered `created_at DESC`.
Search/filter in Sprint 1 is **in-memory on the client** over the fetched set.

### Sizing (SDD §13.1)
At the 100-user tier, projects number in the low hundreds per org. Returning the
full non-archived set is acceptable; keyset/offset pagination is **not yet
required** (SDD §12.2 classes projects as "offset acceptable / bounded"). In-memory
client search over a few hundred rows is instant and costs the DB nothing.

### Indexes exercised (migrations 0002 / 0004)
- `idx_projects_org` = `(organization_id) WHERE deleted_at IS NULL` (**partial**) — serves the primary predicate.
- Supporting: `idx_projects_workspace`, `idx_projects_account`, `idx_projects_owner`, `idx_projects_status`, `idx_projects_dates`.
- `projects_key_uniq` = unique `(organization_id, key) WHERE key IS NOT NULL AND deleted_at IS NULL`.
- The list predicate `organization_id = $1 AND deleted_at IS NULL AND is_archived = false ORDER BY created_at DESC` is served by the partial org index; `is_archived` is filtered in-heap (cheap at this size).
- All embeds are **to-one** → index-backed single-row joins, **no N+1**.

### RLS cost
`projects_select` calls `can_view_project()` per row (a `STABLE` security-definer
function). Fine at hundreds of rows; the SDD scalability plan (500+ users) covers
growth via PgBouncer pooling and `report_snapshots`.

### Triggers to add pagination/indexing later (documented, not built now)
Introduce when a single org exceeds **~500 visible projects** or the list p95 exceeds **~300 ms**:
1. **Keyset pagination** on `(created_at, id)`; move search + filters **server-side**.
2. Add composite index **`(organization_id, is_archived, created_at DESC) WHERE deleted_at IS NULL`** to serve the exact list predicate+sort in one scan.
3. Server-side name search: `ILIKE '%…%'` can't use a btree index → add `pg_trgm` GIN or Postgres FTS (`tsvector`) per SDD §13.3.
4. For portfolio/dashboard aggregates, read from `report_snapshots` rather than computing per request.

No silent caps today: the list returns the full authorized set, so nothing is
hidden by an undocumented limit.
