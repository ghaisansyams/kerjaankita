import { Database, KeyRound, Rocket } from "lucide-react";
import { Brand } from "@/components/brand";

const steps = [
  {
    icon: Database,
    title: "Create a Supabase project",
    body: "Sign in at supabase.com and create a new project. Then open the SQL Editor and run supabase/migrations/0001_init.sql followed by 0002_storage.sql.",
  },
  {
    icon: KeyRound,
    title: "Add your keys",
    body: "Copy .env.local.example to .env.local and paste in your Project URL, anon key, and service_role key (Project Settings → API).",
  },
  {
    icon: Rocket,
    title: "Restart & sign up",
    body: "Run npm run dev again. The first account you create automatically becomes the Super Admin of the workspace.",
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
            KerjaanKita needs a Supabase project before you can sign in. Three quick
            steps:
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
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Full instructions live in{" "}
          <code className="font-mono text-foreground">supabase/README.md</code>.
        </p>
      </div>
    </main>
  );
}
