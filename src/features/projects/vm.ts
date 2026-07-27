import { computeHealth } from "@/services/project.service";
import type { ProjectListItem } from "@/repositories/project.repository";
import type { ProjectCardVM } from "@/components/domain/project-card";

/** Map a repository row + tenant tolerance into the card view-model (BR-5 health). */
export function toProjectCardVM(
  p: ProjectListItem,
  tolerance: number,
): ProjectCardVM {
  return {
    id: p.id,
    name: p.name,
    key: p.key,
    color: p.color,
    accountName: p.account?.name ?? null,
    ownerName: p.owner?.full_name ?? null,
    ownerAvatar: p.owner?.avatar_url ?? null,
    progress: p.progress,
    health: computeHealth(
      { progress: p.progress, startDate: p.start_date, endDate: p.end_date },
      tolerance,
    ),
    endDate: p.end_date,
    isArchived: p.is_archived,
  };
}
