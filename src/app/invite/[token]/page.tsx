import type { Metadata } from "next";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { getInvitationByToken } from "@/repositories/invitation.repository";
import { MEMBER_TYPE_LABELS, type MemberType } from "@/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AcceptInvite } from "@/features/invitations/components/accept-invite";

export const metadata: Metadata = { title: "Invitation" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invite, user] = await Promise.all([getInvitationByToken(token), getUser()]);

  const expired = invite ? new Date(invite.expires_at) < new Date() : false;
  const invalid = !invite || invite.status === "revoked" || expired;

  return (
    <div className="grid min-h-dvh place-items-center bg-muted/20 p-4">
      <Card className="w-full max-w-md">
        {invalid ? (
          <CardContent className="space-y-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {expired
                ? "This invitation has expired. Please ask for a new link."
                : "This invitation link is invalid or has been revoked."}
            </p>
            <Button asChild variant="outline">
              <Link href="/login">Go to sign in</Link>
            </Button>
          </CardContent>
        ) : invite!.status === "accepted" ? (
          <CardContent className="space-y-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">This invitation has already been accepted.</p>
            <Button asChild>
              <Link href="/dashboard">Open FlowDesk</Link>
            </Button>
          </CardContent>
        ) : (
          <>
            <CardHeader className="text-center">
              <CardTitle>You&apos;re invited</CardTitle>
              <p className="text-sm text-muted-foreground">
                Join <span className="font-medium text-foreground">{invite!.organization?.name}</span> as a{" "}
                {MEMBER_TYPE_LABELS[invite!.member_type as MemberType].toLowerCase()}
                {invite!.role?.name ? ` (${invite!.role.name})` : ""}.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {user ? (
                <AcceptInvite token={token} />
              ) : (
                <>
                  <p className="text-center text-sm text-muted-foreground">
                    Sign in or create an account to accept.
                  </p>
                  <Button asChild className="w-full">
                    <Link href={`/login?redirectTo=/invite/${token}`}>Sign in</Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/register?redirectTo=/invite/${token}`}>Create account</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
