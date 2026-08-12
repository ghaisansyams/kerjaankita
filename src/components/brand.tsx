import Image from "next/image";
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
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-[7%]",
        className,
      )}
    >
      <Image
        src="/brand/kerjaankita-logo.png"
        alt=""
        aria-hidden="true"
        width={256}
        height={256}
        priority
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
