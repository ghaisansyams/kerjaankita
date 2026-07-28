import { CheckCircle2 } from "lucide-react";
import { Brand } from "@/components/brand";

const highlights = [
  "See what every developer is working on — today and tomorrow.",
  "Clients watch real progress instead of asking on WhatsApp.",
  "Know instantly if a project is on track, at risk, or delayed.",
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand / value panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-slate-950 p-10 text-slate-100 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 size-96 rounded-full bg-indigo-600/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 right-0 size-96 rounded-full bg-blue-600/20 blur-3xl"
        />

        <div className="relative">
          <Brand className="[&_span]:text-white" />
        </div>

        <div className="relative space-y-8">
          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">
            One workspace for your whole delivery team.
          </h2>
          <ul className="space-y-3.5">
            {highlights.map((line) => (
              <li key={line} className="flex items-start gap-3 text-slate-300">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-indigo-400" />
                <span className="text-sm leading-relaxed">{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-500">
          KerjaanKita — project management for IT consultancies.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-col items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Brand />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
