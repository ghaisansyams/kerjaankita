"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Send, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/utils/format";
import { createInvitation, revokeInvitation } from "@/features/invitations/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Option = { id: string; name: string };
type InvitationVM = {
  id: string;
  email: string;
  memberType: string;
  status: string;
  expiresAt: string;
  token: string;
  roleName: string | null;
  accountName: string | null;
};
type GuestVM = { id: string; name: string; email: string | null; accountName: string | null };

function inviteLink(token: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/invite/${token}`;
}

export function InvitationsManager({
  roles,
  accounts,
  invitations,
  guests,
}: {
  roles: Option[];
  accounts: Option[];
  invitations: InvitationVM[];
  guests: GuestVM[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [memberType, setMemberType] = useState<"member" | "guest">("member");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [accountId, setAccountId] = useState("");

  function copy(token: string) {
    navigator.clipboard?.writeText(inviteLink(token)).then(
      () => toast.success("Invite link copied"),
      () => toast.error("Couldn't copy"),
    );
  }

  function invite() {
    if (!email.trim()) return toast.error("Enter an email");
    if (!roleId) return toast.error("Choose a role");
    if (memberType === "guest" && !accountId) return toast.error("Choose the client account");
    startTransition(async () => {
      const r = await createInvitation({
        email: email.trim(),
        memberType,
        roleId,
        accountId: memberType === "guest" ? accountId : undefined,
      });
      if (r?.ok) {
        copy(r.data.token);
        setEmail("");
        setAccountId("");
        router.refresh();
      } else {
        toast.error(r?.error.message ?? "Couldn't create invitation");
      }
    });
  }

  function revoke(id: string) {
    startTransition(async () => {
      const r = await revokeInvitation({ id });
      if (r?.ok) router.refresh();
      else toast.error(r?.error.message ?? "Couldn't revoke");
    });
  }

  const pendingInvites = invitations.filter((i) => i.status === "pending");

  return (
    <div className="space-y-6">
      {/* Invite form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite someone</CardTitle>
          <p className="text-sm text-muted-foreground">
            Members join the workspace; guests get read-only portal access to their account&apos;s projects. Links expire in 14 days.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@company.com" />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={memberType} onValueChange={(v) => setMemberType(v as "member" | "guest")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="guest">Guest (client)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {memberType === "guest" && (
              <div className="space-y-1">
                <Label>Client account</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger><SelectValue placeholder="Select an account" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <Button onClick={invite} disabled={pending}>
            <Send className="size-4" />
            Create invite link
          </Button>
        </CardContent>
      </Card>

      {/* Pending invitations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending invitations</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingInvites.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No pending invitations.</p>
          ) : (
            <ul className="divide-y">
              {pendingInvites.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{i.email}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {i.memberType === "guest" ? "Guest" : "Member"}
                      {i.roleName ? ` · ${i.roleName}` : ""}
                      {i.accountName ? ` · ${i.accountName}` : ""} · expires {formatDate(i.expiresAt, "MMM d")}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="size-8" aria-label="Copy link" onClick={() => copy(i.token)} disabled={pending}>
                    <Copy className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" aria-label="Revoke" onClick={() => revoke(i.id)} disabled={pending}>
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Guests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Guests</CardTitle>
          <p className="text-sm text-muted-foreground">Clients with read-only portal access.</p>
        </CardHeader>
        <CardContent>
          {guests.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No guests yet.</p>
          ) : (
            <ul className="divide-y">
              {guests.map((g) => (
                <li key={g.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <UserRound className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{g.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {g.email}
                      {g.accountName ? ` · ${g.accountName}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
