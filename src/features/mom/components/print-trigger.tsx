"use client";

import { useEffect } from "react";

/** Opens the browser print dialog on load; a visible fallback button stays for manual re-print. */
export function PrintTrigger() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="no-print">
      <button type="button" onClick={() => window.print()}>
        Print / Save as PDF
      </button>
    </div>
  );
}
