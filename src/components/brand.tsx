import { cn } from "@/lib/utils";

/**
 * The KerjaanKita mark. Sized by the caller through className, as the old
 * inline SVG was — every surface that showed the logo keeps working unchanged.
 *
 * The artwork is a dark purple K on transparency, which measures 1.76:1 against
 * the dark sidebar — invisible in practice. So it sits on a white tile, the way
 * the mark it replaced carried its own filled background. On the light theme
 * the tile matches the surface and reads as the K alone.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        // Fixed padding, not a percentage: percentage padding resolves against
        // the containing block's width, not this box's. In the sidebar that
        // parent is ~200px wide, so 7% ate the whole 28px tile and squeezed the
        // mark to nothing — a white square with nothing in it.
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-0.5",
        className,
      )}
    >
      {/* Plain img, not next/image: /_next/image hangs for this asset in
          production, which left the tile rendering blank. Optimising a 24KB
          mark shown at 28px buys nothing anyway, and this can't fail that way. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/kerjaankita-logo.png"
        alt=""
        aria-hidden="true"
        width={256}
        height={256}
        className="h-full w-full object-contain"
      />
    </span>
  );
}

export function Brand({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Logo className="h-8 w-8" />
      {showWordmark && (
        <span className="text-lg font-semibold tracking-tight">KerjaanKita</span>
      )}
    </div>
  );
}
