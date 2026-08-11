"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireOrgContext } from "@/lib/auth";
import { PERMISSIONS } from "@/constants";
import { checkPermission } from "@/repositories/permission.repository";
import { createAdminClient } from "@/lib/supabase/admin";
import * as plan from "@/repositories/import-planning.repository";
import { getParser } from "@/services/import/parsers";
import { getAiProvider, aiImportEnabled, registeredProviders } from "@/services/ai";
import { getOpenAICompatibleUsage, type AiUsage } from "@/services/ai/usage";
import {
  buildImportSystemPrompt,
  buildImportUserPrompt,
  buildExpandSystemPrompt,
  buildExpandUserPrompt,
  compactText,
} from "@/services/import/prompt";
import {
  AI_ANALYSIS_JSON_SCHEMA,
  AI_ANALYSIS_TOOL_NAME,
  AI_EXPAND_JSON_SCHEMA,
  AI_EXPAND_TOOL_NAME,
  aiAnalysisSchema,
  aiExpandSchema,
  analyzeImportSchema,
  commitAiImportSchema,
  expandImportTaskSchema,
  importJobIdSchema,
} from "@/schemas/import-ai.schema";
import { toFieldErrors } from "@/lib/validation";
import { mapUnknownError } from "@/lib/errors";
import { actionError, actionOk, type ActionResult } from "@/types/action";

const BUCKET = "attachments";

export type ImportImageRef = {
  index: number;
  path: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  previewUrl: string;
};

/** Whether the AI importer is operational (a provider has credentials). */
export async function aiImportStatus(): Promise<
  ActionResult<{ enabled: boolean; providers: string[] }>
> {
  await requireOrgContext();
  return actionOk({ enabled: aiImportEnabled(), providers: registeredProviders() });
}

/** Live free-tier usage/quota for the OpenAI-compatible (Groq) provider. */
export async function aiProviderUsage(): Promise<ActionResult<AiUsage>> {
  await requireOrgContext();
  const provider = (process.env.AI_PROVIDER || "").trim().toLowerCase();
  if (provider && provider !== "openai-compatible") {
    return actionOk({ configured: false, provider, model: "" });
  }
  return actionOk(await getOpenAICompatibleUsage());
}

/** Authorize the raw upload; returns a tenant-scoped temp storage path. */
export async function requestAiImportUpload(
  input: unknown,
): Promise<ActionResult<{ bucket: string; path: string }>> {
  const ctx = await requireOrgContext();
  const parsed = z
    .object({ fileName: z.string().trim().min(1).max(255), fileType: z.string().max(255).optional() })
    .safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "That file can't be uploaded.");
  if (!(await checkPermission(ctx.organization.id, PERMISSIONS.ATTACHMENT_UPLOAD, {}))) {
    return actionError("FORBIDDEN", "You can't import documents.");
  }
  const safe = parsed.data.fileName.replace(/[^\w.\-]+/g, "_").slice(0, 200) || "file";
  const path = `${ctx.organization.id}/_ai-import/${crypto.randomUUID()}-${safe}`;
  return actionOk({ bucket: BUCKET, path });
}

/** Parse + understand a document. Creates an import job and returns the
 *  validated hierarchy for preview. Returns NOT_CONFIGURED when no provider. */
export async function analyzeImportDocument(input: unknown): Promise<
  ActionResult<{ jobId: string; analysis: unknown; images: ImportImageRef[] }>
> {
  const ctx = await requireOrgContext();
  const parsed = analyzeImportSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Invalid request.");
  const { bucket, path, fileName, fileType } = parsed.data;
  const orgId = ctx.organization.id;

  if (!(await checkPermission(orgId, PERMISSIONS.ATTACHMENT_UPLOAD, {}))) {
    return actionError("FORBIDDEN", "You can't import documents.");
  }
  if (!path.startsWith(`${orgId}/`)) return actionError("FORBIDDEN", "Invalid file path.");

  const provider = getAiProvider();
  const jobId = await plan.insertImportJob({
    organization_id: orgId,
    created_by: ctx.profile.id,
    file_name: fileName,
    file_path: path,
    file_type: fileType,
    provider: provider?.name ?? null,
    status: provider ? "parsing" : "failed",
    error: provider ? null : "AI provider not configured",
  });

  if (!provider) {
    return actionError(
      "NOT_CONFIGURED",
      "AI import isn't active yet. Add an ANTHROPIC_API_KEY to enable document understanding.",
    );
  }

  const admin = createAdminClient();
  try {
    const parser = getParser(fileName);
    if (!parser) {
      await plan.updateImportJob(jobId, { status: "failed", error: "Unsupported file type" });
      return actionError("VALIDATION", "Only .docx, .pdf or .xlsx files are supported.");
    }
    const dl = await admin.storage.from(bucket).download(path);
    if (dl.error || !dl.data) {
      await plan.updateImportJob(jobId, { status: "failed", error: "File not found" });
      return actionError("NOT_FOUND", "Uploaded file not found.");
    }
    const buffer = Buffer.from(await dl.data.arrayBuffer());
    const doc = await parser.parse(buffer, fileName);

    // Stage extracted images in storage (kept until commit attaches them).
    const images: ImportImageRef[] = [];
    for (const img of doc.images) {
      const imgPath = `${orgId}/_ai-import/img/${crypto.randomUUID()}.${img.ext}`;
      const up = await admin.storage
        .from(bucket)
        .upload(imgPath, img.data, { contentType: img.contentType, upsert: false });
      if (up.error) continue;
      const signed = await admin.storage.from(bucket).createSignedUrl(imgPath, 3600);
      images.push({
        index: img.index,
        path: imgPath,
        fileName: `image-${img.index}.${img.ext}`,
        fileType: img.contentType,
        fileSize: img.data.length,
        previewUrl: signed.data?.signedUrl ?? "",
      });
    }

    await plan.updateImportJob(jobId, { status: "analyzing" });
    const raw = await provider.analyzeDocument({
      fileName,
      systemPrompt: buildImportSystemPrompt(),
      userPrompt: buildImportUserPrompt(doc),
      jsonSchema: AI_ANALYSIS_JSON_SCHEMA,
      toolName: AI_ANALYSIS_TOOL_NAME,
      documentText: doc.text || undefined,
      pdfBase64: doc.pdfBase64,
      maxTokens: 3000, // pass 1 only lists areas + roles → small output
    });

    const val = aiAnalysisSchema.safeParse(raw);
    if (!val.success) {
      await plan.updateImportJob(jobId, { status: "failed", error: "AI output failed validation" });
      return actionError("INTERNAL", "The AI response couldn't be understood. Please try again.");
    }
    const analysis = val.data;

    await admin.storage.from(bucket).remove([path]); // temp source no longer needed
    // Keep the compacted text so pass 2 can expand each area without re-parsing.
    const documentText = doc.text ? compactText(doc.text).slice(0, 120_000) : "";
    await plan.updateImportJob(jobId, {
      status: "preview",
      document_type: analysis.documentType,
      confidence: analysis.overallConfidence,
      result: { analysis, images, documentText },
    });
    return actionOk({ jobId, analysis, images });
  } catch (e) {
    await plan.updateImportJob(jobId, {
      status: "failed",
      error: (e as Error)?.message?.slice(0, 500) ?? "error",
    });
    return mapUnknownError(e);
  }
}

export async function getImportJob(input: unknown): Promise<
  ActionResult<{ status: string; error: string | null; result: unknown }>
> {
  await requireOrgContext();
  const parsed = importJobIdSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Invalid request.");
  const row = await plan.getImportJobRow(parsed.data.jobId);
  if (!row) return actionError("NOT_FOUND", "Import job not found.");
  return actionOk({
    status: row.status as string,
    error: (row.error as string | null) ?? null,
    result: row.result ?? null,
  });
}

/** Pass 2: expand ONE area (feature) into a COMPLETE nested checklist. Runs once
 *  per area, keeping each request small so the model lists every sub-module/leaf. */
export async function expandImportTask(
  input: unknown,
): Promise<ActionResult<{ checklist: unknown[] }>> {
  const ctx = await requireOrgContext();
  const parsed = expandImportTaskSchema.safeParse(input);
  if (!parsed.success) return actionError("VALIDATION", "Invalid request.");
  const { jobId, roadmapIndex, moduleIndex, featureIndex } = parsed.data;

  const provider = getAiProvider();
  if (!provider) return actionError("NOT_CONFIGURED", "AI import isn't active.");

  const job = await plan.getImportJobRow(jobId);
  if (!job || (job as { organization_id?: string }).organization_id !== ctx.organization.id) {
    return actionError("NOT_FOUND", "Import job not found.");
  }
  const result = (job.result ?? {}) as {
    analysis?: {
      roadmaps?: Array<{
        modules?: Array<{ features?: Array<{ name?: string; checklist?: Array<{ text?: string }> }> }>;
      }>;
    };
    documentText?: string;
  };
  const feature =
    result.analysis?.roadmaps?.[roadmapIndex]?.modules?.[moduleIndex]?.features?.[featureIndex];
  if (!feature?.name) return actionError("NOT_FOUND", "Area not found.");
  const subModules = (feature.checklist ?? []).map((c) => c?.text ?? "").filter(Boolean);

  try {
    const raw = await provider.analyzeDocument({
      fileName: "expand",
      systemPrompt: buildExpandSystemPrompt(),
      userPrompt: buildExpandUserPrompt(feature.name, subModules, result.documentText ?? ""),
      jsonSchema: AI_EXPAND_JSON_SCHEMA,
      toolName: AI_EXPAND_TOOL_NAME,
      maxTokens: 2500, // one area's checklist → small; keeps request under TPM
    });
    const val = aiExpandSchema.safeParse(raw);
    if (!val.success) return actionError("INTERNAL", "Couldn't expand this area.");
    return actionOk({ checklist: val.data.checklist });
  } catch (e) {
    // Preserve rate-limit / size details so the client can pace + retry; keep
    // other failures generic.
    const msg = (e as Error)?.message ?? "";
    if (/rate|tokens per minute|429|too large|413|AI request failed/i.test(msg)) {
      return actionError("INTERNAL", msg.slice(0, 300));
    }
    return mapUnknownError(e);
  }
}

/** Materialize the reviewed hierarchy: Project → Roadmaps → Modules →
 *  Features (Tasks) → Checklists → Attachments. */
export async function commitAiImport(
  input: unknown,
): Promise<ActionResult<{ projectId: string; roadmaps: number; modules: number; tasks: number }>> {
  const ctx = await requireOrgContext();
  const parsed = commitAiImportSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("VALIDATION", "Please check the import.", toFieldErrors(parsed.error));
  }
  const { jobId, projectName, projectId: existingProjectId, statusId, duplicateStrategy, analysis } =
    parsed.data;
  const orgId = ctx.organization.id;

  const job = await plan.getImportJobRow(jobId);
  if (!job) return actionError("NOT_FOUND", "Import job not found.");
  const jobImages = ((job.result as { images?: ImportImageRef[] } | null)?.images ?? []) as ImportImageRef[];
  const imageByIndex = new Map(jobImages.map((im) => [im.index, im]));

  try {
    // Resolve target project (existing or freshly created).
    let projectId = existingProjectId ?? "";
    if (!projectId) {
      if (!projectName) return actionError("VALIDATION", "A project name is required.");
      if (!(await checkPermission(orgId, PERMISSIONS.PROJECT_CREATE, {}))) {
        return actionError("FORBIDDEN", "You can't create projects.");
      }
      const wsId = await plan.getDefaultWorkspaceId(orgId);
      if (!wsId) return actionError("INTERNAL", "No workspace found for this organization.");
      projectId = crypto.randomUUID();
      await plan.insertProjectRow({
        id: projectId,
        organization_id: orgId,
        workspace_id: wsId,
        name: projectName,
        description: analysis.summary || null,
        color: "#1F4E8C",
        owner_id: ctx.profile.id,
        created_by: ctx.profile.id,
        updated_by: ctx.profile.id,
      });
    }
    if (!(await checkPermission(orgId, PERMISSIONS.TASK_CREATE, { projectId }))) {
      return actionError("FORBIDDEN", "You can't add tasks to this project.");
    }

    const targetStatus = statusId ?? (await plan.getInitialStatusId(projectId));

    // Duplicate detection against existing task titles.
    const existing = new Map(
      (await plan.listTaskTitles(projectId)).map((t) => [t.title.trim().toLowerCase(), t.id]),
    );

    let roadmaps = 0;
    let modules = 0;
    let tasks = 0;
    let rPos = 0;

    for (const rm of analysis.roadmaps) {
      const roadmapId = await plan.insertRoadmap({
        organization_id: orgId,
        project_id: projectId,
        name: rm.name,
        description: rm.description || null,
        position: rPos++,
        created_by: ctx.profile.id,
        updated_by: ctx.profile.id,
      });
      roadmaps++;

      let mPos = 0;
      for (const mod of rm.modules) {
        const moduleId = await plan.insertModule({
          organization_id: orgId,
          project_id: projectId,
          roadmap_id: roadmapId,
          name: mod.name,
          description: mod.description || null,
          position: mPos++,
          created_by: ctx.profile.id,
          updated_by: ctx.profile.id,
        });
        modules++;

        for (const feat of mod.features) {
          const key = feat.name.trim().toLowerCase();
          const dup = existing.get(key);
          if (dup && duplicateStrategy === "skip") continue;

          // Compose a rich description (module context + acceptance criteria).
          const descParts = [feat.description].filter(Boolean);
          if (feat.acceptanceCriteria.length) {
            descParts.push("Acceptance criteria:\n" + feat.acceptanceCriteria.map((a) => `- ${a}`).join("\n"));
          }
          const description = descParts.join("\n\n") || null;

          let taskId: string;
          if (dup && duplicateStrategy === "merge") {
            taskId = dup; // add checklist items to the existing task
          } else {
            taskId = await plan.insertTaskRow({
              id: crypto.randomUUID(),
              organization_id: orgId,
              project_id: projectId,
              title: feat.name,
              description,
              reporter_id: ctx.profile.id,
              status_id: targetStatus,
              roadmap_id: roadmapId,
              module_id: moduleId,
              access_roles: feat.roles ?? [],
            });
            tasks++;
            existing.set(key, taskId);
          }

          // Checklist — flatten one level of nesting: each parent (depth 0) is
          // followed by its children (depth 1), positions kept sequential.
          const checklistRows: Record<string, unknown>[] = [];
          let cPos = 0;
          for (const item of feat.checklist) {
            checklistRows.push({
              organization_id: orgId,
              task_id: taskId,
              content: item.text,
              position: cPos++,
              depth: 0,
              created_by: ctx.profile.id,
              updated_by: ctx.profile.id,
            });
            for (const child of item.children ?? []) {
              checklistRows.push({
                organization_id: orgId,
                task_id: taskId,
                content: child.text,
                position: cPos++,
                depth: 1,
                created_by: ctx.profile.id,
                updated_by: ctx.profile.id,
              });
            }
          }
          if (checklistRows.length) {
            await plan.insertChecklistItems(checklistRows);
          }

          // Attach referenced images (in order) to the task.
          for (const ref of feat.imageRefs) {
            const im = imageByIndex.get(ref);
            if (!im || !im.path.startsWith(`${orgId}/`)) continue;
            await plan.insertAttachmentAdmin({
              id: crypto.randomUUID(),
              organization_id: orgId,
              project_id: projectId,
              entity: "task",
              entity_id: taskId,
              bucket: BUCKET,
              path: im.path,
              file_name: im.fileName,
              file_type: im.fileType,
              file_size: im.fileSize,
              uploaded_by: ctx.profile.id,
            });
          }
        }
      }
    }

    await plan.updateImportJob(jobId, { status: "done", project_id: projectId });
    revalidatePath(`/projects/${projectId}/board`);
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects`);
    return actionOk({ projectId, roadmaps, modules, tasks });
  } catch (e) {
    return mapUnknownError(e);
  }
}
