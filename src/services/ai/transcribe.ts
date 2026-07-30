import "server-only";

/**
 * Speech-to-Text via an OpenAI-compatible /audio/transcriptions endpoint
 * (Whisper-style). Reuses the same env config as the OpenAI-compatible chat
 * provider; the key is read ONLY from OPENAI_COMPATIBLE_API_KEY and never
 * hardcoded. Dormant (isConfigured=false) until the key exists.
 */

export type TranscriptionResult = {
  text: string;
  language?: string;
  segments?: unknown;
  model: string;
};

function apiKey(): string {
  return (process.env.OPENAI_COMPATIBLE_API_KEY ?? "").trim();
}
function baseUrl(): string {
  return (process.env.OPENAI_COMPATIBLE_BASE_URL || "https://ai.hajid.dev/v1").replace(/\/+$/, "");
}
function model(): string {
  return process.env.OPENAI_COMPATIBLE_TRANSCRIBE_MODEL || "whisper-1";
}

export function transcriptionConfigured(): boolean {
  return apiKey().length > 0;
}

export async function transcribeAudio(input: {
  data: Buffer;
  fileName: string;
  mimeType?: string;
}): Promise<TranscriptionResult> {
  const key = apiKey();
  if (!key) throw new Error("Transcription is not configured (missing OPENAI_COMPATIBLE_API_KEY).");

  const form = new FormData();
  const blob = new Blob([new Uint8Array(input.data)], {
    type: input.mimeType || "application/octet-stream",
  });
  form.append("file", blob, input.fileName);
  form.append("model", model());
  // Default (json) response is the most widely supported; returns { text }.

  const res = await fetch(`${baseUrl()}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` }, // let fetch set the multipart boundary
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Transcription failed (${res.status}): ${detail}`.slice(0, 400));
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const j = (await res.json()) as { text?: string; language?: string; segments?: unknown };
    return { text: (j.text ?? "").trim(), language: j.language, segments: j.segments, model: model() };
  }
  const text = (await res.text()).trim();
  return { text, model: model() };
}
