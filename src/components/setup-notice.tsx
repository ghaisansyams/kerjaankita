import { Database, KeyRound, Rocket } from "lucide-react";
import { Brand } from "@/components/brand";

const steps = [
  {
    icon: Database,
    title: "Connect Neon Database",
    body: "Ensure your Neon PostgreSQL connection string is configured in DATABASE_URL and DATABASE_URL_UNPOOLED.",
  },
  {
    icon: KeyRound,
    title: "Add NextAuth Secret",
    body: "Set NEXTAUTH_SECRET and NEXTAUTH_URL in your .env.local configuration file.",
  },
  {
    icon: Rocket,
    title: "Restart & sign in",
    body: "Run npm run dev again. You can sign up with an account or use pre-configured credentials.",
  },
];

export function SetupNotice() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg">
        <Brand className="mb-8 justify-center" />
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight">
            Let&apos;s connect your database
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            KerjaanKita needs a Neon PostgreSQL connection before you can sign in:
          </p>

          <ol className="mt-6 space-y-5">
            {steps.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <step.icon className="size-4.5" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">
                    <span className="text-muted-foreground">{i + 1}.</span>{" "}
                    {step.title}
                  </p>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </main>
  );
}
