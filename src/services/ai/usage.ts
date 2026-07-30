import "server-only";

/**
 * Live rate-limit / usage snapshot for the OpenAI-compatible provider (Groq et al).
 * Read straight from the standard `x-ratelimit-*` response headers so the app can
 * tell the user how much of the free budget is left and when it refills.
 */
export type AiUsageBucket = {
  limit: number;
  remaining: number;
  used: number;
  /** Seconds until this bucket refills. */
  resetSeconds: number;
};

export type AiUsage = {
  configured: boolean;
  provider: string;
  model: string;
  /** Tokens-per-minute budget. */
  tokens?: AiUsageBucket;
  /** Requests budget (per day on Groq's free tier). */
  requests?: AiUsageBucket;
  error?: string;
};

/** Parse Groq reset strings ("185ms", "7.66s", "4m19.2s", "1h2m3s") to seconds. */
function parseResetToSeconds(v: string | null): number {
  if (!v) return 0;
  const s = v.trim();
  const ms = s.match(/^([\d.]+)ms$/);
  if (ms) return Math.max(0, Math.round(parseFloat(ms[1]) / 1000));
  let total = 0;
  const h = s.match(/([\d.]+)h/);
  const m = s.match(/([\d.]+)m(?!s)/);
  const sec = s.match(/([\d.]+)s/);
  if (h) total += parseFloat(h[1]) * 3600;
  if (m) total += parseFloat(m[1]) * 60;
  if (sec) total += parseFloat(sec[1]);
  return Math.round(total);
}

function bucket(limit: number, remaining: number, reset: string | null): AiUsageBucket | undefined {
  if (!Number.isFinite(limit) || !Number.isFinite(remaining)) return undefined;
  return {
    limit,
    remaining,
    used: Math.max(0, limit - remaining),
    resetSeconds: parseResetToSeconds(reset),
  };
}

/** Probe the endpoint with a 1-token request and read its rate-limit headers. */
export async function getOpenAICompatibleUsage(): Promise<AiUsage> {
  const baseUrl = (process.env.OPENAI_COMPATIBLE_BASE_URL || "https://ai.hajid.dev/v1").replace(/\/+$/, "");
  const model = process.env.OPENAI_COMPATIBLE_MODEL || "ocg/glm-5.2";
  const apiKey = process.env.OPENAI_COMPATIBLE_API_KEY ?? "";
  if (!apiKey) return { configured: false, provider: "openai-compatible", model };

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
    });
    const h = res.headers;
    const out: AiUsage = { configured: true, provider: "openai-compatible", model };
    out.tokens = bucket(
      Number(h.get("x-ratelimit-limit-tokens")),
      Number(h.get("x-ratelimit-remaining-tokens")),
      h.get("x-ratelimit-reset-tokens"),
    );
    out.requests = bucket(
      Number(h.get("x-ratelimit-limit-requests")),
      Number(h.get("x-ratelimit-remaining-requests")),
      h.get("x-ratelimit-reset-requests"),
    );
    // Drain the body so the connection is released; ignore its contents.
    await res.text().catch(() => "");
    if (!out.tokens && !out.requests) out.error = `No rate-limit headers (HTTP ${res.status}).`;
    return out;
  } catch (e) {
    return { configured: true, provider: "openai-compatible", model, error: (e as Error)?.message ?? "error" };
  }
}
