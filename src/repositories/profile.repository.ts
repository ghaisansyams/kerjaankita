import "server-only";
import { prisma } from "@/lib/prisma";

/** Update the caller's own profile. */
export async function updateProfile(
  id: string,
  patch: {
    full_name?: string | null;
    fullName?: string | null;
    avatar_url?: string | null;
    avatarUrl?: string | null;
    title?: string | null;
    phone?: string | null;
    timezone?: string;
    locale?: string;
    date_format?: string;
    dateFormat?: string;
    is_active?: boolean;
    isActive?: boolean;
    updated_by?: string | null;
    updatedBy?: string | null;
  },
) {
  await prisma.profile.update({
    where: { id },
    data: {
      fullName: patch.fullName !== undefined ? patch.fullName : patch.full_name,
      avatarUrl: patch.avatarUrl !== undefined ? patch.avatarUrl : patch.avatar_url,
      title: patch.title,
      phone: patch.phone,
      timezone: patch.timezone,
      locale: patch.locale,
      dateFormat: patch.dateFormat || patch.date_format,
      isActive: patch.isActive ?? patch.is_active,
      updatedBy: patch.updatedBy || patch.updated_by,
    },
  });
}
