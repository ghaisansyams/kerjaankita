import "server-only";
import type { AiProvider, AnalyzeRequest } from "./types";
import { AiNotConfiguredError } from "./types";

/**
 * Works with ANY OpenAI-compatible Chat Completions endpoint (our internal
 * service, OpenAI, Together, vLLM, etc.). Everything comes from env — nothing
 * is hardcoded except non-secret fallbacks for base URL / model. The API key is
 * read ONLY from OPENAI_COMPATIBLE_API_KEY and never committed.
 *
 * Structured output uses function-calling (same JSON Schema the AnthropicProvider
 * uses), with a plain-JSON-content fallback for endpoints that don't force tools,
 * so the caller/parser sees the identical validated shape either way.
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

  isConfigured(): boolean {
    return this.apiKey.trim().length > 0 && this.baseUrl.length > 0;
  }

  async analyzeDocument(req: AnalyzeRequest): Promise<unknown> {
    if (!this.isConfigured()) throw new AiNotConfiguredError();

    const userText = [req.documentText, req.userPrompt].filter(Boolean).join("\n\n");
    const body = {
      model: this.model,
      temperature: 0.2,
      max_tokens: 8000,
      messages: [
        { role: "system", content: req.systemPrompt },
        { role: "user", content: userText },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: req.toolName,
            description: "Emit the structured document analysis.",
            parameters: req.jsonSchema,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: req.toolName } },
    };

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`AI request failed (${res.status}): ${detail}`.slice(0, 400));
    }

    const data = (await res.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{ function?: { arguments?: string } }>;
        };
      }>;
    };
    const message = data.choices?.[0]?.message;
    const args = message?.tool_calls?.[0]?.function?.arguments;

    if (args) return JSON.parse(args);
    if (message?.content) return JSON.parse(extractJsonObject(message.content));
    throw new Error("The AI did not return structured output.");
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
