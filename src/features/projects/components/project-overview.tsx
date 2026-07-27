import { Building2, CalendarRange, Clock, Eye } from "lucide-react";
import { formatDate, getInitials } from "@/utils/format";
import { PROJECT_VISIBILITY_LABELS } from "@/constants";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProjectDetail } from "@/repositories/project.repository";

export function ProjectOverview({ project }: { project: ProjectDetail }) {
  const meta = [
    { icon: Building2, label: "Client", value: project.account?.name ?? "Internal" },
    {
      icon: CalendarRange,
      label: "Timeline",
      value:
        project.start_date || project.end_date
          ? `${formatDate(project.start_date)} → ${formatDate(project.end_date)}`
          : "Not scheduled",
    },
    { icon: Eye, label: "Visibility", value: PROJECT_VISIBILITY_LABELS[project.visibility] },
    { icon: Clock, label: "Created", value: formatDate(project.created_at) },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Overview</CardTitle>
        </CardHeader>
        <CardContent>
          {project.description ? (
            <p className="max-w-prose whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {project.description}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No description yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-8">
              {project.owner?.avatar_url && (
                <AvatarImage src={project.owner.avatar_url} alt="" />
              )}
              <AvatarFallback className="text-xs">
                {getInitials(project.owner?.full_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xs text-muted-foreground">Owner</p>
              <p className="text-sm font-medium">
                {project.owner?.full_name ?? "Unassigned"}
              </p>
            </div>
          </div>

          {meta.map((m) => (
            <div key={m.label} className="flex items-start gap-3">
              <m.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-sm">{m.value}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
