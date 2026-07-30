"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Gauge, RefreshCw } from "lucide-react";
import { aiProviderUsage } from "../ai-actions";
import type { AiUsage } from "@/services/ai/usage";
import { cn } from "@/lib/utils";

function fmt(n: number) {
  return n.toLocaleString("id-ID");
}
function fmtReset(sec: number) {
  if (sec <= 0) return "siap";
  if (sec < 60) return `${sec} dtk`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} mnt ${s} dtk` : `${m} mnt`;
}

/**
 * Live free-tier quota for Groq: how many tokens/minute and requests/day are
 * left, and when they refill — so the user knows if an import will go through.
 */
export function GroqUsagePanel() {
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokReset, setTokReset] = useState(0);
  const [reqReset, setReqReset] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await aiProviderUsage();
    if (res?.ok) {
      setUsage(res.data);
      setTokReset(res.data.tokens?.resetSeconds ?? 0);
      setReqReset(res.data.requests?.resetSeconds ?? 0);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    timer.current = setInterval(() => {
      setTokReset((s) => (s > 0 ? s - 1 : 0));
      setReqReset((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  if (!loading && usage && !usage.configured) return null; // nothing to show if AI is off

  const tok = usage?.tokens;
  const req = usage?.requests;
  const tokPct = tok ? Math.min(100, Math.round((tok.used / Math.max(1, tok.limit)) * 100)) : 0;
  const low = tok ? tok.remaining / Math.max(1, tok.limit) < 0.15 : false;

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-medium">
          <Gauge className="size-3.5 text-primary" /> Kuota Groq (gratis)
        </span>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          aria-label="Perbarui kuota"
        >
          <RefreshCw className={cn("size-3", loading && "animate-spin")} /> Perbarui
        </button>
      </div>

      {usage?.error ? (
        <p className="text-muted-foreground">Kuota tidak terbaca ({usage.error}).</p>
      ) : loading && !usage ? (
        <p className="text-muted-foreground">Membaca kuota…</p>
      ) : (
        <>
          {tok && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Token / menit</span>
                <span className="tabular-nums text-muted-foreground">
                  reset {fmtReset(tokReset)}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", low ? "bg-rose-500" : "bg-emerald-500")}
                  style={{ width: `${tokPct}%` }}
                />
              </div>
              <div className="flex justify-between tabular-nums text-muted-foreground">
                <span>terpakai {fmt(tok.used)}</span>
                <span>
                  sisa <span className={cn("font-medium", low ? "text-rose-600" : "text-foreground")}>{fmt(tok.remaining)}</span> / {fmt(tok.limit)}
                </span>
              </div>
            </div>
          )}

          {req && (
            <div className="flex items-center justify-between border-t pt-1.5 tabular-nums text-muted-foreground">
              <span>Permintaan / hari</span>
              <span>
                sisa <span className="font-medium text-foreground">{fmt(req.remaining)}</span> / {fmt(req.limit)}
                <span className="ml-1.5 opacity-70">reset {fmtReset(reqReset)}</span>
              </span>
            </div>
          )}

          {low && (
            <p className="text-rose-600 dark:text-rose-400">
              Token menipis — tunggu ~{fmtReset(tokReset)} sampai kuota terisi lagi sebelum impor dokumen besar.
            </p>
          )}
        </>
      )}
    </div>
  );
}
