"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/features/auth/actions";
import { SubmitButton } from "@/components/submit-button";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <SubmitButton variant="outline" size="sm" pendingText="Signing out…">
        <LogOut className="size-4" />
        Sign out
      </SubmitButton>
    </form>
  );
}
