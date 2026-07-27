import "server-only";
import { cache } from "react";
import { getProject } from "@/repositories/project.repository";
import { getHealthTolerance } from "@/repositories/organization.repository";

/** Request-deduped project loader so the detail layout + tab pages share one fetch. */
export const loadProject = cache((id: string) => getProject(id));
export const loadHealthTolerance = cache((orgId: string) =>
  getHealthTolerance(orgId),
);
