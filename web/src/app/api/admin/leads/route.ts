import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, isAdmin } from "@/lib/auth";

/** CSV export of all signups — admin only. */
export async function GET() {
  const session = await getSession();
  if (!session || !isAdmin(session.email)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = v instanceof Date ? v.toISOString() : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = "name,email,company,role,phone,created_at,last_login_at,login_count";
  const rows = users.map((u) =>
    [u.name, u.email, u.company, u.role, u.phone, u.createdAt, u.lastLoginAt, u.loginCount]
      .map(esc)
      .join(",")
  );

  return new NextResponse([header, ...rows].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="loadstone-signups.csv"`,
    },
  });
}
