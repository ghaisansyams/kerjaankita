"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { workspaceFormSchema, type WorkspaceFormValues } from "@/schemas/workspace.schema";
import { updateWorkspace, updateWorkspaceLogo } from "../actions";
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

type WorkflowOption = { id: string; name: string };

export function WorkspaceForm({
  workspaceId,
  initial,
  logoUrl,
  workflows,
}: {
  workspaceId: string;
  orgId?: string;
  initial: WorkspaceFormValues;
  logoUrl: string | null;
  workflows: WorkflowOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [logo, setLogo] = useState(logoUrl);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const form = useForm<WorkspaceFormValues>({
    resolver: zodResolver(workspaceFormSchema),
    defaultValues: initial,
  });

  function onSubmit(values: WorkspaceFormValues) {
    startTransition(async () => {
      const r = await updateWorkspace({
        id: workspaceId,
        name: values.name,
        description: values.description,
        color: values.color,
        defaultWorkflowId: values.defaultWorkflowId,
      });
      if (r?.ok) {
        toast.success("Workspace updated");
        router.refresh();
      } else {
        if (r?.error.fields) {
          for (const [f, m] of Object.entries(r.error.fields)) {
            form.setError(f as keyof WorkspaceFormValues, { message: m[0] });
          }
        }
        toast.error(r?.error.message ?? "Couldn't save");
      }
    });
  }

  async function onLogo(file: File | undefined) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image size must be less than 2MB");
      return;
    }
    setUploadingLogo(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const r = await updateWorkspaceLogo({ id: workspaceId, logoUrl: dataUrl });
        if (r?.ok) {
          setLogo(dataUrl);
          toast.success("Logo updated");
        } else {
          toast.error(r?.error.message ?? "Couldn't save logo");
        }
        setUploadingLogo(false);
      };
      reader.onerror = () => {
        toast.error("Failed to read image file");
        setUploadingLogo(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadingLogo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      {/* Branding / logo */}
      <div className="flex items-center gap-4">
        <div className="grid size-16 place-items-center overflow-hidden rounded-lg border bg-muted">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="Workspace logo" className="size-full object-cover" />
          ) : (
            <span className="text-xs text-muted-foreground">No logo</span>
          )}
        </div>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onLogo(e.target.files?.[0])}
          />
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploadingLogo}>
            {uploadingLogo ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Upload logo
          </Button>
          <p className="mt-1 text-xs text-muted-foreground">Shown to guests in the client portal.</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-lg space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Workspace name</FormLabel>
                <FormControl>
                  <Input {...field} />
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
                  <Textarea rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Accent colour</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Input type="color" className="h-9 w-14 p-1" {...field} />
                      <span className="text-sm text-muted-foreground">{field.value}</span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="defaultWorkflowId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default workflow</FormLabel>
                  <Select value={field.value || "none"} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Organization default" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Organization default</SelectItem>
                      {workflows.map((w) => (
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
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save workspace"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
