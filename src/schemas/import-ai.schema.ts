import { z } from "zod";

export const CONFIDENCE = ["high", "medium", "low"] as const;
export const DUPLICATE_STRATEGY = ["skip", "merge", "duplicate"] as const;

// ---------------------------------------------------------------------------
// Validated shape of the model's output (Project → Roadmap → Module → Feature
// → Checklist). Every level carries a confidence score.
// ---------------------------------------------------------------------------
export const aiChecklistItemSchema = z.object({
  text: z.string().trim().min(1).max(500),
  confidence: z.enum(CONFIDENCE).catch("medium"),
});

export const aiFeatureSchema = z.object({
  name: z.string().trim().min(1).max(300),
  description: z.string().max(3000).optional().default(""),
  acceptanceCriteria: z.array(z.string().max(500)).max(60).optional().default([]),
  checklist: z.array(aiChecklistItemSchema).max(300).optional().default([]),
  imageRefs: z.array(z.number().int().nonnegative()).max(80).optional().default([]),
  tableRefs: z.array(z.number().int().nonnegative()).max(80).optional().default([]),
  confidence: z.enum(CONFIDENCE).catch("medium"),
});

export const aiModuleSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(3000).optional().default(""),
  features: z.array(aiFeatureSchema).max(400).optional().default([]),
  confidence: z.enum(CONFIDENCE).catch("medium"),
});

export const aiRoadmapSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(3000).optional().default(""),
  modules: z.array(aiModuleSchema).max(200).optional().default([]),
  confidence: z.enum(CONFIDENCE).catch("medium"),
});

export const aiAnalysisSchema = z.object({
  documentType: z.string().max(120).optional().default("unknown"),
  roles: z.array(z.string().trim().max(120)).max(60).optional().default([]),
  roadmaps: z.array(aiRoadmapSchema).min(1).max(60),
  overallConfidence: z.enum(CONFIDENCE).catch("medium"),
  summary: z.string().max(3000).optional().default(""),
});

export type AiAnalysis = z.infer<typeof aiAnalysisSchema>;
export type AiFeature = z.infer<typeof aiFeatureSchema>;

// ---------------------------------------------------------------------------
// JSON Schema handed to the model as a tool input_schema. Kept in step with the
// Zod schema above (Zod is the source of truth for validation).
// ---------------------------------------------------------------------------
const conf = { type: "string", enum: [...CONFIDENCE] };
export const AI_ANALYSIS_TOOL_NAME = "emit_project_analysis";
export const AI_ANALYSIS_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    documentType: {
      type: "string",
      description:
        "One of: progress_report, software_requirement_spec, feature_spec, functional_spec, project_scope, meeting_minutes, client_requirements, other.",
    },
    roles: { type: "array", items: { type: "string" }, description: "Distinct user roles mentioned." },
    overallConfidence: conf,
    summary: { type: "string", description: "1-2 sentence summary of the document." },
    roadmaps: {
      type: "array",
      description: "Level 1: planning groups (phases/tracks like Backend, Frontend, Mobile, or Phase 1/2/3).",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          confidence: conf,
          modules: {
            type: "array",
            description: "Level 2: functional modules (Authentication, Dashboard, Auction, Payments…).",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                confidence: conf,
                features: {
                  type: "array",
                  description: "Level 3: features. Each becomes ONE task.",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      description: { type: "string" },
                      acceptanceCriteria: { type: "array", items: { type: "string" } },
                      checklist: {
                        type: "array",
                        description: "Level 4: checklist items inside the task.",
                        items: {
                          type: "object",
                          properties: { text: { type: "string" }, confidence: conf },
                          required: ["text"],
                        },
                      },
                      imageRefs: {
                        type: "array",
                        items: { type: "integer" },
                        description: "Indices of [IMAGE n] placeholders belonging to this feature.",
                      },
                      tableRefs: { type: "array", items: { type: "integer" } },
                      confidence: conf,
                    },
                    required: ["name"],
                  },
                },
              },
              required: ["name"],
            },
          },
        },
        required: ["name"],
      },
    },
  },
  required: ["roadmaps"],
};

// ---------------------------------------------------------------------------
// Actions I/O
// ---------------------------------------------------------------------------
export const analyzeImportSchema = z.object({
  bucket: z.string().min(1).max(100),
  path: z.string().min(1).max(1000),
  fileName: z.string().trim().min(1).max(255),
  fileType: z.string().max(255).optional().default(""),
});

export const importJobIdSchema = z.object({ jobId: z.string().uuid() });

export const commitAiImportSchema = z.object({
  jobId: z.string().uuid(),
  projectName: z.string().trim().min(1).max(200).optional(),
  projectId: z.string().uuid().optional(),
  statusId: z.string().uuid().nullable().optional(),
  duplicateStrategy: z.enum(DUPLICATE_STRATEGY).catch("duplicate"),
  // The (possibly edited) hierarchy from the preview.
  analysis: aiAnalysisSchema,
});

export type CommitAiImportInput = z.infer<typeof commitAiImportSchema>;
