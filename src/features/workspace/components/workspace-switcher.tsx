"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function WorkspaceSwitcher({
  workspaces,
  current,
}: {
  workspaces: { id: string; name: string }[];
  current: string;
}) {
  const router = useRouter();
  if (workspaces.length < 2) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Editing</span>
      <Select value={current} onValueChange={(id) => router.push(`/settings/workspace?ws=${id}`)}>
        <SelectTrigger className="h-9 w-56" aria-label="Choose workspace">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {workspaces.map((w) => (
            <SelectItem key={w.id} value={w.id}>
              {w.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
