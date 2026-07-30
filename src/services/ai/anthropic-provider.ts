import "server-only";
import type { AiProvider, AnalyzeRequest } from "./types";
import { AiNotConfiguredError } from "./types";

/**
 * Anthropic (Claude) provider. Reads PDFs natively via document blocks and
 * forces structured output through tool-use. Stays dormant until
 * ANTHROPIC_API_KEY is set — `isConfigured()` gates every call, so the app
 * compiles and runs without a key and activates the moment one is added.
 */
export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";

  private get apiKey(): string {
    return process.env.ANTHROPIC_API_KEY ?? "";
  }
  private get model(): string {
    return process.env.ANTHROPIC_IMPORT_MODEL || "claude-sonnet-5";
  }

  isConfigured(): boolean {
    return this.apiKey.trim().length > 0;
  }

  async analyzeDocument(req: AnalyzeRequest): Promise<unknown> {
    if (!this.isConfigured()) throw new AiNotConfiguredError();
    // Lazily imported so the SDK never loads (or breaks) when the key is absent.
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: this.apiKey });

    const content: Array<Record<string, unknown>> = [];
    if (req.pdfBase64) {
      content.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: req.pdfBase64 },
      });
    }
    if (req.documentText) {
      content.push({ type: "text", text: req.documentText });
    }
    content.push({ type: "text", text: req.userPrompt });

    const res = await client.messages.create({
      model: this.model,
      max_tokens: 8000,
      system: req.systemPrompt,
      tools: [
        {
          name: req.toolName,
          description: "Emit the structured document analysis.",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          input_schema: req.jsonSchema as any,
        },
      ],
      tool_choice: { type: "tool", name: req.toolName },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [{ role: "user", content: content as any }],
    });

    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      throw new Error("The AI did not return structured output.");
    }
    return block.input;
  }
}
