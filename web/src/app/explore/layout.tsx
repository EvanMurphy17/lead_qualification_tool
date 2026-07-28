import Link from "next/link";
import { getSession, isAdmin } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { IconLogOut, IconUser } from "@/components/icons";

export const metadata = { title: "Explorer" };

export default async function ExploreLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <Logo />
        <div className="flex items-center gap-4 text-sm">
          {session ? (
            <>
              {isAdmin(session.email) && (
                <Link href="/admin" className="text-muted hover:text-foreground transition-colors">
                  Admin
                </Link>
              )}
              <Link href="/sources" className="text-muted hover:text-foreground transition-colors">
                Sources
              </Link>
              <span className="hidden items-center gap-1.5 text-muted sm:flex">
                <IconUser size={15} />
                {session.name || session.email}
              </span>
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="flex items-center gap-1.5 text-muted hover:text-foreground transition-colors cursor-pointer"
                  title="Sign out"
                >
                  <IconLogOut size={15} />
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/sources" className="text-muted hover:text-foreground transition-colors">
                Sources
              </Link>
              <Link href="/login?next=/explore" className="text-muted hover:text-foreground transition-colors">
                Sign in
              </Link>
              <Link
                href="/signup?next=/explore"
                className="rounded-md bg-primary px-4 py-2 font-semibold text-background hover:bg-accent hover:text-foreground transition-colors"
              >
                Get full access, free
              </Link>
            </>
          )}
        </div>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
