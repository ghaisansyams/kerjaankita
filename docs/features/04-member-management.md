# FSD 04 — Member Management

CRUD + invitation lifecycle. Builds on [00-conventions.md](./00-conventions.md).

1. **Purpose** — Manage who belongs to an organization: invite members and guests, assign roles, change status, link guests to accounts, and remove people — safely (never orphaning an org).
2. **User Story** — *As an admin I can invite teammates and clients, set their roles, and manage their access, so the right people see the right things.*
3. **Actors** — Owner/Admin (`organization.member.manage`, `invitation.manage`), Invitee (accepts), affected Member, System (last-owner guard trigger).
4. **Preconditions** — Active org member with permission for writes. Accept requires a valid, unexpired, email-matching token.
5. **Main Flow (see CRUD breakout + transitions).**
6. **Alternative Flow** — Invitee already has an account → accept links the existing user; invitee with no account → sign up first (token carried through) → membership created on completion. Guest invitations require an `accountId` so RLS scopes them.
7. **Validation Rules** — email RFC; `roleId` ∈ org/system roles of the correct scope; `memberType` ∈ {member,guest}; guest requires `accountId`; status ∈ {invited,active,suspended}. Schemas `inviteSchema`, `acceptInviteSchema`, `memberUpdateSchema`.
8. **Business Rules** — **An org must always retain ≥ 1 active owner** (DB trigger `prevent_last_owner_removal` blocks role-change/suspend/remove otherwise → `LAST_OWNER`). Guests default to zero permissions (read via RLS only). Invitations expire (14 days). One membership per (org,user).
9. **Permission Rules** — invite/revoke/resend `invitation.manage`; role/status/type/remove `organization.member.manage`; accept: the invited email only; **only Owner may grant the Owner role** (rank guard).
10. **Database Tables Used** — `organization_members`, `invitations`, `roles`, `role_permissions` (effective perms), `accounts` (guest link), `profiles`.
11. **Server Actions Used** — `inviteMember`, `acceptInvitation` (service-role assisted), `resendInvitation`, `revokeInvitation`, `changeMemberRole`, `changeMemberStatus`, `convertMemberType`, `removeMember`; queries `listMembers`, `getMember`.
12. **UI Components Used** — Members table (role select, type/status badges, workload bar, `⋯`), invite modal, bulk-selection toolbar, `ConfirmDialog`, role-change confirm.
13. **Notifications Triggered** — `invitation_accepted` → inviter; `member_role_changed` → affected member. (Email delivery of invites is roadmap; token link is generated now.)
14. **Activity Logs Generated** — `member.added` / `member.removed` / `member.role_changed` (org-scoped, internal).
15. **Realtime Events** — Optional `organization_members` changes for the live Members screen. None required.
16. **Loading State** — Standard Loading; invite modal disables while sending; inline row spinners on role/status change.
17. **Empty State** — Only the founder → "Invite your team" hero. Pending invitations section empty until one exists. Guests section empty until a guest is added.
18. **Error State** — `CONFLICT` (already invited/member), `LAST_OWNER`, `FORBIDDEN` (e.g. non-owner granting owner), `NOT_FOUND` (bad token), `VALIDATION` (expired/mismatch), `RATE_LIMITED` (invite spam).
19. **Success State** — invite → row appears as "Invited" + copyable link/toast; accept → invitee lands in `/dashboard` with the org active; changes → optimistic row update + toast.
20. **Edge Cases** — Re-inviting an existing member; accepting an expired/revoked token; email-mismatch on accept; suspending the last owner; converting a member→guest without an account; removing yourself (allowed unless last owner); bulk role change including the last owner (that row fails, others succeed — partial report).
21. **Acceptance Criteria** — (a) invite → accept produces an active membership with the chosen role; (b) last-owner guard blocks removal/suspend/downgrade; (c) guests are account-scoped and see only their account's projects; (d) only owners can mint owners; (e) expired tokens are rejected with a clear message.
22. **QA Checklist** — Base +: last-owner guard (role change, suspend, remove, bulk); token expiry + email match; guest account scoping via RLS; owner-grant rank guard; partial-success reporting for bulk.
23. **Future Improvements** — Email invitations + reminders, SCIM/directory sync, bulk CSV invite, per-workspace/-project invite in one step, join-by-domain, deactivation vs deletion with data reassignment, audit of permission changes.

## CRUD breakout
- **Create (invite)** — `inviteMember` → `invitations` row + token. Guest requires `accountId`. `CONFLICT` if already invited/member.
- **Accept** — `acceptInvitation(token)` (service-role after email/expiry check) → `organization_members` insert + set active org. Idempotent.
- **Read** — `listMembers` (filters: role/status/type/search; derived workload) / `getMember`. RLS: org members; guests excluded from the roster.
- **Update** — role / status / type / account link via `changeMemberRole` · `changeMemberStatus` · `convertMemberType`. Guards: last-owner, owner-rank.
- **Delete (remove)** — `removeMember` soft-deletes the membership (guarded). Authored records are preserved.
- **Archive / Restore** — modeled as status `active ⇄ suspended` (see transitions).
- **Duplicate** — N/A.
- **Bulk** — bulk role/status change + bulk revoke; per-row permission + guards; partial-success `{succeeded, failed:[{id,reason}]}`.
- **Resend / Revoke invitation** — `invitation.manage`; revoke sets status `revoked`.

## State transitions
| Transition | Trigger | Who | Guard | DB | Notif | Audit | Realtime |
|---|---|---|---|---|---|---|---|
| invitation `pending → accepted` | accept | invited email | token valid, not expired | invitations.status, +membership | `invitation_accepted`→inviter | member.added | members list |
| invitation `pending → revoked/expired` | revoke / TTL | admin / system | `invitation.manage` | invitations.status | — | — | — |
| membership `invited → active` | accept | invitee | — | status=active, joined_at | — | member.added | — |
| membership `active → suspended` | admin | admin | not last owner | status | `member_role_changed` | member.role_changed | — |
| membership `active → removed` | admin/self | admin/self | not last owner | deleted_at | — | member.removed | — |
| role change | admin | admin | not last-owner downgrade; owner-only for owner grant | role_id | `member_role_changed` | member.role_changed | — |
