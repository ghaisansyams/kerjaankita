# FSD 11 — Notifications

Per-user inbox. Generation is server-side; the API is read + mark-read. Builds on [00-conventions.md](./00-conventions.md).

1. **Purpose** — Keep each user aware of what needs them — assignments, mentions, deadlines, blocks, completions — without polling colleagues.
2. **User Story** — *As a user I get a live unread badge and an inbox of relevant alerts, and I can mark them read.*
3. **Actors** — User (self, read/manage), System (triggers + cron generate them). No one writes another user's notifications from the client.
4. **Preconditions** — Authenticated; notifications are personal (`user_id = self`).
5. **Main Flow** — Topbar bell shows unread count (from a light poll + realtime) → open panel → recent items (unread emphasised) → click an item → route to its entity + mark read → "View all" opens the full page (filter + history).
6. **Alternative Flow** — "Mark all read" (optimistic). Deadline notifications appear each morning from the cron job. Realtime insert pushes a toast + badge bump.
7. **Validation Rules** — read-side only; `markRead { id }`, `markAllRead {}`. Generation validated by the emitting trigger/action (recipient entitlement, dedupe).
8. **Business Rules** — **Never self-notify** (actor excluded). Recipient must already have read access to the referenced entity. Deadline types are **deduped 1/task/day**. Retention 90 days (purge job). Types per the [notification catalog](./00-conventions.md#f--notification-catalog-canonical-type-values).
9. **Permission Rules** — read/update/delete: `user_id = auth.uid()` (RLS `notifications_*`). Generation: triggers/cron (SECURITY DEFINER) or actions after entitlement checks.
10. **Database Tables Used** — `notifications`; (generation reads `tasks`, `projects`, `comments`, `organization_members`).
11. **Server Actions Used** — `markRead`, `markAllRead`, `deleteNotification`; queries `listNotifications`, `getUnreadCount`; Route `POST /api/cron/deadlines`.
12. **UI Components Used** — Notification bell (unread dot), `NotificationCenter` panel, `NotificationItem`, full Notifications page (filters, grouped Today/Earlier), empty state.
13. **Notifications Triggered** — N/A — this module **consumes** the catalog; other modules trigger.
14. **Activity Logs Generated** — N/A (notifications are personal, not audit).
15. **Realtime Events** — `notifications:{userId}` INSERT → live badge + toast (RLS-filtered to self).
16. **Loading State** — Bell shows last-known count immediately; panel skeleton; full page skeleton rows.
17. **Empty State** — "You're all caught up" (no unread) / "No notifications yet" (none ever).
18. **Error State** — Mark/load failure → toast + retry; a dead entity link → graceful "This item no longer exists"; realtime disconnect → fall back to poll.
19. **Success State** — Item routes + marks read; badge decrements; "mark all read" clears the panel; new alerts arrive live.
20. **Edge Cases** — Notification for an entity the user later lost access to (RLS hides it / link shows "no longer available"); duplicate deadline suppression; bulk mark-read race with an incoming insert; very old items beyond retention (purged); guest notifications (only their entitled events).
21. **Acceptance Criteria** — (a) unread badge is live and accurate; (b) actor never notified of their own action; (c) deadlines dedupe per day; (d) only entitled recipients receive an item; (e) mark-read is optimistic and persists.
22. **QA Checklist** — Base +: self-exclusion; entitlement of recipients; deadline dedupe; realtime badge + toast; retention purge; RLS (cannot read others' notifications); cron auth (secret).
23. **Future Improvements** — Email + Slack delivery, per-type/channel preferences, digest mode, snooze, grouping ("3 tasks due today"), in-app notification settings, push (web/mobile), do-not-disturb hours.

## CRUD breakout
- **Read** — `listNotifications` (filters read/unread/type, keyset) + `getUnreadCount`.
- **Update** — `markRead` / `markAllRead` (optimistic).
- **Delete** — `deleteNotification` (own).
- **Create** — system-only (triggers/cron/actions); no client create.
- **Archive/Restore/Duplicate/Bulk** — Bulk = mark-all-read; others N/A.

## State transitions
`notification`: `unread → read` (trigger: open/click/mark; who: self; DB: `is_read`, `read_at`; realtime: badge). `created → purged` (retention job at 90 days).
