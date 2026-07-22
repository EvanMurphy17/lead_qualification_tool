import { NextResponse } from "next/server";
import { getLeadsRepo } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const name = String(body.name ?? "").trim();
  const company = String(body.company ?? "").trim();
  const role = body.role ? String(body.role).trim() : null;
  const phone = body.phone ? String(body.phone).trim() : null;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  if (!name || !company) {
    return NextResponse.json({ error: "Name and company are required." }, { status: 400 });
  }

  const repo = await getLeadsRepo();
  const existing = await repo.findByEmail(email);
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists. Try signing in." },
      { status: 409 }
    );
  }

  const user = await repo.create({
    email,
    passwordHash: await hashPassword(password),
    name,
    company,
    role,
    phone,
  });

  await createSession({ userId: user.id, email: user.email, name: user.name });
  return NextResponse.json({ ok: true });
}
