import { NextResponse } from "next/server";
import { getLeadsRepo } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  const repo = await getLeadsRepo();
  const user = await repo.findByEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  await repo.recordLogin(user.id);

  await createSession({ userId: user.id, email: user.email, name: user.name });
  return NextResponse.json({ ok: true });
}
