import "server-only";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

/**
 * Speech-to-Text via Groq Whisper API (or OpenAI-compatible /audio/transcriptions endpoint).
 *
 * Supported environment variables:
 * - GROQ_API_KEY: Groq API key (starts with `gsk_...`)
 * - GROQ_BASE_URL: Custom endpoint (defaults to https://api.groq.com/openai/v1)
 * - GROQ_TRANSCRIBE_MODEL: Whisper model on Groq (defaults to `whisper-large-v3-turbo`)
 *
 * Fallbacks:
 * - OPENAI_COMPATIBLE_API_KEY
 * - OPENAI_COMPATIBLE_BASE_URL
 * - OPENAI_COMPATIBLE_TRANSCRIBE_MODEL
 */

export type TranscriptionResult = {
  text: string;
  language?: string;
  segments?: unknown;
  model: string;
  provider: string;
};

function apiKey(): string {
  const groqKey = (
    process.env.GROQ_API_KEY ||
    process.env.GROQ_APIKEY ||
    process.env.GROQ_KEY ||
    process.env.OPENAI_COMPATIBLE_API_KEY ||
    process.env.OPENAI_API_KEY ||
    ""
  ).trim();
  return groqKey;
}

function baseUrl(): string {
  const customUrl = (process.env.GROQ_BASE_URL || process.env.OPENAI_COMPATIBLE_BASE_URL || "").trim();
  if (customUrl) {
    return customUrl.replace(/\/+$/, "");
  }
  return "https://api.groq.com/openai/v1";
}

function model(): string {
  return (
    process.env.GROQ_TRANSCRIBE_MODEL ||
    process.env.OPENAI_COMPATIBLE_TRANSCRIBE_MODEL ||
    "whisper-large-v3-turbo"
  );
}

function providerName(): string {
  if (process.env.GROQ_API_KEY || process.env.GROQ_APIKEY) return "groq";
  return "openai-compatible";
}

export function transcriptionConfigured(): boolean {
  return apiKey().length > 0;
}

export async function transcribeAudio(input: {
  data: Buffer;
  fileName: string;
  mimeType?: string;
  language?: string;
  prompt?: string;
}): Promise<TranscriptionResult> {
  const key = apiKey();
  if (!key) {
    throw new Error(
      "Speech-to-Text belum aktif. Pastikan variabel GROQ_API_KEY sudah diisi di .env.local server.",
    );
  }

  const selectedModel = model();
  const form = new FormData();
  const blob = new Blob([new Uint8Array(input.data)], {
    type: input.mimeType || "application/octet-stream",
  });
  form.append("file", blob, input.fileName || "audio.mp3");
  form.append("model", selectedModel);
  form.append("response_format", "verbose_json");
  form.append("temperature", "0");
  if (input.language) {
    form.append("language", input.language);
  }
  if (input.prompt) {
    form.append("prompt", input.prompt);
  }

  const url = `${baseUrl()}/audio/transcriptions`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Groq Whisper transcription failed (${res.status}): ${detail}`.slice(0, 500));
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const j = (await res.json()) as { text?: string; language?: string; segments?: unknown };
    return {
      text: (j.text ?? "").trim(),
      language: j.language,
      segments: j.segments,
      model: selectedModel,
      provider: providerName(),
    };
  }

  const text = (await res.text()).trim();
  return {
    text,
    model: selectedModel,
    provider: providerName(),
  };
}
