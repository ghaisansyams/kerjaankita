import "server-only";
import type { AiProvider } from "./types";
import { AnthropicProvider } from "./anthropic-provider";
import { OpenAICompatibleProvider } from "./openai-compatible-provider";

export * from "./types";

// Provider registry keyed by the value of AI_PROVIDER. Add new vendors here by
// implementing AiProvider — no pipeline/business-logic changes required.
const registry: Record<string, AiProvider> = {
  anthropic: new AnthropicProvider(),
  "openai-compatible": new OpenAICompatibleProvider(),
};

/**
 * Resolve the active provider:
 * - AI_PROVIDER set → that provider is authoritative (returns it only if it has
 *   credentials, else null so the UI shows a clear "needs key" state).
 * - AI_PROVIDER unset → first provider that is configured (backward compatible).
 */
export function getAiProvider(): AiProvider | null {
  const selected = (process.env.AI_PROVIDER || "").trim().toLowerCase();
  if (selected) {
    const provider = registry[selected];
    return provider && provider.isConfigured() ? provider : null;
  }
  return Object.values(registry).find((p) => p.isConfigured()) ?? null;
}

/** Whether AI import is operational right now (selected provider has a key). */
export function aiImportEnabled(): boolean {
  return getAiProvider() !== null;
}

/** Names of all registered providers (for diagnostics / settings UI). */
export function registeredProviders(): string[] {
  return Object.keys(registry);
}
