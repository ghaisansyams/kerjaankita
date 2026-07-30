"use client";

import { useEffect } from "react";

/**
 * Opens the print dialog only AFTER every image has loaded (with a safety
 * timeout), so screenshots are captured in the saved PDF rather than printing
 * blank. A manual button remains for re-printing.
 */
export function ReportPrintTrigger() {
  useEffect(() => {
    let printed = false;
    const go = () => {
      if (printed) return;
      printed = true;
      window.print();
    };

    const imgs = Array.from(document.images);
    if (imgs.length === 0) {
      const t = setTimeout(go, 400);
      return () => clearTimeout(t);
    }

    let settled = 0;
    const check = () => {
      settled += 1;
      if (settled >= imgs.length) go();
    };
    imgs.forEach((img) => {
      if (img.complete) check();
      else {
        img.addEventListener("load", check);
        img.addEventListener("error", check);
      }
    });

    const fallback = setTimeout(go, 12000); // print anyway if something stalls
    return () => clearTimeout(fallback);
  }, []);

  return (
    <div className="no-print">
      <button type="button" onClick={() => window.print()}>
        Print / Save as PDF
      </button>
    </div>
  );
}
