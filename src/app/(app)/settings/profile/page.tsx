import type { Metadata } from "next";
import { requireOrgContext } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/features/settings/components/profile-form";
import { AvatarUploader } from "@/features/settings/components/avatar-uploader";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfileSettingsPage() {
  const ctx = await requireOrgContext();
  const p = ctx.profile;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Avatar</CardTitle>
        </CardHeader>
        <CardContent>
          <AvatarUploader
            userId={p.id}
            name={p.full_name ?? p.email ?? "You"}
            avatarUrl={p.avatar_url}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            initial={{
              fullName: p.full_name ?? "",
              title: p.title ?? "",
              timezone: p.timezone,
              locale: p.locale,
              dateFormat: p.date_format,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
