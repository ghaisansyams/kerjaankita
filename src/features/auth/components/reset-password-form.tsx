"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { updatePassword, type AuthActionState } from "@/features/auth/actions";
import { AuthAlert } from "./auth-alert";

export function ResetPasswordForm() {
  const [state, formAction] = useActionState<AuthActionState, FormData>(
    updatePassword,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <AuthAlert error={state?.error} />

      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm password</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>

      <SubmitButton className="w-full" pendingText="Updating…">
        Update password
      </SubmitButton>
    </form>
  );
}
