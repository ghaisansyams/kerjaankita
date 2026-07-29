import { z } from "zod";

const optional = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const optionalUuid = z.string().uuid().optional().or(z.literal(""));

export const MOM_CATEGORY = z.enum(["discussion", "decision", "action_item", "next_step"]);

const participant = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  role: optional(80),
  company: optional(120),
});

const note = z.object({
  id: z.string().uuid().optional(),
  category: MOM_CATEGORY.default("discussion"),
  content: z.string().trim().min(1, "Write the point").max(4000),
});

const momFields = {
  projectId: z.string().uuid("Select a project"),
  title: z.string().trim().min(2, "Title is required").max(200),
  meetingDate: z.string().min(1, "Meeting date is required"),
  meetingTime: optional(60),
  location: optional(200),
  picId: optionalUuid,
  approvedByName: optional(120),
  approvedByRole: optional(80),
  participants: z.array(participant).max(50).default([]),
  distribution: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  notes: z.array(note).max(200).default([]),
};

export const createMomSchema = z.object(momFields);
export const updateMomSchema = z.object({ id: z.string().uuid(), ...momFields });
export const deleteMomSchema = z.object({ id: z.string().uuid() });
export const logMomExportSchema = z.object({ id: z.string().uuid() });

export const createTaskFromNoteSchema = z.object({
  noteId: z.string().uuid(),
  title: z.string().trim().min(1, "Task title is required").max(200),
  assigneeId: optionalUuid,
  dueDate: z.string().optional().or(z.literal("")),
});
