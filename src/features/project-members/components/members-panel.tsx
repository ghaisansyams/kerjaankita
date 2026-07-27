"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { getInitials } from "@/utils/format";
import { changeProjectMemberRole, removeProjectMember } from "../actions";
import { AddMemberDialog, type CandidateVM, type RoleVM } from "./add-member-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/data/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export type MemberVM = {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  roleId: string | null;
  roleName: string | null;
};

export function MembersPanel({
  projectId,
  members,
  candidates,
  roles,
  canManage,
}: {
  projectId: string;
  members: MemberVM[];
  candidates: CandidateVM[];
  roles: RoleVM[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [removing, setRemoving] = useState<MemberVM | null>(null);

  function onRoleChange(memberId: string, roleId: string) {
    startTransition(async () => {
      const result = await changeProjectMemberRole({ memberId, roleId });
      if (result?.ok) {
        toast.success("Role updated");
        router.refresh();
      } else {
        toast.error(result?.error.message ?? "Couldn't update role");
      }
    });
  }

  function onRemove() {
    if (!removing) return;
    startTransition(async () => {
      const result = await removeProjectMember({ memberId: removing.id });
      if (result?.ok) {
        toast.success("Member removed");
        setRemoving(null);
        router.refresh();
      } else {
        toast.error(result?.error.message ?? "Couldn't remove member");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Team</h2>
          <p className="text-sm text-muted-foreground">
            People working on this project.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            Add member
          </Button>
        )}
      </div>

      {members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No members yet"
          description="Add people to this project so work can be assigned."
          action={
            canManage ? (
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="size-4" />
                Add member
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="divide-y p-0">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 p-3">
              <Avatar className="size-9">
                {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt="" />}
                <AvatarFallback className="text-xs">
                  {getInitials(m.name, m.email)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.name}</p>
                {m.email && (
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                )}
              </div>
              {canManage ? (
                <Select
                  value={m.roleId ?? undefined}
                  onValueChange={(v) => onRoleChange(m.id, v)}
                  disabled={pending}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-sm text-muted-foreground">{m.roleName}</span>
              )}
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${m.name}`}
                  onClick={() => setRemoving(m)}
                  disabled={pending}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </Card>
      )}

      {canManage && (
        <AddMemberDialog
          projectId={projectId}
          candidates={candidates}
          roles={roles}
          open={addOpen}
          onOpenChange={setAddOpen}
        />
      )}

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They&apos;ll lose access to this project. You can add them back later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                onRemove();
              }}
              disabled={pending}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
