"use client";

import { useEffect, useRef, useState } from "react";
import { Brand } from "@/components/brand";

/**
 * Centered auth card with a subtle, professional 3D feel: it tilts a few degrees
 * toward the pointer (disabled for touch / reduced-motion), sits on layered
 * shadows with a lit top bevel, and floats over the shell's depth backdrop.
 */
export function AuthCard({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    setInteractive(!reduce && fine);
  }, []);

  function onMove(e: React.MouseEvent) {
    if (!interactive || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ rx: -py * 5, ry: px * 5 });
  }

  return (
    <div className="w-full max-w-md [perspective:1400px]">
      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={() => setTilt({ rx: 0, ry: 0 })}
        style={{ transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)` }}
        className="relative transition-transform duration-300 ease-out will-change-transform"
      >
        {/* soft coloured glow cast beneath the card */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-6 inset-y-8 -z-10 rounded-[2rem] bg-indigo-600/30 blur-3xl"
        />

        <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.05] p-8 shadow-[0_40px_120px_-32px_rgba(49,46,129,0.8),0_18px_48px_-24px_rgba(0,0,0,0.85)] backdrop-blur-2xl sm:p-10">
          {/* lit top bevel */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent"
          />
          {/* faint top-down sheen */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.06] via-transparent to-transparent"
          />

          <div className="relative">
            <div className="mb-8 flex justify-center">
              <Brand className="[&_span]:text-white" />
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
