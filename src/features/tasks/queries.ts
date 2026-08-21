"use server";

import { getBoardData } from "@/repositories/task.repository";
import type { BoardTask } from "./board-shared";

export type { BoardTask } from "./board-shared";

/** Re-fetch the whole enriched board. */
export async function fetchBoardTasks(projectId: string): Promise<BoardTask[]> {
  return await getBoardData(projectId);
}
