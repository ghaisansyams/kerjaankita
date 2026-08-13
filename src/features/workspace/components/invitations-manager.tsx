"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Send, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/utils/format";
import {
  createInvitation,
  createMemberAccount,
  revokeInvitation,
} from "@/features/invitations/actions";
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
  // "invite" hands over a link the person redeems; "create" makes the account here.
  const [mode, setMode] = useState<"invite" | "create">("invite");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  // Shown when the clipboard write fails — otherwise a failed copy leaves the
  // invitation created and the link nowhere to be found.
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);

  function copy(token: string) {
    const link = inviteLink(token);
    setLastLink(link);
    navigator.clipboard?.writeText(link).then(
      () => toast.success("Invite link copied"),
      // Clipboard access can be refused; the link is rendered below either way.
      () => toast.message("Salin linknya di bawah"),
    );
  }

  function createAccount() {
    if (!email.trim() || !fullName.trim()) return toast.error("Isi email dan nama");
    if (password.length < 8) return toast.error("Password minimal 8 karakter");
    if (!roleId) return toast.error("Choose a role");
    if (memberType === "guest" && !accountId) return toast.error("Choose the client account");
    startTransition(async () => {
      const r = await createMemberAccount({
        email: email.trim(),
        fullName: fullName.trim(),
        password,
        roleId,
        memberType,
        accountId: memberType === "guest" ? accountId : undefined,
      });
      if (r?.ok) {
        setCreatedEmail(r.data.email);
        setEmail("");
        setFullName("");
        setPassword("");
        router.refresh();
      } else {
        toast.error(r?.error.message ?? "Couldn't create the account");
      }
    });
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
          <CardTitle className="text-base">Tambah orang</CardTitle>
          <p className="text-sm text-muted-foreground">
            Member masuk ke workspace; guest hanya dapat portal read-only untuk project client-nya.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "invite" ? "default" : "outline"}
              onClick={() => setMode("invite")}
            >
              Kirim link undangan
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "create" ? "default" : "outline"}
              onClick={() => setMode("create")}
            >
              Buatkan akunnya
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {mode === "invite"
              ? "Aplikasi ini tidak mengirim email — linknya kamu yang kirim, dan orangnya harus bisa membuka inbox itu untuk konfirmasi. Link berlaku 14 hari."
              : "Kamu tentukan passwordnya. Emailnya tidak perlu inbox aktif, dan akunnya langsung bisa dipakai login."}
          </p>
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
            {mode === "create" && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="new-name">Nama</Label>
                  <Input id="new-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Budi Santoso" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-pass">Password</Label>
                  <Input id="new-pass" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 8 karakter" />
                </div>
              </>
            )}
          </div>

          {mode === "invite" ? (
            <Button onClick={invite} disabled={pending}>
              <Send className="size-4" />
              Create invite link
            </Button>
          ) : (
            <Button onClick={createAccount} disabled={pending}>
              <UserRound className="size-4" />
              {pending ? "Membuat…" : "Buat akun"}
            </Button>
          )}

          {lastLink && mode === "invite" && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Link undangan — kirim sendiri ke orangnya
              </Label>
              <Input readOnly value={lastLink} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
            </div>
          )}

          {createdEmail && mode === "create" && (
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">Akun siap dipakai</p>
              <p className="text-muted-foreground">
                {createdEmail} bisa langsung login — tanpa konfirmasi email. Kirim password yang barusan kamu buat, lalu minta dia menggantinya.
              </p>
            </div>
          )}
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
