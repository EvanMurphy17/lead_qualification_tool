import Link from "next/link";
import { redirect } from "next/navigation";
import { getLeadsRepo } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { IconDownload } from "@/components/icons";

export const metadata = { title: "Admin: signups" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");
  if (!isAdmin(session.email)) redirect("/explore");

  const repo = await getLeadsRepo();
  const users = await repo.list();

  return (
    <main className="flex flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Logo href="/explore" />
          <Link href="/explore" className="text-sm text-muted hover:text-foreground transition-colors">
            ← Back to explorer
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl">Signups</h1>
            <p className="mt-1 text-sm text-muted">
              <span className="font-heading text-foreground">{users.length}</span> accounts.
              Your follow-up list.
            </p>
          </div>
          <a
            href="/api/admin/leads"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-background hover:bg-accent hover:text-foreground transition-colors"
          >
            <IconDownload size={15} />
            Download CSV
          </a>
        </div>

        <div className="mt-6 overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium text-right">Signed up</th>
                <th className="px-4 py-3 font-medium text-right">Last login</th>
                <th className="px-4 py-3 font-medium text-right">Logins</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{u.name}</td>
                  <td className="px-4 py-3 text-muted">{u.email}</td>
                  <td className="px-4 py-3">{u.company}</td>
                  <td className="px-4 py-3 text-muted">{u.role ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-heading text-muted">
                    {u.createdAt.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-4 py-3 text-right font-heading text-muted">
                    {u.lastLoginAt?.toISOString().slice(0, 10) ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-heading">{u.loginCount}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    No signups yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
