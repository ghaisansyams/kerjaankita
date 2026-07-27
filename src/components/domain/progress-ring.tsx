import { cn } from "@/lib/utils";

export function ProgressRing({
  value,
  size = 44,
  strokeWidth = 4,
  className,
  trackClassName,
  indicatorClassName = "text-primary",
  showLabel = true,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  trackClassName?: string;
  indicatorClassName?: string;
  showLabel?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${clamped}% complete`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={cn("text-muted", trackClassName)}
          stroke="currentColor"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("transition-[stroke-dashoffset]", indicatorClassName)}
          stroke="currentColor"
        />
      </svg>
      {showLabel && (
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-medium tabular-nums">
          {clamped}
        </span>
      )}
    </div>
  );
}
