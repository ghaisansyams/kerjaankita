import Link from "next/link";
import { getInitials, formatRelative } from "@/utils/format";
import { humanizeActivity } from "@/utils/humanize-activity";
import { notificationHref } from "@/features/notifications/constants";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type FeedItem = {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  actorName: string | null;
  actorAvatar: string | null;
  createdAt: string;
};

const noLookup = { statusName: () => null, memberName: () => null };

export function ActivityFeed({ items }: { items: FeedItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent activity</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((a) => {
              const href = notificationHref(a.entity, a.entityId);
              const line = (
                <div className="flex items-start gap-2.5">
                  <Avatar className="mt-0.5 size-6 shrink-0">
                    {a.actorAvatar && <AvatarImage src={a.actorAvatar} alt="" />}
                    <AvatarFallback className="text-[9px]">{getInitials(a.actorName)}</AvatarFallback>
                  </Avatar>
                  <p className="text-sm leading-snug text-muted-foreground">
                    <span className="font-medium text-foreground">{a.actorName ?? "Someone"}</span>{" "}
                    {humanizeActivity(a.action, a.metadata, noLookup)}
                    <span className="ml-1 text-xs">· {formatRelative(a.createdAt)}</span>
                  </p>
                </div>
              );
              return (
                <li key={a.id}>
                  {href ? (
                    <Link href={href} className="block rounded-md transition-colors hover:bg-muted/50">
                      {line}
                    </Link>
                  ) : (
                    line
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
