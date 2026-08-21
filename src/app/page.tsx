import { redirect } from "next/navigation";
import { isDatabaseConfigured } from "@/lib/env";
import { SetupNotice } from "@/components/setup-notice";

export default function Home() {
  if (!isDatabaseConfigured) {
    return <SetupNotice />;
  }
  redirect("/dashboard");
}
