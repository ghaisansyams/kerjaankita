"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Copy, MoreHorizontal, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { ClientAccountRow } from "@/repositories/account.repository";
import {
  createPortalUser,
  createClientAccount,
  deleteClientAccount,
  inviteClientContact,
  updateClientAccount,
} from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type FormState = {
  id?: string;
  name: string;
  code: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  notes: string;
};
const EMPTY: FormState = { name: "", code: "", email: "", phone: "", website: "", address: "", notes: "" };

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </Label>
      {children}
    </div>
  );
}

export function ClientsManager({ accounts, canInvite }: { accounts: ClientAccountRow[]; canInvite: boolean }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClientAccountRow | null>(null);
  const [inviteFor, setInviteFor] = useState<ClientAccountRow | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  // "invite" hands the client a link to redeem; "create" makes the login here.
  const [inviteMode, setInviteMode] = useState<"invite" | "create">("invite");
  const [inviteName, setInviteName] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);

  const isEdit = Boolean(form.id);

  function openCreate() {
    setForm(EMPTY);
    setFormOpen(true);
  }
  function openEdit(a: ClientAccountRow) {
    setForm({
      id: a.id,
      name: a.name,
      code: a.code ?? "",
      email: a.email ?? "",
      phone: a.phone ?? "",
      website: a.website ?? "",
      address: a.address ?? "",
      notes: a.notes ?? "",
    });
    setFormOpen(true);
  }
  function openInvite(a: ClientAccountRow) {
    setInviteFor(a);
    setInviteEmail(a.email ?? "");
    setInviteLink(null);
  }

  async function submitForm() {
    if (form.name.trim().length < 2) {
      toast.error("Client name is required.");
      return;
    }
    setBusy(true);
    const res = isEdit ? await updateClientAccount(form) : await createClientAccount(form);
    setBusy(false);
    if (!res?.ok) {
      toast.error(res?.error.message ?? "Couldn't save the client.");
      return;
    }
    toast.success(isEdit ? "Client updated" : "Client created");
    setFormOpen(false);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    const res = await deleteClientAccount({ id: deleteTarget.id });
    setBusy(false);
    setDeleteTarget(null);
    if (!res?.ok) {
      toast.error(res?.error.message ?? "Couldn't delete the client.");
      return;
    }
    toast.success("Client deleted");
    router.refresh();
  }

  async function sendInvite() {
    if (!inviteFor) return;
    setBusy(true);
    const res = await inviteClientContact({ accountId: inviteFor.id, email: inviteEmail });
    setBusy(false);
    if (!res?.ok) {
      toast.error(res?.error.message ?? "Couldn't create the invite.");
      return;
    }
    setInviteLink(`${window.location.origin}/invite/${res.data.token}`);
    toast.success("Invite link created");
    router.refresh();
  }

  async function createAccount() {
    if (!inviteFor) return;
    setBusy(true);
    const res = await createPortalUser({
      accountId: inviteFor.id,
      email: inviteEmail.trim(),
      password: invitePassword,
      fullName: inviteName.trim(),
    });
    setBusy(false);
    if (!res?.ok) {
      toast.error(res?.error.message ?? "Couldn't create the account.");
      return;
    }
    setCreatedEmail(res.data.email);
    toast.success("Portal account created");
    router.refresh();
  }

  function closeInvite() {
    setInviteFor(null);
    setTimeout(() => {
      setInviteLink(null);
      setCreatedEmail(null);
      setInviteEmail("");
      setInviteName("");
      setInvitePassword("");
      setInviteMode("invite");
    }, 200);
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {accounts.length} client{accounts.length === 1 ? "" : "s"}
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" /> New client
        </Button>
      </div>

      {accounts.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <Building2 className="size-8 text-muted-foreground/40" />
          <div>
            <p className="font-medium">No clients yet</p>
            <p className="text-sm text-muted-foreground">
              Add a client, link it to a project, then invite them to the portal.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={openCreate}>
            <Plus className="size-4" /> New client
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => (
            <Card key={a.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 font-semibold text-primary">
                    {a.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium leading-tight">{a.name}</p>
                    {a.code && <p className="font-mono text-[11px] text-muted-foreground">{a.code}</p>}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" aria-label="Client options">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => openEdit(a)}>
                      <Pencil className="size-4" /> Edit
                    </DropdownMenuItem>
                    {canInvite && (
                      <DropdownMenuItem onSelect={() => openInvite(a)}>
                        <UserPlus className="size-4" /> Invite to portal
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(a)}>
                      <Trash2 className="size-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {(a.email || a.phone) && (
                <p className="truncate text-sm text-muted-foreground">
                  {[a.email, a.phone].filter(Boolean).join(" · ")}
                </p>
              )}

              <div className="mt-auto flex flex-wrap gap-1.5 text-xs">
                <span className="rounded-full bg-muted px-2 py-0.5 tabular-nums">
                  {a.projects.length} project{a.projects.length === 1 ? "" : "s"}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 tabular-nums">
                  {a.contactCount} portal user{a.contactCount === 1 ? "" : "s"}
                </span>
              </div>
              {a.projects.length > 0 && (
                <p className="truncate text-xs text-muted-foreground">{a.projects.map((p) => p.name).join(", ")}</p>
              )}
              {canInvite && (
                <Button variant="outline" size="sm" className="mt-1" onClick={() => openInvite(a)}>
                  <UserPlus className="size-4" /> Invite to portal
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit client" : "New client"}</DialogTitle>
            <DialogDescription>
              Client details. Link this client to a project from the project&apos;s settings.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Name" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="PT Klien Anda" maxLength={120} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Code">
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="ACME" maxLength={20} />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="hello@client.com" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="Website">
                <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="client.com" />
              </Field>
            </div>
            <Field label="Address">
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label="Notes">
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submitForm} disabled={busy}>
              {isEdit ? "Save changes" : "Create client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Portal access: hand over a link, or create the login outright */}
      <Dialog open={Boolean(inviteFor)} onOpenChange={(o) => !o && closeInvite()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Portal access for {inviteFor?.name}</DialogTitle>
            <DialogDescription>
              Read-only access to this client&apos;s projects.
            </DialogDescription>
          </DialogHeader>

          {inviteLink ? (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Share this link — the app does not email it. Expires in 14 days.
              </Label>
              <div className="flex gap-2">
                <Input readOnly value={inviteLink} className="font-mono text-xs" />
                <Button
                  size="icon"
                  variant="outline"
                  aria-label="Copy link"
                  onClick={() => {
                    navigator.clipboard?.writeText(inviteLink);
                    toast.success("Copied");
                  }}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
          ) : createdEmail ? (
            <div className="space-y-2 rounded-lg border p-3 text-sm">
              <p className="font-medium">Account ready</p>
              <p className="text-muted-foreground">
                {createdEmail} can sign in now — no email confirmation needed. Send
                them the password you just set and ask them to change it.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={inviteMode === "invite" ? "default" : "outline"}
                  onClick={() => setInviteMode("invite")}
                >
                  Kirim link undangan
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={inviteMode === "create" ? "default" : "outline"}
                  onClick={() => setInviteMode("create")}
                >
                  Buatkan akunnya
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                {inviteMode === "invite"
                  ? "Client mendaftar sendiri dan harus bisa membuka inbox email itu untuk konfirmasi."
                  : "Kamu yang menentukan passwordnya. Emailnya tidak perlu inbox aktif."}
              </p>

              <Field label="Client email">
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="client@company.com"
                />
              </Field>

              {inviteMode === "create" && (
                <>
                  <Field label="Nama">
                    <Input
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="Azam"
                    />
                  </Field>
                  <Field label="Password">
                    <Input
                      type="text"
                      value={invitePassword}
                      onChange={(e) => setInvitePassword(e.target.value)}
                      placeholder="Minimal 8 karakter"
                    />
                  </Field>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            {inviteLink || createdEmail ? (
              <Button onClick={closeInvite}>Done</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={closeInvite} disabled={busy}>
                  Cancel
                </Button>
                {inviteMode === "invite" ? (
                  <Button onClick={sendInvite} disabled={busy || !inviteEmail.trim()}>
                    Create invite link
                  </Button>
                ) : (
                  <Button
                    onClick={createAccount}
                    disabled={
                      busy ||
                      !inviteEmail.trim() ||
                      !inviteName.trim() ||
                      invitePassword.length < 8
                    }
                  >
                    {busy ? "Membuat…" : "Buat akun"}
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The client is removed and no longer selectable on projects. Projects and tasks are not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={busy}
              className="bg-rose-600 text-white hover:bg-rose-600/90 focus-visible:ring-rose-600/30"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
