"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  projectFormSchema,
  PROJECT_VISIBILITIES,
  type ProjectFormValues,
} from "@/schemas/project.schema";
import {
  PROJECT_COLORS,
  PROJECT_KEY_PRESETS,
  PROJECT_VISIBILITY_LABELS,
} from "@/constants";
import { cn } from "@/lib/utils";
import { createProject, updateProject } from "../actions";
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

export type PickerOption = { id: string; name: string };
export type MemberOption = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export type { ProjectFormValues };

const emptyDefaults = (workspaceId: string): ProjectFormValues => ({
  name: "",
  key: "",
  workspaceId,
  accountId: "none",
  ownerId: "none",
  visibility: "workspace",
  color: PROJECT_COLORS[0],
  description: "",
  startDate: "",
  endDate: "",
});

export function ProjectForm({
  open,
  onOpenChange,
  mode,
  projectId,
  initial,
  workspaces,
  accounts,
  members,
  defaultWorkspaceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  projectId?: string;
  initial?: Partial<ProjectFormValues>;
  workspaces: PickerOption[];
  accounts: PickerOption[];
  members: MemberOption[];
  defaultWorkspaceId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: { ...emptyDefaults(defaultWorkspaceId), ...initial },
  });

  function onSubmit(values: ProjectFormValues) {
    const payload = {
      name: values.name,
      key: values.key || undefined,
      workspaceId: values.workspaceId,
      accountId: values.accountId === "none" ? undefined : values.accountId,
      ownerId: values.ownerId === "none" ? undefined : values.ownerId,
      visibility: values.visibility,
      color: values.color,
      description: values.description || undefined,
      startDate: values.startDate || undefined,
      endDate: values.endDate || undefined,
    };
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createProject(payload)
          : await updateProject({ id: projectId as string, ...payload });

      if (result?.ok) {
        toast.success(
          mode === "create" ? "Project created" : "Project updated",
        );
        onOpenChange(false);
        if (mode === "create" && "id" in result.data) {
          router.push(`/projects/${result.data.id}`);
        } else {
          router.refresh();
        }
        return;
      }

      const error = result?.error;
      if (error?.fields) {
        for (const [field, messages] of Object.entries(error.fields)) {
          form.setError(field as keyof ProjectFormValues, {
            message: messages[0],
          });
        }
      }
      toast.error(error?.message ?? "Something went wrong");
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "New project" : "Edit project"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Set up a project. You can change any of this later."
              : "Update the project's details."}
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
                    <Input placeholder="Website redesign" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className={cn("grid gap-4", workspaces.length > 1 && "sm:grid-cols-2")}>
              {/* Only surface the Workspace picker once there's a real choice to make.
                  With a single (default "General") workspace it's just noise, so we hide
                  it and submit the default workspaceId silently. */}
              {workspaces.length > 1 && (
                <FormField
                  control={form.control}
                  name="workspaceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Workspace</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a workspace" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {workspaces.map((w) => (
                            <SelectItem key={w.id} value={w.id}>
                              {w.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Key (optional)</FormLabel>
                    <FormControl>
                      {/* Free-text, with a picker for the delivery lines we run
                          most often. Typing still wins — the presets only fill
                          the same input. */}
                      <InputGroup>
                        <InputGroupInput
                          placeholder="WEB"
                          maxLength={6}
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.value.toUpperCase())
                          }
                        />
                        <InputGroupAddon align="inline-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <InputGroupButton aria-label="Choose a preset key">
                                <ChevronDown />
                              </InputGroupButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {PROJECT_KEY_PRESETS.map((p) => (
                                <DropdownMenuItem
                                  key={p.key}
                                  onSelect={() => field.onChange(p.key)}
                                >
                                  <span className="font-mono text-xs text-muted-foreground">
                                    {p.key}
                                  </span>
                                  {p.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </InputGroupAddon>
                      </InputGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="accountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client (optional)</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None (internal)</SelectItem>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
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
                name="ownerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PIC</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.full_name ?? m.email ?? "Member"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
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
            </div>

            {/* Nobody picks visibility while setting a project up — it's a
                later decision. Create submits the "workspace" default silently
                (same as the Workspace picker above) and Edit still exposes it. */}
            {mode === "edit" && (
              <FormField
                control={form.control}
                name="visibility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visibility</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PROJECT_VISIBILITIES.map((v) => (
                          <SelectItem key={v} value={v}>
                            {PROJECT_VISIBILITY_LABELS[v]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Colour</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {PROJECT_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Colour ${c}`}
                          aria-pressed={field.value === c}
                          onClick={() => field.onChange(c)}
                          className={cn(
                            "size-6 rounded-full ring-offset-2 ring-offset-background transition-shadow",
                            field.value === c && "ring-2 ring-ring",
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
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
                    <Textarea rows={3} placeholder="What is this project about?" {...field} />
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
                  ? mode === "create"
                    ? "Creating…"
                    : "Saving…"
                  : mode === "create"
                    ? "Create project"
                    : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
