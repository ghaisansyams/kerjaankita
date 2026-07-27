# FlowDesk — Backend API Contract

The contract between the app and the data layer. **No implementation** — shapes,
authorization, validation, errors, tables, transport, and realtime only.

Built on the approved [DATABASE.md](../DATABASE.md) (37 tables, RLS, functions),
[PRD.md](../PRD.md) business rules, and [design/UX-SPEC.md](./UX-SPEC.md).

---

## 0 · Global conventions

### 0.1 Transport choice

| Mechanism | Used for |
|---|---|
| **Server Action** | Every mutation initiated from the app UI (create/update/delete/transition). Default choice. |
| **Route Handler (REST)** | Non-UI or external callers only: `/auth/callback` (OAuth/email code exchange), cron jobs (`/api/cron/*`), future webhooks (`/api/webhooks/*`), and file **download redirects** (`GET /api/files/[id]` → 302 to a signed URL, convenient for `<a download>` and guests). |
| **Direct Supabase query (RSC + React Query)** | Reads. There is **no bespoke REST for reads** — RLS makes direct, tenant-safe querying the correct pattern. Reads are specified below as **Query contracts** (repository signatures + shapes), executed in Server Components or via React Query on the client. |

> Rationale: Server Actions give typed, CSRF-protected, origin-checked mutations
> with no hand-rolled endpoints; RLS makes reads safe to issue directly. Custom
> REST is reserved for callers that aren't the React app.

### 0.2 Result envelope (Server Actions)

```
ActionResult<T> =
  | { ok: true;  data: T }
  | { ok: false; error: ApiError }

ApiError = {
  code: ErrorCode
  message: string                 // human-safe, surfaced in UI
  fields?: Record<string, string[]> // per-field validation messages
}
```

- **Expected** failures (validation, permission, conflict) are returned as `{ ok:false }` — never thrown — so forms render them cleanly.
- **Unexpected** failures throw and hit the nearest error boundary.
- Some actions **redirect** on success instead of returning data (noted per op); these still return `{ ok:false }` on failure so the form can show it.
- Mutations call `revalidatePath`/`revalidateTag` to refresh affected RSC data.

### 0.3 Error codes

| Code | ~HTTP | Meaning |
|---|---|---|
| `UNAUTHENTICATED` | 401 | No valid session |
| `FORBIDDEN` | 403 | Lacks permission / blocked by RLS |
| `VALIDATION` | 422 | Zod validation failed (`fields` populated) |
| `NOT_FOUND` | 404 | Row missing or invisible under RLS |
| `CONFLICT` | 409 | Unique violation (slug, key, duplicate invite) |
| `TRANSITION_NOT_ALLOWED` | 409 | Workflow forbids the status move |
| `LAST_OWNER` | 409 | Would remove an org's last owner |
| `RATE_LIMITED` | 429 | Throttled (auth, invites, uploads) |
| `PAYLOAD_TOO_LARGE` | 413 | File exceeds bucket limit |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Disallowed MIME |
| `NOT_CONFIGURED` | 503 | Supabase env missing (pre-connection) |
| `INTERNAL` | 500 | Unexpected |

### 0.4 Authorization model (defence in depth)

1. **Middleware** — authenticated vs. anonymous.
2. **Action/route guard** — `has_permission()`-style check via the resolved org context, for fast UX failure.
3. **RLS (authoritative)** — every query/mutation runs under the caller's session; the database is the real gate.
4. **Service-role escapes** — only where RLS *must* be bypassed after an explicit check: accepting an invitation, generating a guest download URL, cron jobs. Always server-only.

Each operation lists both the **permission key** (app-layer check) and the **RLS policy** that ultimately enforces it.

### 0.5 Tenancy

The **active organization** comes from the `flowdesk_org` httpOnly cookie, validated against real membership. Child rows derive `organization_id` from their parent by trigger — so mutation inputs never carry a spoofable `organization_id`.

### 0.6 Validation

Zod schemas live in `src/schemas/*` and run at the **server boundary** of every action (client validation is UX only). Every schema name is given; unknown fields are stripped; strings trimmed; ids validated as UUID.

### 0.7 Pagination

- **Keyset (cursor)** for unbounded feeds/lists: cursor = `(created_at,id)` or `(position,id)`; response returns `nextCursor`.
- **Bounded** collections (projects, members) may use range/offset.
- Default page sizes: activity/timeline 20, tasks 50, notifications 15, search 10/group, comments 30.

### 0.8 Realtime

Supabase Realtime via `postgres_changes`, **RLS-filtered** (a client only receives rows it may read). Tables added to the `supabase_realtime` publication:

`tasks · comments · notifications · projects · activities · project_members`

Channel conventions (client subscribes with a filter):

| Channel | Table · filter | Drives |
|---|---|---|
| `notifications:{userId}` | notifications · `user_id=eq` | live unread badge + toasts |
| `board:{projectId}` | tasks · `project_id=eq` | live kanban / list |
| `task:{taskId}` | comments · `entity_id=eq` | live comment thread |
| `project:{projectId}` | projects · `id=eq`, activities · `project_id=eq` | header progress + activity feed |

Ephemeral, high-frequency signals (drag position while dragging, presence/typing) use **Realtime broadcast/presence** channels, not database writes.

### 0.9 Idempotency & concurrency

- Invitation accept, org create (slug auto-resolve), and file register are safe to retry.
- Kanban `moveTask` uses fractional `position`; concurrent moves converge, with a periodic re-index job.
- Optimistic-locking isn't used in MVP; last-write-wins on scalar task fields, mitigated by realtime refresh.

---

# 1 · Authentication

**Purpose:** account lifecycle and session management on Supabase Auth (email+password, PKCE). Profiles are created by the `handle_new_user` trigger.

**Realtime:** none.

### `signIn` — Server Action
- **Authz:** public. **Validation:** `loginSchema { email: email, password: min(1) }`.
- **Request:** `{ email, password, redirectTo? }`
- **Response:** redirect to `redirectTo ?? /dashboard` (or `/onboarding` if no org); on failure `{ ok:false, error }`.
- **Errors:** `VALIDATION`, `FORBIDDEN` (bad credentials — generic message, constant-time), `NOT_CONFIGURED`, `RATE_LIMITED`.
- **Tables:** `auth.users` (managed), `profiles` (read for routing).

### `signUp` — Server Action
- **Authz:** public (or invite token pre-fills). **Validation:** `registerSchema { fullName: 2..80, email, password: min(8) }`.
- **Request:** `{ fullName, email, password, inviteToken? }`
- **Response:** `{ ok:true, data:{ needsEmailConfirm: boolean } }` or redirect when session issued; invited users auto-join the inviting org.
- **Errors:** `VALIDATION`, `CONFLICT` (email exists), `RATE_LIMITED`, `NOT_CONFIGURED`.
- **Tables:** `auth.users`, `profiles` (via trigger), `invitations` (if token).

### `signOut` — Server Action
- **Authz:** authenticated. **Request:** none. **Response:** redirect `/login`. **Errors:** none surfaced. **Tables:** `auth.users`.

### `requestPasswordReset` — Server Action
- **Validation:** `forgotPasswordSchema { email }`. **Request:** `{ email }`.
- **Response:** `{ ok:true }` **always** (no user enumeration). **Errors:** `VALIDATION`, `RATE_LIMITED`. **Tables:** `auth.users`.

### `updatePassword` — Server Action
- **Authz:** authenticated (post reset-link session). **Validation:** `resetPasswordSchema { password: min(8), confirm } refine(equal)`.
- **Response:** redirect `/dashboard`. **Errors:** `VALIDATION`, `FORBIDDEN` (expired link). **Tables:** `auth.users`.

### `GET /auth/callback` — Route Handler
- **Purpose:** exchange the `code` from email/OAuth links for a session, then redirect to `next`.
- **Request:** query `?code&next?`. **Response:** 302 → `next ?? /dashboard`; on failure 302 → `/login?error=…`.
- **Errors:** invalid/expired code → redirect with message. **Tables:** `auth.users`.

### `getProfile` / `getOrgContext` — Query contract
- **Purpose:** resolve current profile, memberships, active org, and permission set for rendering/guards.
- **Response:** `Profile`, `OrgContext { organization, membership, role, permissions:Set<string>, isGuest }`.
- **Tables:** `profiles`, `organization_members`, `organizations`, `roles`, `role_permissions`.

---

# 2 · Organization

**Purpose:** create and administer tenants; configure industry adaptation (terminology, business constants, features).

**Realtime:** optional `organizations` / `organization_settings` change on active org (low value; refresh-on-focus is enough).

### `createOrganization` — Server Action → RPC `bootstrap_organization`
- **Authz:** any authenticated user (creates for **self** only — enforced inside the SECURITY DEFINER function). **Validation:** `createOrganizationSchema { name: 2..80, industryKey }`.
- **Request:** `{ name, industryKey }` (slug derived + auto-deduped server-side).
- **Response:** sets active-org cookie, redirect `/dashboard`. Data: `{ organizationId }`.
- **Errors:** `VALIDATION`, `FORBIDDEN` (spoofed owner), `INTERNAL`.
- **Tables:** `organizations`, `organization_settings`, `workspaces`, `workflows`, `workflow_statuses`, `organization_members`, `workspace_members`, `industries`, `roles`.

### `updateOrganization` — Server Action
- **Authz:** `organization.update`; RLS `organizations_update`. **Validation:** `updateOrganizationSchema { name?, logoUrl?, website? }`.
- **Request/Response:** `{ id, …patch }` → `{ ok:true, data: Organization }`.
- **Errors:** `VALIDATION`, `FORBIDDEN`, `NOT_FOUND`. **Tables:** `organizations`.

### `updateOrganizationSettings` — Server Action
- **Purpose:** the industry-fit controls — terminology map, timezone, capacity, health tolerance, blocked threshold, feature flags.
- **Authz:** `organization.settings.update`; RLS `org_settings_write`.
- **Validation:** `orgSettingsSchema { timezone?, weekStart? 0..6, workingHoursPerDay?, capacityHoursPerWeek?, healthTolerancePoints? 0..100, blockedThresholdDays?, terminology?: Record<string,string>, features?: Record<string,boolean> }`.
- **Response:** `{ ok:true, data: OrganizationSettings }`. **Errors:** `VALIDATION`, `FORBIDDEN`. **Tables:** `organization_settings`.

### `setActiveOrganization` — Server Action
- **Authz:** must be an active member of the target org. **Request:** `{ organizationId }`. **Response:** set cookie, redirect `/dashboard`. **Errors:** `FORBIDDEN`/`NOT_FOUND` (not a member). **Tables:** `organization_members`.

### `deleteOrganization` — Server Action
- **Authz:** `organization.delete` (owner). **Validation:** typed-name confirmation. **Request:** `{ id, confirmName }`. **Response:** soft-delete → redirect to org picker. **Errors:** `FORBIDDEN`, `VALIDATION`, `CONFLICT`. **Tables:** `organizations` (+ cascade soft-delete job).

### `listMyOrganizations` / `getOrganization` — Query contract
- **Response:** `Organization[]` (active memberships) / `Organization & { settings }`. **Tables:** `organizations`, `organization_members`, `organization_settings`.

---

# 3 · Workspace

**Purpose:** subdivide an org (department, office, product line, client portfolio); scope projects and membership.

**Realtime:** none (config-level).

### `createWorkspace` / `updateWorkspace` / `archiveWorkspace` — Server Actions
- **Authz:** `workspace.create` / `workspace.update` / `workspace.delete`; RLS `workspaces_*`.
- **Validation:** `workspaceSchema { name: 2..80, slug?: slug, description?, color?, icon? }` (slug unique per org).
- **Request:** create `{ name, description?, color? }`; update `{ id, …patch }`; archive `{ id }`.
- **Response:** `{ ok:true, data: Workspace }`. **Errors:** `VALIDATION`, `CONFLICT` (slug), `FORBIDDEN`, `NOT_FOUND`.
- **Tables:** `workspaces`.

### `addWorkspaceMember` / `changeWorkspaceMemberRole` / `removeWorkspaceMember` — Server Actions
- **Authz:** `workspace.member.manage` (scoped to the workspace); RLS `workspace_members_write`.
- **Validation:** `workspaceMemberSchema { workspaceId, userId, roleId }`.
- **Request/Response:** `{ workspaceId, userId, roleId }` → `{ ok:true }`.
- **Errors:** `VALIDATION`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT` (already a member). **Tables:** `workspace_members`, `roles`.

### `listWorkspaces` / `getWorkspace` — Query contract
- **Response:** `Workspace[]` for the org / `Workspace & { members, projectCount }`. **Tables:** `workspaces`, `workspace_members`, `projects`.

---

# 4 · Members (organization_members + invitations)

**Purpose:** roster management — invite, role, status, member/guest, account linkage. Guests are external collaborators scoped to an account.

**Realtime:** optional `organization_members` changes for the Members screen.

### `inviteMember` — Server Action
- **Authz:** `invitation.manage`; RLS `invitations_write`. **Validation:** `inviteSchema { email, roleId, memberType: 'member'|'guest', workspaceId?, accountId? }` (accountId required-ish for guest linkage).
- **Request:** `{ email, roleId, memberType, workspaceId?, accountId? }`
- **Response:** `{ ok:true, data:{ invitationId } }` (email delivery is roadmap; token stored + link returned/copied).
- **Errors:** `VALIDATION`, `FORBIDDEN`, `CONFLICT` (already invited/member), `RATE_LIMITED`.
- **Tables:** `invitations`, `roles`, `accounts` (validate link).

### `acceptInvitation` — Server Action *(service-role assisted)*
- **Purpose:** join the org named by a token. **Authz:** authenticated; token validated (matches email, `pending`, not expired). Service role performs the membership insert after the check.
- **Validation:** `acceptInviteSchema { token }`.
- **Request:** `{ token }`. **Response:** set active-org cookie, redirect `/dashboard`.
- **Errors:** `NOT_FOUND` (bad token), `CONFLICT` (already a member / accepted), `FORBIDDEN` (email mismatch), `VALIDATION` (expired).
- **Tables:** `invitations`, `organization_members`.

### `resendInvitation` / `revokeInvitation` — Server Actions
- **Authz:** `invitation.manage`. **Request:** `{ invitationId }`. **Response:** `{ ok:true }`. **Errors:** `FORBIDDEN`, `NOT_FOUND`, `CONFLICT` (already accepted). **Tables:** `invitations`.

### `changeMemberRole` / `changeMemberStatus` / `convertMemberType` / `removeMember` — Server Actions
- **Authz:** `organization.member.manage`; RLS `org_members_write`. Guarded by the `prevent_last_owner_removal` trigger.
- **Validation:** `memberUpdateSchema { memberId, roleId?, status?, memberType?, accountId? }`.
- **Request/Response:** `{ memberId, …patch }` → `{ ok:true }`.
- **Errors:** `VALIDATION`, `FORBIDDEN`, `LAST_OWNER`, `NOT_FOUND`. **Tables:** `organization_members`, `roles`, `accounts`.

### `listMembers` / `getMember` — Query contract
- **Purpose:** roster with role, type, status, and derived **workload** (remaining effort vs capacity). Filters: role, status, type, search.
- **Response:** `Member[] = (profile + membership + role + workload)`; keyset/offset paginated.
- **Tables:** `organization_members`, `profiles`, `roles`, `tasks` (workload), `organization_settings` (capacity).

---

# 5 · Roles & Permissions (RBAC)

**Purpose:** view system roles, define custom tenant roles, and edit permission grants — the mechanism behind permission-based UI everywhere.

**Realtime:** none.

### `listPermissions` — Query contract
- **Authz:** authenticated org member; RLS `permissions_read`. **Response:** `Permission[]` grouped by `category`. **Tables:** `permissions`.

### `listRoles` / `getRole` — Query contract
- **Response:** system roles (`organization_id IS NULL`) + tenant roles, each with its permission keys. **Tables:** `roles`, `role_permissions`, `permissions`.

### `createRole` / `updateRole` / `deleteRole` — Server Actions
- **Authz:** `organization.role.manage`; RLS `roles_write`. **Validation:** `roleSchema { name: 2..60, scope: 'organization'|'workspace'|'project', description?, rank? }`.
- **Request/Response:** `{ …role }` → `{ ok:true, data: Role }`. Deleting a role in use warns + requires reassignment.
- **Errors:** `VALIDATION`, `FORBIDDEN`, `CONFLICT` (key/name), `NOT_FOUND`. **Tables:** `roles`.

### `setRolePermissions` — Server Action
- **Purpose:** replace a role's permission set (the matrix editor).
- **Authz:** `organization.role.manage`; RLS `role_permissions_write` (only tenant roles — system roles are read-only).
- **Validation:** `rolePermsSchema { roleId, permissionKeys: string[] }` (keys validated against catalogue).
- **Response:** `{ ok:true, data:{ granted: string[] } }`. **Errors:** `VALIDATION`, `FORBIDDEN` (system role), `NOT_FOUND`. **Tables:** `role_permissions`, `permissions`, `roles`.

---

# 6 · Projects

**Purpose:** the work container and primary security boundary; supports templates, milestones, membership, sub-projects, visibility.

**Realtime:** `project:{id}` (progress/status/header) and `projects` inserts on the active org for the list.

### `createProject` — Server Action (optionally → RPC `instantiate_project_template`)
- **Authz:** `project.create` (scoped to `workspaceId`); RLS `projects_insert`.
- **Validation:** `createProjectSchema { name: 2..120, workspaceId, accountId?, templateId?, ownerId?, visibility: enum, color?, startDate?, endDate?, key?(2..6 upper) }` with `startDate<=endDate`.
- **Request:** `{ …fields }`. If `templateId` present, tasks/milestones/checklists are instantiated (offsets → dates).
- **Response:** redirect `/projects/[id]`; data `{ id }`.
- **Errors:** `VALIDATION`, `FORBIDDEN`, `NOT_FOUND` (workspace/account/template), `CONFLICT` (key).
- **Tables:** `projects` (+ template path: `tasks`, `milestones`, `task_checklist_items`, `workflow_statuses`).

### `updateProject` — Server Action
- **Authz:** `project.update` (workspace+project scope); RLS `projects_update`.
- **Validation:** `updateProjectSchema` (partial of create + `statusId?`, `progress` is derived, not settable).
- **Request/Response:** `{ id, …patch }` → `{ ok:true, data: Project }`. **Errors:** `VALIDATION`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`.
- **Tables:** `projects`, `workflow_statuses`.

### `archiveProject` / `deleteProject` — Server Action → RPC `soft_delete_project`
- **Authz:** `project.delete`; RLS `projects_delete`. **Validation:** typed-name confirm for delete.
- **Request:** `{ id, confirmName? }`. **Response:** `{ ok:true }` + redirect `/projects`.
- **Errors:** `FORBIDDEN`, `VALIDATION`, `NOT_FOUND`. **Tables:** `projects` (+ cascading soft delete of tasks/milestones/members/comments/attachments).

### Project members — `addProjectMember` / `changeProjectMemberRole` / `removeProjectMember`
- **Authz:** `project.member.manage` (project scope); RLS `project_members_write`.
- **Validation:** `projectMemberSchema { projectId, userId, roleId, allocationPct? 0..100 }`.
- **Response:** `{ ok:true }`. **Errors:** `VALIDATION`, `FORBIDDEN`, `CONFLICT`, `NOT_FOUND`. **Tables:** `project_members`, `roles`, `activities` (member_added).

### Milestones — `createMilestone` / `updateMilestone` / `deleteMilestone` / `reorderMilestones`
- **Authz:** `milestone.manage` (project scope); RLS `milestones_write`.
- **Validation:** `milestoneSchema { projectId, name: 1..120, dueDate?, description?, position? }`.
- **Response:** `{ ok:true, data: Milestone }`. **Errors:** `VALIDATION`, `FORBIDDEN`, `NOT_FOUND`. **Tables:** `milestones`.

### `listProjects` / `getProject` — Query contract
- **Purpose:** filtered list (status, health, owner, workspace, account, tag, search) and full detail (with derived **health** via `compute_project_health`, counts, members, account, milestones, custom fields).
- **Response:** `ProjectListItem[]` / `ProjectDetail`. Health computed at read time (never stored).
- **Tables:** `projects`, `workspaces`, `accounts`, `profiles`, `project_members`, `milestones`, `tasks`, `custom_field_values`, `workflow_statuses`.

---

# 7 · Tasks

**Purpose:** the atomic unit of work; highest write volume. Status is **workflow-driven**; transitions and column-level edit rights are enforced by triggers + RLS.

**Realtime:** `board:{projectId}` (tasks changes) for live board/list; broadcast channel for in-flight drag ordering.

### `createTask` — Server Action
- **Authz:** `task.create` (project scope); RLS `tasks_insert`.
- **Validation:** `createTaskSchema { projectId, title: 1..200, description?, priority?, assigneeId?, statusId?, parentId?, milestoneId?, startDate?, dueDate?, estimatedHours?, templateId? }` with `startDate<=dueDate`.
- **Request:** `{ …fields }`. Server sets `reporter_id=auth.uid()`; triggers assign `number`, derive org/workflow/initial status.
- **Response:** `{ ok:true, data: Task }`. **Errors:** `VALIDATION`, `FORBIDDEN`, `NOT_FOUND` (project). 
- **Tables:** `tasks` (+ `activities`, `notifications` via trigger; `projects.task_seq`, `projects.progress`).

### `updateTask` — Server Action (manager fields)
- **Authz:** `task.update.any` (project scope); RLS `tasks_update`. Column guard: only managers change title/priority/dates/estimate/assignee.
- **Validation:** `updateTaskSchema` (partial; `progress`/`status` via dedicated actions below).
- **Response:** `{ ok:true, data: Task }`. **Errors:** `VALIDATION`, `FORBIDDEN`, `NOT_FOUND`. **Tables:** `tasks`, `activities`.

### `updateTaskStatus` — Server Action
- **Purpose:** move a task through the workflow (board drag or select).
- **Authz:** `task.update.any` **or** (`task.update.own` and assignee); RLS `tasks_update`. Transition legality enforced by `tasks_before_write` (`is_transition_allowed`).
- **Validation:** `taskStatusSchema { taskId, statusId, reason? }` — `reason` required when the transition's `requires_comment` is set (e.g. Blocked/QA-fail).
- **Request:** `{ taskId, statusId, reason? }`. **Response:** `{ ok:true, data: Task }` (progress auto-applied by status category).
- **Errors:** `TRANSITION_NOT_ALLOWED`, `VALIDATION` (missing reason), `FORBIDDEN`, `NOT_FOUND`.
- **Tables:** `tasks`, `workflow_statuses`, `workflow_transitions`, `activities`, `notifications`.
- **Realtime:** `board:{projectId}` UPDATE; `project:{id}` progress refresh.

### `updateTaskProgress` — Server Action (assignee)
- **Authz:** `task.update.own` (assignee) or `task.update.any`. **Validation:** `taskProgressSchema { taskId, progress: 0..100 step 10, actualHours? }`.
- **Response:** `{ ok:true, data: Task }`. **Errors:** `VALIDATION`, `FORBIDDEN`, `NOT_FOUND`. **Tables:** `tasks`, `activities`, `projects.progress` (rollup trigger).

### `assignTask` — Server Action
- **Authz:** `task.assign` / `task.update.any`. **Validation:** `assignSchema { taskId, assigneeId|null }`.
- **Response:** `{ ok:true }`. **Errors:** as above. **Tables:** `tasks`, `activities`, `notifications` (assignee).

### `blockTask` / `unblockTask` — Server Actions
- **Authz:** assignee, QA/reviewer, or `task.update.any`. **Validation:** `blockSchema { taskId, reason: min(3) }` (reason mandatory — PRD BR-4).
- **Response:** `{ ok:true }`. **Errors:** `VALIDATION` (no reason), `FORBIDDEN`. **Tables:** `tasks`, `activities`, `notifications` (PM/lead).

### `moveTask` — Server Action (kanban ordering)
- **Purpose:** reorder within/between columns. **Authz:** as `updateTaskStatus`.
- **Validation:** `moveSchema { taskId, statusId, beforeId?, afterId? }` → server computes fractional `position`.
- **Response:** `{ ok:true, data:{ position } }`. **Errors:** `TRANSITION_NOT_ALLOWED`, `FORBIDDEN`. **Tables:** `tasks`. **Realtime:** `board:{projectId}`.

### `deleteTask` — Server Action
- **Authz:** `task.delete`; RLS `tasks_delete`. Soft delete. **Request:** `{ taskId }`. **Response:** `{ ok:true }`. **Errors:** `FORBIDDEN`, `NOT_FOUND`. **Tables:** `tasks` (+ progress rollup).

### Checklist — `addChecklistItem` / `toggleChecklistItem` / `updateChecklistItem` / `deleteChecklistItem` / `reorderChecklist`
- **Authz:** `can_edit_task` (assignee or manager); RLS `checklist_write`.
- **Validation:** `checklistSchema { taskId, content?: 1..300, itemId?, isDone?, position? }`.
- **Response:** `{ ok:true, data: ChecklistItem }`. **Errors:** `VALIDATION`, `FORBIDDEN`, `NOT_FOUND`. **Tables:** `task_checklist_items`.

### Dependencies — `addDependency` / `removeDependency`
- **Authz:** `task.update.any`; RLS `task_deps_write`. **Validation:** `depSchema { predecessorId, successorId, type, lagDays? }` (no self-dep; cycle check server-side).
- **Response:** `{ ok:true }`. **Errors:** `VALIDATION` (cycle/self), `FORBIDDEN`. **Tables:** `task_dependencies`.

### `listTasks` / `getTask` — Query contract
- **Purpose:** board (grouped by status), list (filters: status category, assignee, priority, due, tag, search), **My Work** (assignee=me bucketed overdue/today/tomorrow/upcoming), and full task detail.
- **Response:** `Task[]` / `TaskDetail (+ checklist, comments count, attachments, dependencies, custom fields, status+workflow)`.
- **Tables:** `tasks`, `workflow_statuses`, `profiles`, `task_checklist_items`, `task_dependencies`, `custom_field_values`.

---

# 8 · Task Comments

**Purpose:** threaded discussion on a task/project; internal by default (guests never see internal comments); @mentions notify.

**Realtime:** `task:{taskId}` (comments changes) → live thread.

### `addComment` — Server Action
- **Authz:** `comment.create` (project scope); RLS `comments_insert` (author = self, must view the entity).
- **Validation:** `commentSchema { entity: 'task'|'project', entityId, body: 1..5000, parentId?, isInternal? (default true), mentions?: uuid[] }`.
- **Request:** `{ …fields }`. **Response:** `{ ok:true, data: Comment }` (optimistic on client).
- **Errors:** `VALIDATION`, `FORBIDDEN`, `NOT_FOUND`. **Tables:** `comments` (+ `activities`, `notifications` for mentions via trigger).

### `editComment` / `deleteComment` — Server Actions
- **Authz:** author (edit/delete own) or `comment.moderate` (delete any); RLS `comments_update`/`comments_delete`.
- **Validation:** `editCommentSchema { commentId, body: 1..5000 }`.
- **Response:** `{ ok:true }` (edit sets `is_edited`). **Errors:** `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`. **Tables:** `comments`.

### `listComments` — Query contract
- **Purpose:** thread for an entity (one-level replies), guests excluded from internal. Keyset paginated.
- **Response:** `Comment[]` with author + replies. **Tables:** `comments`, `profiles`.

---

# 9 · Attachments

**Purpose:** files on tasks/projects. Metadata in `attachments`; bytes in the private `attachments` bucket; downloads via short-TTL signed URLs; guests only see guest-visible files.

**Realtime:** optional `activities` (file_uploaded) on the project.

### `requestUpload` — Server Action
- **Purpose:** authorize an upload and return the tenant-scoped storage path.
- **Authz:** `attachment.upload` (project scope). **Validation:** `uploadReqSchema { projectId, taskId?, fileName, fileType, fileSize }` — type ∈ allow-list, size ≤ 50 MB.
- **Request:** `{ projectId, taskId?, fileName, fileType, fileSize }`.
- **Response:** `{ ok:true, data:{ bucket:'attachments', path:'{org}/{project}/{uuid}-{file}' } }` (client uploads directly to Storage with its session; storage RLS re-checks).
- **Errors:** `VALIDATION`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `FORBIDDEN`. **Tables:** none (path only).

### `registerAttachment` — Server Action
- **Purpose:** persist metadata after a successful upload. **Authz:** `attachment.upload`; RLS `attachments_insert`.
- **Validation:** `registerSchema { projectId, taskId?, entity, entityId, path, fileName, fileType, fileSize, checksum? }`.
- **Response:** `{ ok:true, data: Attachment }`. **Errors:** `VALIDATION`, `FORBIDDEN`. **Tables:** `attachments` (+ `activities` trigger).

### `getDownloadUrl` — Server Action *(service-role assisted for guests)*
- **Purpose:** issue a short-TTL signed URL after verifying the row is visible to the caller (guests: only `is_guest_visible`).
- **Authz:** `attachments_read` (internal) or guest-visible-on-viewable-project. **Validation:** `{ attachmentId }`.
- **Response:** `{ ok:true, data:{ url, expiresIn } }`. **Errors:** `FORBIDDEN`, `NOT_FOUND`. **Tables:** `attachments`, `storage.objects`.
- **Alt:** `GET /api/files/[id]` → 302 redirect to the signed URL (for `<a download>`).

### `setAttachmentGuestVisible` — Server Action
- **Authz:** `attachment.share_guest` / `attachment.manage`. **Validation:** `{ attachmentId, isGuestVisible: boolean }`.
- **Response:** `{ ok:true }`. **Errors:** `FORBIDDEN`, `NOT_FOUND`. **Tables:** `attachments`.

### `deleteAttachment` — Server Action
- **Authz:** uploader or `attachment.manage`; RLS `attachments_delete`. **Request:** `{ attachmentId }`.
- **Response:** `{ ok:true }` (removes row + storage object). **Errors:** `FORBIDDEN`, `NOT_FOUND`. **Tables:** `attachments`, `storage.objects`.

### `listAttachments` — Query contract
- **Response:** `Attachment[]` for an entity/project (guest-filtered). **Tables:** `attachments`, `profiles`.

---

# 10 · Notifications

**Purpose:** per-user inbox. Generation is server-side (triggers + `generate_deadline_notifications` cron); the API is read + mark-read only.

**Realtime:** `notifications:{userId}` INSERT → live badge + toast.

### `listNotifications` — Query contract
- **Authz:** self; RLS `notifications_read`. Filters: read/unread, type. Keyset paginated.
- **Response:** `Notification[]`. **Tables:** `notifications`.

### `getUnreadCount` — Query contract
- **Response:** `{ count: number }` (head+count). **Tables:** `notifications`.

### `markRead` / `markAllRead` — Server Actions
- **Authz:** self; RLS `notifications_update`. **Request:** `{ id }` / `{}`. **Response:** `{ ok:true }` (optimistic). **Errors:** `NOT_FOUND`. **Tables:** `notifications`.

### `deleteNotification` — Server Action
- **Authz:** self. **Request:** `{ id }`. **Response:** `{ ok:true }`. **Tables:** `notifications`.

### `POST /api/cron/deadlines` — Route Handler (scheduled)
- **Purpose:** run `generate_deadline_notifications()`. **Authz:** cron secret header (service role). **Response:** `{ inserted: n }`. **Tables:** `tasks`, `notifications`.

---

# 11 · Reports

**Purpose:** aggregated delivery metrics with export; reads pre-aggregated `report_snapshots` where present, else computes live.

**Realtime:** none.

### `getReport` — Query contract
- **Authz:** `report.view` (scope org/workspace/project); RLS on underlying tables.
- **Request:** `{ scope:'organization'|'workspace'|'project', scopeId, range:{from,to}, filters? }`.
- **Response:** `{ kpis:{ completed, created, overdue, onTimeRate, avgProgress }, completionTrend:[{period,count}], healthDistribution:{on_track,at_risk,delayed}, throughputByMember:[…], estimateAccuracy:number }`.
- **Errors:** `FORBIDDEN`, `VALIDATION`. **Tables:** `report_snapshots`, `tasks`, `projects`, `project_members`, `activities`, `organization_settings`.

### `generateReportExport` — Server Action / `GET /api/reports/export`
- **Purpose:** render CSV/PDF to the private `exports` bucket, return a signed URL.
- **Authz:** `report.export`. **Validation:** `exportSchema { scope, scopeId, range, format:'csv'|'pdf' }`.
- **Response:** `{ ok:true, data:{ url, expiresIn } }`. **Errors:** `FORBIDDEN`, `VALIDATION`, `INTERNAL`. **Tables:** read set above; writes `storage.objects` (exports bucket).

### `POST /api/cron/snapshots` — Route Handler (scheduled)
- **Purpose:** nightly write of `report_snapshots`. **Authz:** cron secret. **Response:** `{ written: n }`. **Tables:** `report_snapshots` (from base tables).

---

# 12 · Guest Portal

**Purpose:** read-only external experience scoped to a guest's account. No writes anywhere — enforced by RLS, not hidden UI.

**Realtime:** optional `project:{id}` progress for the guest's projects.

### `getPortalOverview` — Query contract
- **Authz:** `member_type='guest'`; RLS scopes to the guest's `account_id` projects. **Response:** `{ account, projects:[{ id,name,progress,health,endDate }] }`. **Tables:** `organization_members`, `accounts`, `projects`.

### `getPortalProject` — Query contract
- **Response:** `{ project(progress,health,dates,contact), milestones, tasks: grouped(completed|current|upcoming){ title,statusName,dates } (NO hours/internal), updates: guest-visible activity }`.
- **Tables:** `projects`, `milestones`, `tasks`, `workflow_statuses`, `activities` (guest-visible), `profiles` (PIC contact).

### `listPortalFiles` — Query contract
- **Response:** `Attachment[]` where `is_guest_visible` on viewable projects. **Tables:** `attachments`.

### `getPortalFileDownload` — Server Action *(service-role assisted)*
- **Purpose:** signed URL for a guest-visible file after re-checking visibility. **Authz:** guest + `is_guest_visible` + `can_view_project`.
- **Request:** `{ attachmentId }`. **Response:** `{ ok:true, data:{ url } }`. **Errors:** `FORBIDDEN`, `NOT_FOUND`. **Tables:** `attachments`, `storage.objects`.

---

# 13 · Search

**Purpose:** global org-scoped search across projects, tasks, people, accounts (command palette + search page). RLS-protected; ranked; capped. `ILIKE` in MVP, Postgres FTS (`tsvector`) when volume demands (see DATABASE §10 extensibility).

**Realtime:** none.

### `globalSearch` — Query contract (or Server Action for logging)
- **Authz:** authenticated member; RLS scopes all results (guests see only their account's data).
- **Validation:** `searchSchema { q: 1..100, scopeOrgId, types?: ('project'|'task'|'person'|'account')[], limit? ≤10/group }`.
- **Request:** `{ q, types? }`.
- **Response:** `{ projects:[{id,name,key,color}], tasks:[{id,title,projectId,statusName}], people:[{id,name,avatar}], accounts:[{id,name}] }` (empty groups omitted).
- **Errors:** `VALIDATION`. **Tables:** `projects`, `tasks`, `profiles`/`organization_members`, `accounts`.

---

# 14 · Calendar

**Purpose:** due tasks + milestones by date, scoped and filtered.

**Realtime:** optional `board`/`project` refresh.

### `getCalendar` — Query contract
- **Authz:** internal member; RLS-scoped. **Validation:** `calendarSchema { from, to (≤ 62 days), scope?: 'mine'|'all', filters?:{ projectId?, assigneeId? } }`.
- **Request:** `{ from, to, scope?, filters? }`.
- **Response:** `{ events:[{ id, type:'task'|'milestone', title, date, statusName, statusColor, projectId }] }`.
- **Errors:** `VALIDATION` (range too large). **Tables:** `tasks`, `milestones`, `projects`, `workflow_statuses`.

### `createTaskFromCalendar` — Server Action
- Thin wrapper over `createTask` with a preset `dueDate`. Same authz/validation/errors/tables as §7 `createTask`.

---

# 15 · Timeline

**Purpose:** scheduled work (start→due bars) + milestones, grouped by assignee or project, with dependencies; read-only in MVP.

**Realtime:** optional `board`/`project`.

### `getTimeline` — Query contract
- **Authz:** internal member; RLS-scoped. **Validation:** `timelineSchema { from, to, groupBy:'assignee'|'project', scope?:{ projectId?, workspaceId? } }`.
- **Request:** `{ from, to, groupBy, scope? }`.
- **Response:** `{ lanes:[{ key, label, bars:[{ taskId, title, start, due, statusCategory, statusColor, overdue }] }], milestones:[{ id, projectId, name, dueDate, achieved }], dependencies:[{ predecessorId, successorId, type }] }`.
- **Errors:** `VALIDATION`. **Tables:** `tasks`, `milestones`, `task_dependencies`, `projects`, `profiles`, `workflow_statuses`.

---

# 16 · Analytics (dashboard metrics)

**Purpose:** the dashboard's live figures — portfolio KPIs, health split, completion trend, workload — assembled from snapshots + live aggregates. Distinct from Reports (which is deep + exportable); Analytics is the always-on dashboard read.

**Realtime:** none (refresh on focus / navigation).

### `getDashboardMetrics` — Query contract
- **Authz:** member; managers additionally get portfolio/workload widgets (permission-gated); guests excluded.
- **Request:** `{ orgId, scope?: 'mine'|'all' }` (`all` requires `project.view.all`).
- **Response:** `{ kpis:{ activeProjects, completedProjects, overdueTasks, atRiskProjects }, health:{ on_track, at_risk, delayed }, completionTrend:[{ week, count }], upcomingDeadlines:[…], recentActivity:[…] }`.
- **Errors:** `FORBIDDEN` (scope=all without permission). **Tables:** `projects`, `tasks`, `report_snapshots`, `activities`, `organization_settings`.

### `getWorkload` — Query contract
- **Authz:** manager (`project.view.all` / member-manage). **Request:** `{ orgId }`.
- **Response:** `{ members:[{ userId, name, remainingEffortHours, capacityHours, utilisation, band:'free'|'balanced'|'heavy'|'overloaded' }] }` (PRD BR-6).
- **Errors:** `FORBIDDEN`. **Tables:** `tasks`, `project_members`, `profiles`, `organization_settings`.

---

## Appendix A — Server Action inventory (mutations)

`auth`: signIn · signUp · signOut · requestPasswordReset · updatePassword
`org`: createOrganization · updateOrganization · updateOrganizationSettings · setActiveOrganization · deleteOrganization
`workspace`: create/update/archive · add/change/removeWorkspaceMember
`members`: inviteMember · acceptInvitation · resend/revokeInvitation · changeMemberRole · changeMemberStatus · convertMemberType · removeMember
`roles`: create/update/deleteRole · setRolePermissions
`projects`: create/update/archive/deleteProject · add/change/removeProjectMember · create/update/delete/reorderMilestone
`tasks`: create/update/delete · updateTaskStatus · updateTaskProgress · assignTask · block/unblockTask · moveTask · checklist(×5) · dependency(×2)
`comments`: add/edit/deleteComment
`attachments`: requestUpload · registerAttachment · getDownloadUrl · setAttachmentGuestVisible · deleteAttachment
`notifications`: markRead · markAllRead · deleteNotification
`reports`: generateReportExport
`portal`: getPortalFileDownload

## Appendix B — Route Handlers (REST)

`GET  /auth/callback` — code exchange
`GET  /api/files/[id]` — signed-URL download redirect
`GET  /api/reports/export` — export download (alt to action)
`POST /api/cron/deadlines` — deadline notifications (secret)
`POST /api/cron/snapshots` — report snapshots (secret)
`POST /api/webhooks/*` — reserved (roadmap: GitHub, Slack, email)

## Appendix C — Realtime publication

Add to `supabase_realtime`: `tasks`, `comments`, `notifications`, `projects`, `activities`, `project_members`.
Channels: `notifications:{userId}` · `board:{projectId}` · `task:{taskId}` · `project:{projectId}`.
Ephemeral drag/presence use broadcast/presence channels (no DB writes).

## Appendix D — Cross-cutting guarantees

- **Every mutation** re-validates with Zod server-side, checks the app-layer permission for fast failure, and is ultimately gated by **RLS**.
- **Every list/feed** is keyset-paginated and RLS-scoped; guests receive a strict subset.
- **Tenancy** is derived from parents by trigger — inputs never carry a spoofable `organization_id`.
- **Signed URLs** are the only path to private files; guest access is re-checked server-side before signing.
- **No action trusts the client** for org, role, progress rollups, task numbers, or audit — those are database-owned.
