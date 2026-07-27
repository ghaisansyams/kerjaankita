/**
 * Turn an activity row into a human sentence fragment (prefixed by the actor
 * name in the UI). Ids in metadata are resolved via the provided lookups.
 */
export function humanizeActivity(
  action: string,
  metadata: Record<string, unknown>,
  lookup: {
    statusName: (id: unknown) => string | null;
    memberName: (id: unknown) => string | null;
  },
): string {
  switch (action) {
    case "task.created":
      return "created this task";
    case "task.status_changed": {
      const to = lookup.statusName(metadata.to);
      return to ? `moved this to ${to}` : "changed the status";
    }
    case "task.progress_updated":
      return `updated progress to ${metadata.to ?? "?"}%`;
    case "task.assigned": {
      const who = lookup.memberName(metadata.assignee_id);
      return who ? `assigned this to ${who}` : "changed the assignee";
    }
    case "task.blocked":
      return metadata.reason ? `blocked this — ${metadata.reason}` : "blocked this task";
    case "task.unblocked":
      return "unblocked this task";
    case "task.rescheduled": {
      const to = typeof metadata.to === "string" ? metadata.to : null;
      return to ? `rescheduled the due date to ${to}` : "cleared the due date";
    }
    case "task.reordered":
      return "reordered this on the board";
    case "attachment.uploaded":
      return metadata.file_name ? `uploaded ${metadata.file_name}` : "uploaded a file";
    case "checklist.item_added":
      return metadata.content
        ? `added "${metadata.content}" to the checklist`
        : "added a checklist item";
    case "checklist.item_completed":
      return metadata.content
        ? `checked off "${metadata.content}"`
        : "completed a checklist item";
    default:
      return action.replace(/[._]/g, " ");
  }
}
