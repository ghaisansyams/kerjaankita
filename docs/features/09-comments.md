# FSD 09 — Comments

Polymorphic discussion, CRUD-ish. Builds on [00-conventions.md](./00-conventions.md).

1. **Purpose** — Enable threaded discussion on tasks and projects, internal by default, with @mentions — replacing "any update?" chatter.
2. **User Story** — *As a team member I can discuss a task, reply, and mention colleagues; internal discussion never leaks to clients.*
3. **Actors** — Internal members (`comment.create`), Author (edit/delete own), Manager (`comment.moderate` — delete any), Guest (**no access** to internal comments), System (mention notifications).
4. **Preconditions** — The commented entity (task/project) is visible to the user; internal comments require an internal (non-guest) member.
5. **Main Flow** — Open a task/project → read the thread (chronological, one-level replies) → type in the composer (with @mention autocomplete) → submit → **optimistic** append (pending → confirmed) → activity + mention notifications → realtime to other viewers.
6. **Alternative Flow** — Reply to a comment (indented, one level). Edit own comment → marks "edited". Delete own (or any, if moderator) → soft delete. A **non-internal** comment (`is_internal=false`) is visible to guests and appears in the guest activity feed.
7. **Validation Rules** — body 1–5000; `entity` ∈ {task,project}; `entityId` visible; `parentId` (if set) belongs to the same entity; `mentions` = uuid[] of users who can view the entity. Schemas `commentSchema`, `editCommentSchema`.
8. **Business Rules** — Internal by default (`is_internal=true`); threading is **one level only** (reply-to-comment, no deeper). Editing preserves history in the activity log; deleting is soft. Comments never change task state. Mentions only notify users who already have read access.
9. **Permission Rules** — create `comment.create` (project scope) + must view the entity + internal requires internal member; read `comments_read` (guests excluded from internal); edit/delete own (author) or `comment.moderate`.
10. **Database Tables Used** — `comments`, `profiles` (author/mention), `activities`, `notifications`.
11. **Server Actions Used** — `addComment`, `editComment`, `deleteComment`; query `listComments`.
12. **UI Components Used** — `CommentThread`, `CommentItem`, `CommentBox` (composer with mention combobox + attach), reply affordance, edit/delete menu, relative-time, optimistic pending style.
13. **Notifications Triggered** — `mentioned` → each mentioned user who can view the entity (≠ author). (Reply-to-your-comment notification is a roadmap enhancement.)
14. **Activity Logs Generated** — `comment.created` (guest-visible only when `is_internal=false`). Edits/deletes are not separate feed items but retain history.
15. **Realtime Events** — `task:{taskId}` (comments changes) → live thread; new remote comments animate in.
16. **Loading State** — Skeleton bubbles; composer enabled immediately; posting shows a pending bubble.
17. **Empty State** — "No comments yet — start the discussion."
18. **Error State** — Post failure → the pending bubble shows "Failed — Retry"; `VALIDATION` (empty/too long); `FORBIDDEN` (guest attempting internal / no entity access); edit/delete of a foreign comment → `FORBIDDEN`.
19. **Success State** — Comment confirmed, mention notifications sent, thread updates for all viewers; edit shows "edited"; delete removes the bubble (tombstone if it had replies).
20. **Edge Cases** — Mentioning a user without entity access (mention stored, **no** notification, or stripped); mentioning a guest (blocked for internal comments); deleting a parent with replies (soft delete keeps thread structure / shows "deleted"); very long body; concurrent edits (last-write-wins); posting on a soft-deleted entity (rejected).
21. **Acceptance Criteria** — (a) internal comments are invisible to guests (RLS-proven); (b) mentions notify only entitled users; (c) posting is optimistic and reconciles; (d) one-level threading enforced; (e) edit marks edited and preserves audit; (f) realtime delivery to co-viewers.
22. **QA Checklist** — Base +: guest cannot read/insert internal comments (RLS); mention notification entitlement; optimistic rollback; one-level threading; moderator delete; realtime thread; body bounds.
23. **Future Improvements** — Reactions/emoji, rich text + attachments inline, comment resolve/threads, edit history view, reply notifications, comment permalinks, read receipts, markdown with sanitized rendering.

## CRUD breakout
- **Create** — `addComment` (entity, body, parentId?, isInternal?, mentions?). Optimistic. Activity + mention notifications.
- **Read** — `listComments` (by entity, one-level replies, keyset); guests get only non-internal.
- **Update** — `editComment` (own; sets is_edited). **Delete** — soft delete (author or moderator).
- **Archive/Restore/Duplicate/Bulk** — N/A (comments aren't archived/duplicated; bulk moderation is a roadmap tool).

## State transitions
`comment`: `draft(client) → posted → edited* → deleted(soft)`. Trigger: composer/edit/delete. Who: author (+ moderator delete). Validation: body bounds, entity access. DB: `comments` row / `is_edited` / `deleted_at`. Notif: mentions on create. Audit: `comment.created`. Realtime: `task:{taskId}`.
