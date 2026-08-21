import "server-only";
import { prisma } from "@/lib/prisma";

/** Health tolerance for BR-5 (falls back to the seeded default of 15). */
export async function getHealthTolerance(orgId: string): Promise<number> {
  const data = await prisma.organizationSetting.findUnique({
    where: { organizationId: orgId },
    select: { healthTolerancePoints: true },
  });
  return data?.healthTolerancePoints ?? 15;
}
