import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="url(#fd-logo)" />
      <rect x="8" y="9.5" width="16" height="2.5" rx="1.25" fill="white" />
      <rect x="8" y="14.75" width="12" height="2.5" rx="1.25" fill="white" fillOpacity="0.85" />
      <rect x="8" y="20" width="8" height="2.5" rx="1.25" fill="white" fillOpacity="0.65" />
      <defs>
        <linearGradient id="fd-logo" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="1" stopColor="#4338CA" />
        </linearGradient>
      </defs>
    </svg>
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
        <span className="text-lg font-semibold tracking-tight">FlowDesk</span>
      )}
    </div>
  );
}
