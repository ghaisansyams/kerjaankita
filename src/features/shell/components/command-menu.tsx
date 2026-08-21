"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { Building2, CheckSquare, Clock, Layers, Plus, Search, SunMoon, User } from "lucide-react";
import { searchCommandMenu, type SearchResult } from "../actions";
import { setActiveOrganization } from "@/features/organizations/actions";
import { navFor } from "../nav-config";
import type { ShellContext } from "../types";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

const RECENTS_KEY = "flowdesk:recent-searches";

export function CommandMenu({ ctx }: { ctx: ShellContext }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [recents, setRecents] = React.useState<string[]>([]);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENTS_KEY);
      if (raw) setRecents(JSON.parse(raw) as string[]);
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const term = query.trim();

  const { data, isFetching, isError } = useQuery<SearchResult>({
    queryKey: ["command-search", ctx.org.id, term],
    enabled: open && term.length >= 1,
    queryFn: async () => {
      return await searchCommandMenu(term);
    },
  });

  function rememberTerm() {
    if (term.length < 2) return;
    setRecents((prev) => {
      const next = [term, ...prev.filter((r) => r !== term)].slice(0, 6);
      try {
        localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function go(href: string) {
    rememberTerm();
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  const actions = [
    { key: "create-project", label: "Create project", icon: Plus, run: () => go("/projects?new=1") },
    // A task is always created inside a project — send the user to the project
    // list to pick one (no global task creator exists). Labelled honestly.
    { key: "create-task", label: "New task in a project…", icon: CheckSquare, run: () => go("/projects") },
    {
      key: "toggle-theme",
      label: "Toggle theme",
      icon: SunMoon,
      run: () => {
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
        setOpen(false);
      },
    },
  ];
  const actionMatches = term
    ? actions.filter((a) => a.label.toLowerCase().includes(term.toLowerCase()))
    : actions;

  const navItems = navFor(ctx.permissions, ctx.isGuest).flatMap((g) => g.items);
  const orgMatches = ctx.orgs.filter(
    (o) => o.id !== ctx.org.id && o.name.toLowerCase().includes(term.toLowerCase()),
  );
  const navMatches = term
    ? navItems.filter((n) => n.title.toLowerCase().includes(term.toLowerCase()))
    : navItems;

  const resultCount =
    (data?.projects.length ?? 0) +
    (data?.tasks.length ?? 0) +
    (data?.members.length ?? 0) +
    (data?.workspaces.length ?? 0) +
    orgMatches.length;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-full max-w-64 justify-start gap-2 px-2.5 font-normal text-muted-foreground"
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="ml-auto hidden items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] sm:flex">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Search your organization or jump to a page">
        <CommandInput placeholder="Search projects, tasks, people…" value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>
            {isError ? "Something went wrong. Try again." : isFetching ? "Searching…" : "No results found."}
          </CommandEmpty>

          {!term && recents.length > 0 && (
            <CommandGroup heading="Recent">
              {recents.map((r) => (
                <CommandItem key={r} value={`recent-${r}`} onSelect={() => setQuery(r)}>
                  <Clock className="size-4 text-muted-foreground" />
                  <span className="truncate">{r}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {term && (data?.projects.length ?? 0) > 0 && (
            <CommandGroup heading="Projects">
              {data!.projects.map((p) => (
                <CommandItem key={p.id} value={`project-${p.id}-${p.name}`} onSelect={() => go(`/projects/${p.id}`)}>
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: p.color ?? "#4F46E5" }} />
                  <span className="truncate">{p.name}</span>
                  {p.key && <span className="ml-auto text-xs text-muted-foreground">{p.key}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {term && (data?.tasks.length ?? 0) > 0 && (
            <CommandGroup heading="Tasks">
              {data!.tasks.map((t) => (
                <CommandItem key={t.id} value={`task-${t.id}-${t.title}`} onSelect={() => go(`/projects/${t.project_id}/tasks?task=${t.id}`)}>
                  <CheckSquare className="size-4 text-muted-foreground" />
                  <span className="truncate">{t.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {term && (data?.members.length ?? 0) > 0 && (
            <CommandGroup heading="People">
              {data!.members.map((m) => (
                <CommandItem key={m.user_id} value={`member-${m.user_id}-${m.profile?.full_name ?? ""}`} onSelect={() => go("/team")}>
                  <User className="size-4 text-muted-foreground" />
                  <span className="truncate">{m.profile?.full_name ?? "Member"}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {term && (data?.workspaces.length ?? 0) > 0 && (
            <CommandGroup heading="Workspaces">
              {data!.workspaces.map((w) => (
                <CommandItem key={w.id} value={`workspace-${w.id}-${w.name}`} onSelect={() => go("/projects")}>
                  <Layers className="size-4 text-muted-foreground" />
                  <span className="truncate">{w.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {orgMatches.length > 0 && (
            <CommandGroup heading="Organizations">
              {orgMatches.map((o) => (
                <CommandItem
                  key={o.id}
                  value={`org-${o.id}-${o.name}`}
                  onSelect={() => {
                    setOpen(false);
                    setActiveOrganization(o.id);
                  }}
                >
                  <Building2 className="size-4 text-muted-foreground" />
                  <span className="truncate">Switch to {o.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {actionMatches.length > 0 && (
            <CommandGroup heading="Actions">
              {actionMatches.map((a) => (
                <CommandItem key={a.key} value={`action-${a.key}-${a.label}`} onSelect={a.run}>
                  <a.icon className="size-4 text-muted-foreground" />
                  <span>{a.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {navMatches.length > 0 && (
            <>
              {(resultCount > 0 || actionMatches.length > 0 || (!term && recents.length > 0)) && (
                <CommandSeparator />
              )}
              <CommandGroup heading={term ? "Pages" : "Jump to"}>
                {navMatches.map((n) => (
                  <CommandItem key={n.href} value={`nav-${n.href}-${n.title}`} onSelect={() => go(n.href)}>
                    <n.icon className="size-4 text-muted-foreground" />
                    <span className="truncate">{n.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
