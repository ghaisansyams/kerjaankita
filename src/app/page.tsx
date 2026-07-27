import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { SetupNotice } from "@/components/setup-notice";

export default function Home() {
  // Before Supabase is connected, show setup instructions instead of crashing.
  if (!isSupabaseConfigured) {
    return <SetupNotice />;
  }
  // Otherwise: authenticated users go to the dashboard; middleware sends
  // unauthenticated users to /login.
  redirect("/dashboard");
}
