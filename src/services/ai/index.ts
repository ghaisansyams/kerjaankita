import "server-only";
import type { AiProvider } from "./types";
import { AnthropicProvider } from "./anthropic-provider";

export * from "./types";

// Provider registry. To add OpenAI / Gemini later, implement AiProvider and
// push an instance here — no pipeline code changes.
const providers: AiProvider[] = [new AnthropicProvider()];

/** The first configured provider, or null when none has credentials. */
export function getAiProvider(): AiProvider | null {
  return providers.find((p) => p.isConfigured()) ?? null;
}

/** Whether AI import is operational right now (a provider has a key). */
export function aiImportEnabled(): boolean {
  return getAiProvider() !== null;
}

/** Names of all registered providers (for diagnostics / settings UI). */
export function registeredProviders(): string[] {
  return providers.map((p) => p.name);
}
