import { AuthCard } from "@/features/auth/components/auth-card";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="dark relative flex min-h-screen items-center justify-center overflow-hidden p-6 text-foreground"
      style={{
        background:
          "radial-gradient(ellipse 90% 70% at 50% -10%, #1b1b42 0%, #0d0d22 46%, #050510 100%)",
      }}
    >
      {/* depth — floating light */}
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-28 size-[34rem] rounded-full bg-indigo-600/25 blur-[130px]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-10 size-[30rem] rounded-full bg-violet-600/20 blur-[130px]" />
      <div aria-hidden className="pointer-events-none absolute right-1/4 top-8 size-[18rem] rounded-full bg-blue-500/15 blur-[110px]" />

      {/* 3D perspective grid floor */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[42vh] [perspective:900px]">
        <div
          className="absolute inset-0 origin-bottom [transform:rotateX(72deg)]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(129,140,248,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(129,140,248,0.35) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "linear-gradient(to top, #000, transparent 75%)",
            WebkitMaskImage: "linear-gradient(to top, #000, transparent 75%)",
            opacity: 0.5,
          }}
        />
      </div>

      {/* vignette */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 45%, rgba(3,3,10,0.55) 100%)" }}
      />

      <div className="relative z-10 flex w-full justify-center">
        <AuthCard>{children}</AuthCard>
      </div>

      <p className="pointer-events-none absolute inset-x-0 bottom-5 text-center text-xs text-white/30">
        KerjaanKita — project management for IT consultancies.
      </p>
    </div>
  );
}
