"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import {
  requestPasswordReset,
  type AuthActionState,
} from "@/features/auth/actions";
import { AuthAlert } from "./auth-alert";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState<AuthActionState, FormData>(
    requestPasswordReset,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <AuthAlert error={state?.error} success={state?.success} />

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
        />
      </div>

      <SubmitButton className="w-full" pendingText="Sending link…">
        Send reset link
      </SubmitButton>
    </form>
  );
}
