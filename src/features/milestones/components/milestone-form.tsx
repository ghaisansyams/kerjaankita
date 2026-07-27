"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  milestoneFormSchema,
  type MilestoneFormValues,
} from "@/schemas/milestone.schema";
import { createMilestone, updateMilestone } from "../actions";
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

export function MilestoneForm({
  open,
  onOpenChange,
  mode,
  projectId,
  milestoneId,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  projectId: string;
  milestoneId?: string;
  initial?: Partial<MilestoneFormValues>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<MilestoneFormValues>({
    resolver: zodResolver(milestoneFormSchema),
    defaultValues: { name: "", description: "", dueDate: "", ...initial },
  });

  function onSubmit(values: MilestoneFormValues) {
    const payload = {
      name: values.name,
      description: values.description || undefined,
      dueDate: values.dueDate || undefined,
    };
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createMilestone({ projectId, ...payload })
          : await updateMilestone({ id: milestoneId as string, ...payload });
      if (result?.ok) {
        toast.success(mode === "create" ? "Milestone created" : "Milestone updated");
        onOpenChange(false);
        if (mode === "create") form.reset({ name: "", description: "", dueDate: "" });
        router.refresh();
        return;
      }
      if (result?.error.fields) {
        for (const [field, messages] of Object.entries(result.error.fields)) {
          form.setError(field as keyof MilestoneFormValues, { message: messages[0] });
        }
      }
      toast.error(result?.error.message ?? "Something went wrong");
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "New milestone" : "Edit milestone"}
          </DialogTitle>
          <DialogDescription>
            Milestones mark key checkpoints and are visible to clients.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Design sign-off" {...field} />
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
                  <FormLabel>Due date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
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
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending
                  ? "Saving…"
                  : mode === "create"
                    ? "Create milestone"
                    : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
