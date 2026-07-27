"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { archiveWorkspace } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export function DangerZone({
  workspaceId,
  workspaceName,
  isDefault,
}: {
  workspaceId: string;
  workspaceName: string;
  isDefault: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function archive() {
    startTransition(async () => {
      const r = await archiveWorkspace({ id: workspaceId });
      if (r?.ok) {
        toast.success("Workspace archived");
        setOpen(false);
        router.push("/settings/workspace");
        router.refresh();
      } else {
        toast.error(r?.error.message ?? "Couldn't archive workspace");
      }
    });
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
        <p className="text-sm text-muted-foreground">
          Archiving hides a workspace and its projects from everyone. This can be undone by an admin.
        </p>
      </CardHeader>
      <CardContent>
        {isDefault ? (
          <p className="text-sm text-muted-foreground">
            The default workspace can&apos;t be archived. Set another workspace as default first.
          </p>
        ) : (
          <Button variant="destructive" onClick={() => setOpen(true)} disabled={pending}>
            Archive workspace
          </Button>
        )}
      </CardContent>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive “{workspaceName}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Its projects will be hidden from all members and guests until it&apos;s restored.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                archive();
              }}
              disabled={pending}
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
