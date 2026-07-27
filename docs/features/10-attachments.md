# FSD 10 — Attachments

File management on tasks/projects. Builds on [00-conventions.md](./00-conventions.md).

1. **Purpose** — Attach, store, share, and download files (deliverables, evidence) on tasks and projects, with private storage and controlled guest visibility.
2. **User Story** — *As a member I can upload evidence to a task and, if I'm a manager, share specific files with the client; guests can download only what's shared with them.*
3. **Actors** — Members (`attachment.upload`), Uploader (delete/modify own), Manager (`attachment.manage`, `attachment.share_guest`), Guest (download **guest-visible** files only), System (activity, signed URLs).
4. **Preconditions** — The target task/project is visible; storage configured; file within type + size limits.
5. **Main Flow (see CRUD breakout).** Upload = `requestUpload` (authorize + tenant path) → direct client upload to the private `attachments` bucket → `registerAttachment` (metadata row) → activity. Download = `getDownloadUrl` (permission re-check) → short-TTL signed URL.
6. **Alternative Flow** — Project-level files (no task). Guest download path uses a **service-role signed URL** after re-checking `is_guest_visible`. Drag-drop multi-file upload (per-file progress). `GET /api/files/[id]` 302-redirect for `<a download>`.
7. **Validation Rules** — MIME ∈ allow-list (PDF, Office, images, zip, csv/txt); size ≤ 50 MB (attachments) / 5 MB (avatars/branding); filename sanitized; path `{org}/{project}/{uuid}-{name}`. Both **client (advisory)** and **server (authoritative)** validate. Schemas `uploadReqSchema`, `registerSchema`.
8. **Business Rules** — Bytes live in Storage; metadata in `attachments`. **Private bucket, no public URLs** — downloads are always signed and short-lived. Default visibility **internal** (`is_guest_visible=false`); only managers may flag guest-visible. First path segment = tenant key (RLS + storage policy).
9. **Permission Rules** — upload `attachment.upload`; read `attachments_read` (guests only guest-visible on viewable projects); share-with-guest `attachment.share_guest`/`attachment.manage`; delete/modify uploader or `attachment.manage`.
10. **Database Tables Used** — `attachments`, `storage.objects` (bucket `attachments`), `activities`, `profiles` (uploader).
11. **Server Actions Used** — `requestUpload`, `registerAttachment`, `getDownloadUrl`, `setAttachmentGuestVisible`, `deleteAttachment`; query `listAttachments`; Route `GET /api/files/[id]`.
12. **UI Components Used** — `Uploader` (dropzone + per-file progress), `FileCard`/grid, `FilePreview` modal, "Visible to client" switch, `ConfirmDialog`, type icons.
13. **Notifications Triggered** — None by default (upload is ambient). Roadmap: notify on client-shared file.
14. **Activity Logs Generated** — `attachment.uploaded` (guest-visible only if the file is guest-visible).
15. **Realtime Events** — Optional `project:{id}` activity (file_uploaded). None required for the file list.
16. **Loading State** — Dropzone idle; per-file upload progress bars (indeterminate until size known); grid skeletons; download shows a brief spinner while signing.
17. **Empty State** — "No files yet — upload deliverables and evidence" (permitted) / neutral for viewers/guests.
18. **Error State** — `UNSUPPORTED_MEDIA_TYPE`, `PAYLOAD_TOO_LARGE`, `FORBIDDEN`, network failure (retry per file); expired signed URL → auto re-sign/retry; orphaned upload (bytes without a metadata row) reaped by a job.
19. **Success State** — File appears as a card with type/size/uploader/date; activity logged; guest-visible toggle reflects immediately; download opens the file via signed URL.
20. **Edge Cases** — Upload succeeds but `registerAttachment` fails (orphan bytes → reaper); duplicate filenames (uuid prefix prevents collision); deleting a file removes both row and object; guest attempts a non-visible file (denied at sign time); very large file near the limit; unsupported type slipping past client check (server rejects); revoking guest-visibility while a signed URL is still valid (short TTL bounds exposure).
21. **Acceptance Criteria** — (a) files are private and only reachable via short-TTL signed URLs; (b) guests can download only guest-visible files on their projects (RLS + sign-time re-check); (c) type/size enforced server-side; (d) delete removes bytes + metadata; (e) tenant path isolation holds across orgs.
22. **QA Checklist** — Base +: private-bucket enforcement (no public URL works); guest visibility gating at sign time; server-side MIME/size; tenant-path isolation; orphan reaping; delete removes storage object; per-file progress + retry.
23. **Future Improvements** — Virus scanning, image thumbnails/transforms, versioning, folders, inline preview for more types, bulk zip download, link-based sharing with expiry, resumable uploads, storage quotas per plan.

## CRUD breakout
- **Create (upload)** — `requestUpload` → client upload → `registerAttachment`. `attachment.upload`. Activity `attachment.uploaded`.
- **Read** — `listAttachments` (by entity/project; guest-filtered) + `getDownloadUrl` (signed). 
- **Update** — `setAttachmentGuestVisible` (manager) — the only metadata edit besides delete.
- **Delete** — `deleteAttachment` (uploader/manager): removes row + storage object.
- **Archive/Restore** — N/A (files are kept or deleted; soft-delete retains metadata for audit, storage object removed).
- **Duplicate** — N/A.
- **Bulk** — Bulk delete + bulk set-guest-visible; per-row permission; partial-success report.

## State transitions
`attachment.is_guest_visible`: `false ⇄ true` (trigger: manager toggle; who: `attachment.share_guest`/`manage`; DB: flag; notif: none (roadmap); audit: optional; realtime: none). Lifecycle: `uploaded → (shared) → deleted`.
