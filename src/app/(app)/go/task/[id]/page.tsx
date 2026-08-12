import Link from "next/link";
import { redirect } from "next/navigation";
import { getTaskRef } from "@/repositories/task.repository";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Resolver for task-scoped deep links (notifications carry only the task id).
 * Looks up the task's project (RLS-scoped) and redirects to the drawer.
 *
 * Notifications outlive the tasks they point at — deleting a task leaves its
 * "assigned to you" notice in the tray — so an unresolvable id is an ordinary
 * outcome here, not a broken URL. A bare 404 read as the app being broken; say
 * what happened and offer the way back instead.
 */
export default async function GoTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ref = await getTaskRef(id);
  if (ref) redirect(`/projects/${ref.project_id}/tasks?task=${id}`);

  return (
    <div className="grid min-h-[60vh] place-items-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 py-10 text-center">
          <p className="text-sm font-medium">Task ini sudah tidak tersedia</p>
          <p className="text-sm text-muted-foreground">
            Kemungkinan sudah dihapus, atau kamu tidak punya akses ke project-nya.
            Notifikasinya tetap ada di daftar.
          </p>
          <div className="flex justify-center gap-2">
            <Button asChild variant="outline">
              <Link href="/notifications">Ke notifikasi</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard">Ke dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
