import type { Metadata } from "next";
import { requireOrgContext } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmailForm } from "@/features/settings/components/email-form";
import { PasswordForm } from "@/features/settings/components/password-form";

export const metadata: Metadata = { title: "Account & security" };

export default async function SecuritySettingsPage() {
  const ctx = await requireOrgContext();

  return (
    <div className="max-w-lg space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email address</CardTitle>
          <p className="text-sm text-muted-foreground">Used to sign in and receive account emails.</p>
        </CardHeader>
        <CardContent>
          <EmailForm currentEmail={ctx.profile.email ?? ""} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change password</CardTitle>
          <p className="text-sm text-muted-foreground">Use at least 8 characters.</p>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
