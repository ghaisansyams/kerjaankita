"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { updateEmailSchema, type EmailFormValues } from "@/schemas/profile.schema";
import { changeEmail } from "../actions";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function EmailForm({ currentEmail }: { currentEmail: string }) {
  const [pending, startTransition] = useTransition();
  const form = useForm<EmailFormValues>({
    resolver: zodResolver(updateEmailSchema),
    defaultValues: { email: currentEmail },
  });

  function onSubmit(values: EmailFormValues) {
    startTransition(async () => {
      const r = await changeEmail(values);
      if (r?.ok) {
        toast.success("Check your new inbox to confirm the change");
      } else {
        if (r?.error.fields?.email) form.setError("email", { message: r.error.fields.email[0] });
        toast.error(r?.error.message ?? "Couldn't update email");
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-sm space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email address</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormDescription>
                We&apos;ll email a confirmation link before your address changes.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Update email"}
        </Button>
      </form>
    </Form>
  );
}
