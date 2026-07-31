import "server-only";
import type { AiProvider, AnalyzeRequest } from "./types";
import { AiNotConfiguredError } from "./types";
import { renderPdfPagesAsDataUrls } from "@/services/import/render-pdf";

/**
 * Works with ANY OpenAI-compatible Chat Completions endpoint. Config comes from
 * env only; the API key is read ONLY from OPENAI_COMPATIBLE_API_KEY and never
 * hardcoded/committed.
 *
 * Document understanding chooses the best strategy transparently:
 *  - For PDFs (when vision is enabled): render every page to a high-res image
 *    and send text + page images in ONE request so the model reads layout,
 *    tables, flowcharts and hierarchy.
 *  - If the endpoint rejects image input, or rendering fails, it AUTOMATICALLY
 *    falls back to text-only. Vision is never allowed to break the import.
 * Structured output is always the same function-call JSON Schema → the caller's
 * Zod validation and Roadmap→Module→Feature→Checklist hierarchy are unchanged.
 */
export class OpenAICompatibleProvider implements AiProvider {
  readonly name = "openai-compatible";

  private get baseUrl(): string {
    return (process.env.OPENAI_COMPATIBLE_BASE_URL || "https://ai.hajid.dev/v1").replace(/\/+$/, "");
  }
  private get model(): string {
    return process.env.OPENAI_COMPATIBLE_MODEL || "ocg/glm-5.2";
  }
  private get apiKey(): string {
    return process.env.OPENAI_COMPATIBLE_API_KEY ?? "";
  }
  private get visionEnabled(): boolean {
    return (process.env.OPENAI_COMPATIBLE_VISION || "auto").trim().toLowerCase() !== "off";
  }
  private get visionMaxPages(): number {
    return Number(process.env.OPENAI_COMPATIBLE_VISION_MAX_PAGES || "20") || 20;
  }
  private get visionWidth(): number {
    return Number(process.env.OPENAI_COMPATIBLE_VISION_WIDTH || "1600") || 1600;
  }
  /** Output cap. Counts against the provider's per-minute token budget, so keep
   *  it modest on free tiers — the structured output is compact anyway. */
  private get maxTokens(): number {
    return Number(process.env.OPENAI_COMPATIBLE_MAX_TOKENS || "4000") || 4000;
  }
  /** How to force structured output. "tool" = function-calling (default); "json"
   *  = JSON mode. Some endpoints (Groq + Llama) reject forced function-calls with
   *  `tool_use_failed`, so JSON mode is the reliable path there. Either way we
   *  auto-fall back to JSON mode if function-calling fails. */
  private get structuredMode(): string {
    return (process.env.OPENAI_COMPATIBLE_STRUCTURED_MODE || "tool").trim().toLowerCase();
  }

  isConfigured(): boolean {
    return this.apiKey.trim().length > 0 && this.baseUrl.length > 0;
  }

  async analyzeDocument(req: AnalyzeRequest): Promise<unknown> {
    if (!this.isConfigured()) throw new AiNotConfiguredError();

    // Best strategy: vision for PDFs (if enabled), else text. Any vision-side
    // failure (rendering OR the endpoint rejecting images) falls back to text.
    if (this.visionEnabled && req.pdfBase64) {
      try {
        const images = await renderPdfPagesAsDataUrls(req.pdfBase64, {
          maxPages: this.visionMaxPages,
          width: this.visionWidth,
        });
        if (images.length > 0) return await this.runCompletion(req, images);
      } catch (err) {
        console.warn(
          `[ai-import] vision path unavailable, falling back to text: ${(err as Error)?.message ?? err}`,
        );
      }
    }
    return this.runCompletion(req, []);
  }

  /** One Chat Completions call. Text-only when imageDataUrls is empty; multimodal
   *  otherwise. Throws on a non-OK response so the caller can fall back.
   *
   *  When a text-only request is rejected for being too large (free-tier per-minute
   *  token limits — HTTP 413 / rate_limit on tokens), the document text is trimmed
   *  and the call is retried a couple of times. A partial import beats a hard fail;
   *  vision requests don't retry (the caller already falls back to text). */
  private async runCompletion(req: AnalyzeRequest, imageDataUrls: string[]): Promise<unknown> {
    const fullText = [req.documentText, req.userPrompt].filter(Boolean).join("\n\n");
    const canShrink = imageDataUrls.length === 0;

    let text = fullText;
    let jsonMode = this.structuredMode === "json";
    for (let attempt = 0; attempt < 8; attempt++) {
      const userContent =
        imageDataUrls.length > 0
          ? [
              { type: "text", text },
              ...imageDataUrls.map((url) => ({ type: "image_url", image_url: { url } })),
            ]
          : text;

      // JSON mode: describe the schema in the prompt and let the model return a
      // plain JSON object. Function-calling: hand the schema as a forced tool.
      const systemPrompt = jsonMode
        ? `${req.systemPrompt}\n\nRespond with ONLY a single JSON object — no prose, no markdown fences — that conforms to this JSON Schema:\n${JSON.stringify(req.jsonSchema)}`
        : req.systemPrompt;

      const body: Record<string, unknown> = {
        model: this.model,
        temperature: 0.2,
        max_tokens: req.maxTokens ?? this.maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      };
      if (jsonMode) {
        body.response_format = { type: "json_object" };
      } else {
        body.tools = [
          {
            type: "function",
            function: {
              name: req.toolName,
              description: "Emit the structured document analysis.",
              parameters: req.jsonSchema,
            },
          },
        ];
        body.tool_choice = { type: "function", function: { name: req.toolName } };
      }

      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          choices?: Array<{
            message?: { content?: string | null; tool_calls?: Array<{ function?: { arguments?: string } }> };
          }>;
        };
        const message = data.choices?.[0]?.message;
        const rawArgs = message?.tool_calls?.[0]?.function?.arguments;
        const rawContent = message?.content ?? null;
        if (rawArgs || rawContent) {
          try {
            return JSON.parse(rawArgs ?? extractJsonObject(rawContent as string));
          } catch {
            // Output was likely truncated at max_tokens → shrink the input so the
            // response is smaller, then retry. A smaller import beats none.
            if (canShrink && text.length > 6000) {
              text = text.slice(0, Math.floor(text.length * 0.6));
              continue;
            }
            throw new Error("The AI response was cut off. Try a smaller document.");
          }
        }
        if (!jsonMode) {
          jsonMode = true; // endpoint returned nothing usable via tools → try JSON mode
          continue;
        }
        throw new Error("The AI did not return structured output.");
      }

      const detail = await res.text().catch(() => "");
      // Endpoint can't honour forced function-calling (e.g. Groq + Llama) → JSON mode.
      if (!jsonMode && /tool_use_failed|failed to call a function|does not support tools|response_format/i.test(detail)) {
        jsonMode = true;
        continue;
      }
      // A SINGLE request that is itself too big (413) → drop the tail, retry
      // smaller. A cumulative per-minute rate limit (429) is NOT fixed by
      // shrinking — throw so the caller can pace/wait instead of hammering.
      const singleTooLarge = res.status === 413;
      if (singleTooLarge && canShrink && text.length > 6000) {
        text = text.slice(0, Math.floor(text.length * 0.6));
        continue;
      }
      throw new Error(`AI request failed (${res.status}): ${detail}`.slice(0, 400));
    }
    throw new Error("The AI could not process this document after several attempts.");
  }
}

/** Pull a JSON object out of a text response (strips ``` fences / prose). */
function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in the AI response.");
  }
  return candidate.slice(start, end + 1);
}
