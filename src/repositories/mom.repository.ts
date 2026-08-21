import "server-only";
import { prisma } from "@/lib/prisma";
import { listOrgMemberProfiles } from "@/repositories/member.repository";

export const MOM_CATEGORIES = ["discussion", "decision", "action_item", "next_step"] as const;
export type MomCategory = (typeof MOM_CATEGORIES)[number];

export type MomParticipantVM = { id: string; name: string; role: string | null; company: string | null };
export type MomDistributionVM = { id: string; recipient: string };
export type MomNoteVM = { id: string; category: string; content: string; position: number; taskId: string | null };

export type MomListItem = {
  id: string;
  title: string;
  meetingDate: string;
  meetingTime: string | null;
  location: string | null;
  projectId: string;
  projectName: string;
  projectColor: string | null;
  workspaceId: string | null;
  picId: string | null;
  picName: string | null;
  noteCount: number;
};

export type MomDetail = {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  projectId: string;
  projectName: string;
  title: string;
  meetingDate: string;
  meetingTime: string | null;
  location: string | null;
  picId: string | null;
  picName: string | null;
  preparedById: string | null;
  preparedByName: string | null;
  approvedByName: string;
  approvedByRole: string;
  participants: MomParticipantVM[];
  distribution: MomDistributionVM[];
  notes: MomNoteVM[];
};

export type MomFilters = {
  search?: string;
  projectId?: string;
  picId?: string;
  workspaceId?: string;
  from?: string;
  to?: string;
};

import type { Prisma } from "@prisma/client";

export async function listMoms(orgId: string, filters: MomFilters = {}): Promise<MomListItem[]> {
  const where: Prisma.MomWhereInput = {
    organizationId: orgId,
    deletedAt: null,
  };

  if (filters.projectId) where.projectId = filters.projectId;
  if (filters.picId) where.picId = filters.picId;
  if (filters.workspaceId) where.workspaceId = filters.workspaceId;
  if (filters.from || filters.to) {
    const meetingDateFilter: Prisma.DateTimeFilter = {};
    if (filters.from) meetingDateFilter.gte = new Date(filters.from);
    if (filters.to) meetingDateFilter.lte = new Date(filters.to);
    where.meetingDate = meetingDateFilter;
  }
  if (filters.search) {
    where.title = { contains: filters.search, mode: "insensitive" };
  }

  const moms = await prisma.mom.findMany({
    where,
    select: {
      id: true,
      title: true,
      meetingDate: true,
      meetingTime: true,
      location: true,
      projectId: true,
      workspaceId: true,
      picId: true,
      project: {
        select: {
          name: true,
          color: true,
        },
      },
      pic: {
        select: {
          fullName: true,
        },
      },
      _count: {
        select: {
          notes: true,
        },
      },
    },
    orderBy: [
      { meetingDate: "desc" },
      { createdAt: "desc" },
    ],
  });

  return moms.map((m) => ({
    id: m.id,
    title: m.title,
    meetingDate: m.meetingDate.toISOString().split("T")[0],
    meetingTime: m.meetingTime,
    location: m.location,
    projectId: m.projectId,
    projectName: m.project.name,
    projectColor: m.project.color,
    workspaceId: m.workspaceId,
    picId: m.picId,
    picName: m.pic?.fullName ?? null,
    noteCount: m._count.notes,
  }));
}

export async function listProjectMoms(projectId: string): Promise<MomListItem[]> {
  const mom = await prisma.mom.findFirst({
    where: { projectId, deletedAt: null },
    select: { organizationId: true },
  });
  if (!mom) return [];
  return listMoms(mom.organizationId, { projectId });
}

export async function getMom(id: string): Promise<MomDetail | null> {
  const mom = await prisma.mom.findFirst({
    where: { id, deletedAt: null },
    include: {
      project: { select: { name: true } },
      pic: { select: { fullName: true } },
      preparer: { select: { fullName: true } },
      participants: { orderBy: { position: "asc" } },
      distribution: { orderBy: { position: "asc" } },
      notes: { orderBy: { position: "asc" } },
    },
  });

  if (!mom) return null;

  return {
    id: mom.id,
    organizationId: mom.organizationId,
    workspaceId: mom.workspaceId,
    projectId: mom.projectId,
    projectName: mom.project.name,
    title: mom.title,
    meetingDate: mom.meetingDate.toISOString().split("T")[0],
    meetingTime: mom.meetingTime,
    location: mom.location,
    picId: mom.picId,
    picName: mom.pic?.fullName ?? null,
    preparedById: mom.preparedBy,
    preparedByName: mom.preparer?.fullName ?? null,
    approvedByName: mom.approvedByName,
    approvedByRole: mom.approvedByRole,
    participants: mom.participants.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      company: p.company,
    })),
    distribution: mom.distribution.map((d) => ({
      id: d.id,
      recipient: d.recipient,
    })),
    notes: mom.notes.map((n) => ({
      id: n.id,
      category: n.category,
      content: n.content,
      position: n.position,
      taskId: n.taskId,
    })),
  };
}

/** Options for the list filters + the create form. */
export async function getMomFilterOptions(orgId: string) {
  const [projects, workspaces, members] = await Promise.all([
    prisma.project.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { id: true, name: true, workspaceId: true },
      orderBy: { name: "asc" },
    }),
    prisma.workspace.findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    listOrgMemberProfiles(orgId),
  ]);

  return {
    projects: projects.map((p) => ({ id: p.id, name: p.name, workspaceId: p.workspaceId })),
    workspaces: workspaces.map((w) => ({ id: w.id, name: w.name })),
    members: members.map((m) => ({ id: m.id, name: m.full_name ?? m.email ?? "Member" })),
  };
}

export interface InsertMomInput {
  id?: string;
  organization_id?: string;
  organizationId?: string;
  workspace_id?: string | null;
  workspaceId?: string | null;
  project_id?: string | null;
  projectId?: string | null;
  title: string;
  meeting_date?: string | Date;
  meetingDate?: string | Date;
  meeting_time?: string | null;
  meetingTime?: string | null;
  location?: string | null;
  pic_id?: string | null;
  picId?: string | null;
  prepared_by?: string | null;
  preparedBy?: string | null;
  approved_by_name?: string | null;
  approvedByName?: string | null;
  approved_by_role?: string | null;
  approvedByRole?: string | null;
  created_by?: string | null;
  createdBy?: string | null;
  [key: string]: unknown;
}

export async function insertMom(values: InsertMomInput): Promise<{ id: string }> {
  const mom = await prisma.mom.create({
    data: {
      id: values.id,
      organizationId: values.organizationId || values.organization_id!,
      workspaceId: values.workspaceId !== undefined ? values.workspaceId : values.workspace_id,
      projectId: (values.projectId || values.project_id)!,
      title: values.title,
      meetingDate: new Date(values.meetingDate || values.meeting_date || Date.now()),
      meetingTime: values.meetingTime || values.meeting_time,
      location: values.location,
      picId: values.picId !== undefined ? values.picId : values.pic_id,
      preparedBy: values.preparedBy !== undefined ? values.preparedBy : values.prepared_by,
      approvedByName: values.approvedByName || values.approved_by_name || "Galih Aldio Putra",
      approvedByRole: values.approvedByRole || values.approvedByRole || "Director",
      createdBy: values.createdBy || values.created_by,
    },
    select: { id: true },
  });
  return { id: mom.id };
}

export interface UpdateMomInput {
  title?: string;
  meeting_date?: string | Date | null;
  meetingDate?: string | Date | null;
  meeting_time?: string | null;
  meetingTime?: string | null;
  location?: string | null;
  pic_id?: string | null;
  picId?: string | null;
  prepared_by?: string | null;
  preparedBy?: string | null;
  approved_by_name?: string | null;
  approvedByName?: string | null;
  approved_by_role?: string | null;
  approvedByRole?: string | null;
  updated_by?: string | null;
  updatedBy?: string | null;
  updated_at?: string | Date | null;
  updatedAt?: string | Date | null;
  [key: string]: unknown;
}

export async function updateMomRow(id: string, patch: UpdateMomInput) {
  const d = patch.meetingDate || patch.meeting_date;
  await prisma.mom.update({
    where: { id },
    data: {
      title: patch.title,
      meetingDate: d ? new Date(d) : undefined,
      meetingTime: patch.meetingTime !== undefined ? patch.meetingTime : patch.meeting_time,
      location: patch.location,
      picId: patch.picId !== undefined ? patch.picId : patch.pic_id,
      preparedBy: patch.preparedBy !== undefined ? patch.preparedBy : patch.prepared_by,
      approvedByName: (patch.approvedByName || patch.approved_by_name) || undefined,
      approvedByRole: (patch.approvedByRole || patch.approved_by_role) || undefined,
      updatedBy: patch.updatedBy || patch.updated_by,
    },
  });
}

export async function softDeleteMom(id: string) {
  await prisma.mom.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function replaceParticipants(momId: string, items: { name: string; role: string | null; company: string | null }[]) {
  await prisma.$transaction(async (tx) => {
    await tx.momParticipant.deleteMany({ where: { momId } });
    if (items.length > 0) {
      await tx.momParticipant.createMany({
        data: items.map((it, i) => ({
          momId,
          name: it.name,
          role: it.role,
          company: it.company,
          position: i,
        })),
      });
    }
  });
}

export async function replaceDistribution(momId: string, recipients: string[]) {
  await prisma.$transaction(async (tx) => {
    await tx.momDistribution.deleteMany({ where: { momId } });
    if (recipients.length > 0) {
      await tx.momDistribution.createMany({
        data: recipients.map((r, i) => ({
          momId,
          recipient: r,
          position: i,
        })),
      });
    }
  });
}

export async function reconcileNotes(
  momId: string,
  notes: { id?: string; category: string; content: string }[],
) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.momNote.findMany({
      where: { momId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((r) => r.id));
    const keepIds = new Set(notes.filter((n) => n.id).map((n) => n.id as string));
    const toDelete = [...existingIds].filter((id) => !keepIds.has(id));

    if (toDelete.length > 0) {
      await tx.momNote.deleteMany({
        where: { id: { in: toDelete } },
      });
    }

    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      if (n.id && existingIds.has(n.id)) {
        await tx.momNote.update({
          where: { id: n.id },
          data: { category: n.category, content: n.content, position: i },
        });
      } else {
        await tx.momNote.create({
          data: { momId, category: n.category, content: n.content, position: i },
        });
      }
    }
  });
}

export async function getNote(noteId: string): Promise<{ momId: string; content: string; taskId: string | null } | null> {
  const data = await prisma.momNote.findUnique({
    where: { id: noteId },
    select: { momId: true, content: true, taskId: true },
  });
  if (!data) return null;
  return {
    momId: data.momId,
    content: data.content,
    taskId: data.taskId,
  };
}

export async function linkNoteTask(noteId: string, taskId: string) {
  await prisma.momNote.update({
    where: { id: noteId },
    data: { taskId },
  });
}

export async function getMomProjectContext(momId: string): Promise<{ organizationId: string; projectId: string } | null> {
  const data = await prisma.mom.findFirst({
    where: { id: momId, deletedAt: null },
    select: { organizationId: true, projectId: true },
  });
  if (!data) return null;
  return {
    organizationId: data.organizationId,
    projectId: data.projectId,
  };
}

/** Resolve a project's workspace_id. */
export async function getProjectWorkspace(projectId: string): Promise<string | null> {
  const data = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true },
  });
  return data?.workspaceId ?? null;
}

/** Company letterhead for the PDF. */
export async function getOrgBranding(orgId: string): Promise<{ name: string; logoUrl: string | null }> {
  const data = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, logoUrl: true },
  });
  return {
    name: data?.name ?? "Company",
    logoUrl: data?.logoUrl ?? null,
  };
}
