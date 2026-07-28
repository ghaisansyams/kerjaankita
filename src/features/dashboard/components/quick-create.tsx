"use client";

import { useRouter } from "next/navigation";
import { FolderPlus, Plus, SquarePen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function QuickCreate() {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-4" />
          Quick create
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={() => router.push("/projects?new=1")}>
          <FolderPlus className="size-4" /> New project
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/projects")}>
          <SquarePen className="size-4" /> New task
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
