"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { toCsv } from "@/utils/csv";
import type { ReportVM } from "@/services/reports.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Option = { id: string; name: string };
type ProjectOption = Option & { workspaceId: string | null };
const ALL = "all";

export function ReportsView({
  reports,
  workspaces,
  projects,
  filters,
}: {
  reports: ReportVM[];
  workspaces: Option[];
  projects: ProjectOption[];
  filters: { workspace: string; project: string; from: string; to: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState(reports[0]?.key ?? "");

  const [ws, setWs] = useState(filters.workspace || ALL);
  const [proj, setProj] = useState(filters.project || ALL);
  const [from, setFrom] = useState(filters.from);
  const [to, setTo] = useState(filters.to);

  const report = reports.find((r) => r.key === active) ?? reports[0];
  const projectChoices = useMemo(
    () => (ws === ALL ? projects : projects.filter((p) => p.workspaceId === ws)),
    [projects, ws],
  );

  function apply() {
    const params = new URLSearchParams();
    if (ws !== ALL) params.set("workspace", ws);
    if (proj !== ALL) params.set("project", proj);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    startTransition(() => router.push(`/reports?${params.toString()}`));
  }

  function reset() {
    setWs(ALL);
    setProj(ALL);
    setFrom("");
    setTo("");
    startTransition(() => router.push("/reports"));
  }

  function exportCsv() {
    if (!report) return;
    const blob = new Blob([toCsv(report.columns, report.rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.key}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Report picker */}
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Reports">
        {reports.map((r) => (
          <button
            key={r.key}
            role="tab"
            aria-selected={r.key === active}
            onClick={() => setActive(r.key)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
              r.key === active
                ? "border-primary bg-primary/10 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {r.title}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
        <FilterSelect label="Workspace" value={ws} onChange={(v) => { setWs(v); setProj(ALL); }} options={workspaces} allLabel="All workspaces" />
        <FilterSelect label="Project" value={proj} onChange={setProj} options={projectChoices} allLabel="All projects" />
        <div className="space-y-1">
          <Label htmlFor="from" className="text-xs text-muted-foreground">From</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[150px]" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to" className="text-xs text-muted-foreground">To</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-[150px]" />
        </div>
        <Button size="sm" onClick={apply} disabled={pending}>Apply</Button>
        <Button size="sm" variant="ghost" onClick={reset} disabled={pending}>Reset</Button>
        <Button size="sm" variant="outline" className="ml-auto" onClick={exportCsv} disabled={!report || report.rows.length === 0}>
          <Download className="size-4" />
          Export CSV
        </Button>
      </div>

      {/* Table */}
      {report && (
        <div>
          <p className="mb-2 text-sm text-muted-foreground">{report.description}</p>
          {report.rows.length === 0 ? (
            <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
              No data for these filters.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    {report.columns.map((c) => (
                      <th key={c.key} className={cn("px-3 py-2 font-medium", c.numeric && "text-right")}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                      {report.columns.map((c) => (
                        <td
                          key={c.key}
                          className={cn("px-3 py-2 tabular-nums", c.numeric && "text-right")}
                        >
                          {row[c.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  allLabel: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-[170px]" aria-label={label}>
          <SelectValue placeholder={allLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
