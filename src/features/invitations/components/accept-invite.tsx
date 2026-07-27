"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { acceptInvitation } from "../actions";
import { Button } from "@/components/ui/button";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function accept() {
    startTransition(async () => {
      const r = await acceptInvitation({ token });
      if (r?.ok) {
        toast.success("Invitation accepted");
        router.push(r.data.isGuest ? "/portal" : "/dashboard");
      } else {
        toast.error(r?.error.message ?? "Couldn't accept the invitation");
      }
    });
  }

  return (
    <Button className="w-full" onClick={accept} disabled={pending}>
      {pending ? "Joining…" : "Accept invitation"}
    </Button>
  );
}
