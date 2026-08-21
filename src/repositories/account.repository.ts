import "server-only";
import { prisma } from "@/lib/prisma";

/** Read-only account options for the project picker. Full Accounts CRUD is a later sprint. */
export async function listAccountOptions(orgId: string) {
  const data = await prisma.account.findMany({
    where: {
      organizationId: orgId,
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });
  return data;
}

export type AccountOption = Awaited<ReturnType<typeof listAccountOptions>>[number];

export type ClientAccountRow = {
  id: string;
  name: string;
  code: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  projects: { id: string; name: string }[];
  contactCount: number;
};

/** Client accounts for the org, each with its linked projects and portal-contact count. */
export async function listClientAccounts(orgId: string): Promise<ClientAccountRow[]> {
  const [accounts, projects, guests] = await Promise.all([
    prisma.account.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        code: true,
        email: true,
        phone: true,
        website: true,
        address: true,
        notes: true,
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.project.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        accountId: { not: null },
      },
      select: {
        id: true,
        name: true,
        accountId: true,
      },
    }),
    prisma.organizationMember.findMany({
      where: {
        organizationId: orgId,
        memberType: "guest",
        accountId: { not: null },
      },
      select: {
        accountId: true,
      },
    }),
  ]);

  const projectsByAccount = new Map<string, { id: string; name: string }[]>();
  for (const p of projects) {
    if (!p.accountId) continue;
    const list = projectsByAccount.get(p.accountId) ?? [];
    list.push({ id: p.id, name: p.name });
    projectsByAccount.set(p.accountId, list);
  }
  const contactsByAccount = new Map<string, number>();
  for (const g of guests) {
    if (!g.accountId) continue;
    contactsByAccount.set(g.accountId, (contactsByAccount.get(g.accountId) ?? 0) + 1);
  }

  return accounts.map((a) => ({
    id: a.id,
    name: a.name,
    code: a.code,
    email: a.email,
    phone: a.phone,
    website: a.website,
    address: a.address,
    notes: a.notes,
    isActive: a.isActive,
    projects: projectsByAccount.get(a.id) ?? [],
    contactCount: contactsByAccount.get(a.id) ?? 0,
  }));
}

/** The system "guest" role — used when inviting a client contact to the portal. */
export async function getGuestRoleId() {
  const role = await prisma.role.findFirst({
    where: {
      key: "org_guest",
      organizationId: null,
    },
    select: {
      id: true,
    },
  });
  return role?.id ?? null;
}

export async function insertAccount(values: {
  id?: string;
  organization_id?: string;
  organizationId?: string;
  name: string;
  code?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  notes?: string | null;
  is_active?: boolean;
  isActive?: boolean;
  created_by?: string | null;
  createdBy?: string | null;
}) {
  const data = await prisma.account.create({
    data: {
      id: values.id,
      organizationId: values.organizationId || values.organization_id!,
      name: values.name,
      code: values.code,
      email: values.email,
      phone: values.phone,
      website: values.website,
      address: values.address,
      notes: values.notes,
      isActive: values.isActive ?? values.is_active ?? true,
      createdBy: values.createdBy || values.created_by,
    },
    select: { id: true },
  });
  return data;
}

export async function updateAccountRow(
  id: string,
  patch: {
    name?: string;
    code?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    address?: string | null;
    notes?: string | null;
    is_active?: boolean;
    isActive?: boolean;
    updated_by?: string | null;
    updatedBy?: string | null;
  },
) {
  await prisma.account.update({
    where: { id },
    data: {
      name: patch.name,
      code: patch.code,
      email: patch.email,
      phone: patch.phone,
      website: patch.website,
      address: patch.address,
      notes: patch.notes,
      isActive: patch.isActive ?? patch.is_active,
      updatedBy: patch.updatedBy || patch.updated_by,
    },
  });
}

export async function softDeleteAccount(id: string) {
  await prisma.account.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
