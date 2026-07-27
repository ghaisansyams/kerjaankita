"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { archiveProject, deleteProject } from "../actions";
import {
  ProjectForm,
  type MemberOption,
  type PickerOption,
  type ProjectFormValues,
} from "./project-form";

export function ProjectActions({
  projectId,
  projectName,
  isArchived,
  canEdit,
  canDelete,
  editInitial,
  workspaces,
  accounts,
  members,
  defaultWorkspaceId,
}: {
  projectId: string;
  projectName: string;
  isArchived: boolean;
  canEdit: boolean;
  canDelete: boolean;
  editInitial: Partial<ProjectFormValues>;
  workspaces: PickerOption[];
  accounts: PickerOption[];
  members: MemberOption[];
  defaultWorkspaceId: string;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [pending, startTransition] = useTransition();

  if (!canEdit && !canDelete) return null;

  function onArchive() {
    startTransition(async () => {
      const result = await archiveProject({ id: projectId, archived: !isArchived });
      if (result?.ok) {
        toast.success(isArchived ? "Project restored" : "Project archived");
        router.refresh();
      } else {
        toast.error(result?.error.message ?? "Something went wrong");
      }
    });
  }

  function onDelete() {
    startTransition(async () => {
      const result = await deleteProject({ id: projectId, confirmName });
      if (result?.ok) {
        toast.success("Project deleted");
        setDeleteOpen(false);
        router.push("/projects");
      } else {
        toast.error(result?.error.message ?? "Couldn't delete project");
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Project actions">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {canEdit && (
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <Pencil />
              Edit
            </DropdownMenuItem>
          )}
          {canEdit && (
            <DropdownMenuItem onSelect={onArchive} disabled={pending}>
              {isArchived ? <ArchiveRestore /> : <Archive />}
              {isArchived ? "Restore" : "Archive"}
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setDeleteOpen(true)}
              >
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canEdit && (
        <ProjectForm
          open={editOpen}
          onOpenChange={setEditOpen}
          mode="edit"
          projectId={projectId}
          initial={editInitial}
          workspaces={workspaces}
          accounts={accounts}
          members={members}
          defaultWorkspaceId={defaultWorkspaceId}
        />
      )}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete project</DialogTitle>
            <DialogDescription>
              This archives the project and all its work. To confirm, type the
              project name <span className="font-medium text-foreground">{projectName}</span> below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-name">Project name</Label>
            <Input
              id="confirm-name"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={projectName}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onDelete}
              disabled={pending || confirmName !== projectName}
            >
              {pending ? "Deleting…" : "Delete project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
