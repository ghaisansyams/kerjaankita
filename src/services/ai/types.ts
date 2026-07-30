// Provider-agnostic AI layer. Business logic depends ONLY on these types, so
// Anthropic / OpenAI / Gemini can be swapped without touching the pipeline.

export type AiConfidence = "high" | "medium" | "low";

export type AnalyzeRequest = {
  fileName: string;
  systemPrompt: string;
  userPrompt: string;
  /** JSON Schema the provider must force the model to emit. */
  jsonSchema: Record<string, unknown>;
  toolName: string;
  /** Extracted text (used for DOCX and as a fallback for PDF). */
  documentText?: string;
  /** Raw PDF bytes (base64) — providers with native PDF vision read this. */
  pdfBase64?: string;
};

/** Thrown when no provider is configured (e.g. ANTHROPIC_API_KEY missing). */
export class AiNotConfiguredError extends Error {
  constructor(message = "AI provider is not configured.") {
    super(message);
    this.name = "AiNotConfiguredError";
  }
}

export interface AiProvider {
  readonly name: string;
  /** True only when the provider has everything it needs to run (API key, etc). */
  isConfigured(): boolean;
  /** Returns the raw structured object emitted by the model (caller validates). */
  analyzeDocument(req: AnalyzeRequest): Promise<unknown>;
}
