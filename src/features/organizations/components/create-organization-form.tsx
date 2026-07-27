"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { AuthAlert } from "@/features/auth/components/auth-alert";
import {
  createOrganization,
  type OrgActionState,
} from "@/features/organizations/actions";

type Industry = { key: string; name: string; description: string | null };

export function CreateOrganizationForm({
  industries,
}: {
  industries: Industry[];
}) {
  const [state, formAction] = useActionState<OrgActionState, FormData>(
    createOrganization,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <AuthAlert error={state?.error} />

      <div className="space-y-2">
        <Label htmlFor="name">Organization name</Label>
        <Input
          id="name"
          name="name"
          placeholder="Acme Consulting"
          autoComplete="organization"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="industryKey">Industry</Label>
        <Select name="industryKey" defaultValue="general">
          <SelectTrigger id="industryKey" className="w-full">
            <SelectValue placeholder="Choose an industry" />
          </SelectTrigger>
          <SelectContent>
            {industries.map((i) => (
              <SelectItem key={i.key} value={i.key}>
                {i.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Determines your default task workflow. You can change it later.
        </p>
      </div>

      <SubmitButton className="w-full" pendingText="Creating…">
        Create organization
      </SubmitButton>
    </form>
  );
}
