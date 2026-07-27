import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { formatDate, getInitials } from "@/utils/format";
import type { ProjectHealth } from "@/constants";
import { HealthBadge } from "./health-badge";
import { ProgressRing } from "./progress-ring";

/** View-model consumed by the card (built by the feature from a repo row + BR-5). */
export type ProjectCardVM = {
  id: string;
  name: string;
  key: string | null;
  color: string;
  accountName: string | null;
  ownerName: string | null;
  ownerAvatar: string | null;
  progress: number;
  health: ProjectHealth;
  endDate: string | null;
  isArchived: boolean;
};

export function ProjectCard({ project }: { project: ProjectCardVM }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block rounded-xl focus-visible:outline-none"
    >
      <Card className="relative overflow-hidden p-5 transition-colors group-hover:border-primary/30 group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1"
          style={{ backgroundColor: project.color }}
        />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium">
              {project.name}
              {project.isArchived && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  Archived
                </span>
              )}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {project.accountName ?? "Internal"}
              {project.key ? ` · ${project.key}` : ""}
            </p>
          </div>
          <ProgressRing value={project.progress} />
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <HealthBadge health={project.health} />
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
            {project.endDate && (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-3.5" />
                {formatDate(project.endDate, "MMM d")}
              </span>
            )}
            {project.ownerName && (
              <Avatar className="size-6">
                {project.ownerAvatar && (
                  <AvatarImage src={project.ownerAvatar} alt="" />
                )}
                <AvatarFallback className="text-[10px]">
                  {getInitials(project.ownerName)}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
