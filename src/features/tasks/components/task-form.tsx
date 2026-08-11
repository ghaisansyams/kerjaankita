"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  editTaskFormSchema,
  PRIORITIES_TUPLE,
  type EditTaskFormValues,
} from "@/schemas/task.schema";
import { PRIORITY_LABELS } from "@/constants";
import { createTask, updateTask } from "../actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type MemberOption = { id: string; name: string };

const empty: EditTaskFormValues = {
  title: "",
  description: "",
  priority: "medium",
  assigneeId: "none",
  startDate: "",
  dueDate: "",
  estimatedHours: "",
  actualHours: "",
  githubPrUrl: "",
  figmaUrl: "",
  stagingUrl: "",
  productionUrl: "",
  evidenceNotes: "",
};

export function TaskForm({
  open,
  onOpenChange,
  mode,
  projectId,
  taskId,
  initial,
  members,
  canEditAll = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  projectId: string;
  taskId?: string;
  initial?: Partial<EditTaskFormValues>;
  members: MemberOption[];
  canEditAll?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<EditTaskFormValues>({
    resolver: zodResolver(editTaskFormSchema),
    defaultValues: { ...empty, ...initial },
  });

  // In edit mode an assignee (non-manager) may only touch hours + evidence.
  const lock = mode === "edit" && !canEditAll;

  function applyError(
    result: { ok: false; error: { message: string; fields?: Record<string, string[]> } } | undefined,
  ) {
    if (result?.error.fields) {
      for (const [field, messages] of Object.entries(result.error.fields)) {
        form.setError(field as keyof EditTaskFormValues, { message: messages[0] });
      }
    }
    toast.error(result?.error.message ?? "Something went wrong");
  }

  function onSubmit(v: EditTaskFormValues) {
    const base = {
      title: v.title,
      description: v.description || undefined,
      priority: v.priority,
      // null (not undefined) so picking "Unassigned" actually clears the PIC;
      // on create the schema folds null back to "no assignee".
      assigneeId: v.assigneeId === "none" ? null : v.assigneeId,
      startDate: v.startDate || undefined,
      dueDate: v.dueDate || undefined,
      estimatedHours: v.estimatedHours || undefined,
    };
    startTransition(async () => {
      if (mode === "create") {
        const result = await createTask({ projectId, ...base });
        if (result?.ok) {
          toast.success("Task created");
          onOpenChange(false);
          router.push(`/projects/${projectId}/tasks?task=${result.data.id}`);
          return;
        }
        applyError(result);
        return;
      }

      const result = await updateTask({
        id: taskId as string,
        ...base,
        actualHours: v.actualHours || undefined,
        githubPrUrl: v.githubPrUrl || undefined,
        figmaUrl: v.figmaUrl || undefined,
        stagingUrl: v.stagingUrl || undefined,
        productionUrl: v.productionUrl || undefined,
        evidenceNotes: v.evidenceNotes || undefined,
      });
      if (result?.ok) {
        toast.success("Task updated");
        onOpenChange(false);
        router.refresh();
        return;
      }
      applyError(result);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New task" : "Edit task"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Add a task to this project."
              : lock
                ? "Update your hours and evidence."
                : "Update this task's details."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Build the login page" disabled={lock} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={3} disabled={lock} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={lock}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRIORITIES_TUPLE.map((p) => (
                          <SelectItem key={p} value={p}>
                            {PRIORITY_LABELS[p]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="assigneeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PIC</FormLabel>
                    <Select value={field.value || "none"} onValueChange={field.onChange} disabled={lock}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start</FormLabel>
                    <FormControl>
                      <Input type="date" disabled={lock} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due</FormLabel>
                    <FormControl>
                      <Input type="date" disabled={lock} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="estimatedHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Est. hrs</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.5" disabled={lock} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {mode === "edit" && (
              <>
                <FormField
                  control={form.control}
                  name="actualHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Actual hrs</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} step="0.5" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  {(
                    [
                      ["githubPrUrl", "Pull request URL"],
                      ["figmaUrl", "Figma URL"],
                      ["stagingUrl", "Staging URL"],
                      ["productionUrl", "Production URL"],
                    ] as const
                  ).map(([name, label]) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{label}</FormLabel>
                          <FormControl>
                            <Input type="url" placeholder="https://…" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
                <FormField
                  control={form.control}
                  name="evidenceNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Evidence notes</FormLabel>
                      <FormControl>
                        <Textarea rows={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : mode === "create" ? "Create task" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
