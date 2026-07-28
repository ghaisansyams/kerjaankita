"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate, getInitials } from "@/utils/format";
import { PRIORITY_LABELS, type Priority, type StatusCategory } from "@/constants";
import { deleteTask } from "../actions";
import { TaskStatusSelect, type StatusOption } from "./task-status-select";
import { TaskProgressSelect } from "./task-progress-select";
import { TaskChecklist, type ChecklistItemVM } from "./task-checklist";
import { TaskForm, type MemberOption } from "./task-form";
import {
  AttachmentsPanel,
  type AttachmentVM,
} from "@/features/attachments/components/attachments-panel";
import {
  ActivityTimeline,
  type ActivityVM,
  type CommentVM,
} from "@/features/activity/components/activity-timeline";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type TaskDetailVM = {
  id: string;
  number: number;
  title: string;
  description: string | null;
  statusId: string | null;
  priority: Priority;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeAvatar: string | null;
  reporterName: string | null;
  startDate: string | null;
  dueDate: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  progress: number;
  isBlocked: boolean;
  blockedReason: string | null;
  githubPrUrl: string | null;
  figmaUrl: string | null;
  stagingUrl: string | null;
  productionUrl: string | null;
  evidenceNotes: string | null;
  statusCategory: StatusCategory;
};

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

/** Everything the drawer needs, minus how it closes. Shared by the server
 *  loader (Tasks tab) and the in-place board drawer, and by the read action. */
export type TaskDrawerData = {
  projectId: string;
  task: TaskDetailVM;
  statuses: StatusOption[];
  checklist: ChecklistItemVM[];
  members: MemberOption[];
  canEditAll: boolean;
  canQuickEdit: boolean;
  canDelete: boolean;
  attachments: AttachmentVM[];
  comments: CommentVM[];
  activities: ActivityVM[];
  currentUserId: string;
  canComment: boolean;
  canModerate: boolean;
  canUpload: boolean;
  canManageFiles: boolean;
};

export function TaskDrawer({
  projectId,
  task,
  statuses,
  checklist,
  members,
  canEditAll,
  canQuickEdit,
  canDelete,
  attachments,
  comments,
  activities,
  currentUserId,
  canComment,
  canModerate,
  canUpload,
  canManageFiles,
  closeHref,
  onClose,
}: TaskDrawerData & {
  /** Navigate here on close (URL-driven usage, e.g. the Tasks tab). */
  closeHref?: string;
  /** Close in place without navigating (board drawer). Wins over closeHref. */
  onClose?: () => void;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function close() {
    if (onClose) onClose();
    else if (closeHref) router.push(closeHref);
  }

  function onDelete() {
    startTransition(async () => {
      const result = await deleteTask({ id: task.id });
      if (result?.ok) {
        toast.success("Task deleted");
        close();
      } else {
        toast.error(result?.error.message ?? "Couldn't delete task");
      }
    });
  }

  const evidence = [
    { label: "Pull request", url: task.githubPrUrl },
    { label: "Figma", url: task.figmaUrl },
    { label: "Staging", url: task.stagingUrl },
    { label: "Production", url: task.productionUrl },
  ].filter((e): e is { label: string; url: string } => Boolean(e.url));

  const editInitial = {
    title: task.title,
    description: task.description ?? "",
    priority: task.priority,
    assigneeId: task.assigneeId ?? "none",
    startDate: task.startDate ?? "",
    dueDate: task.dueDate ?? "",
    estimatedHours: task.estimatedHours != null ? String(task.estimatedHours) : "",
    actualHours: task.actualHours != null ? String(task.actualHours) : "",
    githubPrUrl: task.githubPrUrl ?? "",
    figmaUrl: task.figmaUrl ?? "",
    stagingUrl: task.stagingUrl ?? "",
    productionUrl: task.productionUrl ?? "",
    evidenceNotes: task.evidenceNotes ?? "",
  };

  const timelineStatuses = statuses.map((s) => ({ id: s.id, name: s.name }));

  return (
    <>
      <Sheet open onOpenChange={(o) => !o && close()}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <SheetHeader className="border-b">
            <div className="flex items-start justify-between gap-2 pr-6">
              <div className="min-w-0">
                <span className="font-mono text-xs text-muted-foreground">#{task.number}</span>
                <SheetTitle className="text-lg leading-tight">{task.title}</SheetTitle>
              </div>
              {(canQuickEdit || canDelete) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Task actions">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canQuickEdit && (
                      <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                        <Pencil />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {canDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </SheetHeader>

          <Tabs defaultValue="details" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mx-4 mt-3 self-start">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
              <div className="space-y-6 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <TaskStatusSelect
                      taskId={task.id}
                      statusId={task.statusId}
                      statuses={statuses}
                      disabled={!canQuickEdit}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Progress</p>
                    <TaskProgressSelect taskId={task.id} progress={task.progress} disabled={!canQuickEdit} />
                  </div>
                </div>

                {task.isBlocked && task.blockedReason && (
                  <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
                    <span className="font-medium">Blocked:</span> {task.blockedReason}
                  </div>
                )}

                <dl className="grid grid-cols-2 gap-3">
                  <MetaRow
                    label="Assignee"
                    value={
                      task.assigneeName ? (
                        <span className="flex items-center gap-1.5">
                          <Avatar className="size-5">
                            {task.assigneeAvatar && <AvatarImage src={task.assigneeAvatar} alt="" />}
                            <AvatarFallback className="text-[9px]">
                              {getInitials(task.assigneeName)}
                            </AvatarFallback>
                          </Avatar>
                          {task.assigneeName}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )
                    }
                  />
                  <MetaRow label="Priority" value={PRIORITY_LABELS[task.priority]} />
                  <MetaRow label="Start" value={formatDate(task.startDate)} />
                  <MetaRow label="Due" value={formatDate(task.dueDate)} />
                  <MetaRow label="Estimate" value={task.estimatedHours != null ? `${task.estimatedHours}h` : "—"} />
                  <MetaRow label="Actual" value={task.actualHours != null ? `${task.actualHours}h` : "—"} />
                </dl>

                {task.description && (
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-medium">Description</h3>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{task.description}</p>
                  </div>
                )}

                {evidence.length > 0 && (
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-medium">Evidence</h3>
                    <div className="flex flex-wrap gap-2">
                      {evidence.map((e) => (
                        <a
                          key={e.label}
                          href={e.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors hover:bg-accent"
                        >
                          {e.label}
                          <ExternalLink className="size-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <TaskChecklist taskId={task.id} items={checklist} canEdit={canQuickEdit} />

                <AttachmentsPanel
                  projectId={projectId}
                  taskId={task.id}
                  attachments={attachments}
                  canUpload={canUpload}
                  canManage={canManageFiles}
                  currentUserId={currentUserId}
                />
              </div>
            </TabsContent>

            <TabsContent value="activity" className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
              <div className="pt-2">
                <ActivityTimeline
                  taskId={task.id}
                  comments={comments}
                  activities={activities}
                  statuses={timelineStatuses}
                  members={members.map((m) => ({ id: m.id, name: m.name }))}
                  currentUserId={currentUserId}
                  canComment={canComment}
                  canModerate={canModerate}
                />
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {canQuickEdit && (
        <TaskForm
          open={editOpen}
          onOpenChange={setEditOpen}
          mode="edit"
          projectId={projectId}
          taskId={task.id}
          initial={editInitial}
          members={members}
          canEditAll={canEditAll}
        />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the task and its checklist. Project progress will recalculate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                onDelete();
              }}
              disabled={pending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
