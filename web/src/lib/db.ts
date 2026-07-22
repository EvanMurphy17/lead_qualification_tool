import "server-only";

/**
 * Leads storage with two backends:
 * - Cloudflare Workers: raw SQL on the D1 binding `DB` (Prisma's Node engine
 *   can't run on workerd, and one table doesn't justify wasm gymnastics).
 * - Local dev / Node hosting: classic Prisma client (SQLite via DATABASE_URL).
 * The D1 schema is generated from prisma/schema.prisma (deploy/schema.sql) —
 * keep both in sync if the User model changes.
 */

export interface LeadUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  company: string;
  role: string | null;
  phone: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
  loginCount: number;
}

export interface NewLead {
  email: string;
  passwordHash: string;
  name: string;
  company: string;
  role: string | null;
  phone: string | null;
}

export interface LeadsRepo {
  findByEmail(email: string): Promise<LeadUser | null>;
  /** Creates the user with loginCount=1 and lastLoginAt=now. */
  create(data: NewLead): Promise<LeadUser>;
  recordLogin(id: string): Promise<void>;
  list(): Promise<LeadUser[]>;
}

const onWorkers =
  typeof globalThis.navigator !== "undefined" &&
  globalThis.navigator.userAgent === "Cloudflare-Workers";

// ---------------------------------------------------------------------------
// D1 backend (Cloudflare)
// ---------------------------------------------------------------------------

interface D1Like {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      first<T>(): Promise<T | null>;
      run(): Promise<unknown>;
      all<T>(): Promise<{ results: T[] }>;
    };
  };
}

type D1Row = Omit<LeadUser, "createdAt" | "lastLoginAt"> & {
  createdAt: string | number;
  lastLoginAt: string | number | null;
};

function toDate(v: string | number | null): Date | null {
  if (v == null) return null;
  if (typeof v === "number") return new Date(v);
  const s = String(v);
  return new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z");
}

function fromRow(r: D1Row): LeadUser {
  return { ...r, createdAt: toDate(r.createdAt) as Date, lastLoginAt: toDate(r.lastLoginAt) };
}

function d1Repo(db: D1Like): LeadsRepo {
  return {
    async findByEmail(email) {
      const row = await db
        .prepare('SELECT * FROM "User" WHERE email = ?')
        .bind(email)
        .first<D1Row>();
      return row ? fromRow(row) : null;
    },
    async create(data) {
      const id = crypto.randomUUID();
      await db
        .prepare(
          'INSERT INTO "User" (id, email, passwordHash, name, company, role, phone, createdAt, lastLoginAt, loginCount) ' +
            "VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)"
        )
        .bind(id, data.email, data.passwordHash, data.name, data.company, data.role, data.phone)
        .run();
      const row = await db.prepare('SELECT * FROM "User" WHERE id = ?').bind(id).first<D1Row>();
      return fromRow(row as D1Row);
    },
    async recordLogin(id) {
      await db
        .prepare('UPDATE "User" SET lastLoginAt = CURRENT_TIMESTAMP, loginCount = loginCount + 1 WHERE id = ?')
        .bind(id)
        .run();
    },
    async list() {
      const { results } = await db
        .prepare('SELECT * FROM "User" ORDER BY createdAt DESC')
        .bind()
        .all<D1Row>();
      return results.map(fromRow);
    },
  };
}

// ---------------------------------------------------------------------------
// Prisma backend (local dev / Node hosting)
// ---------------------------------------------------------------------------

async function prismaRepo(): Promise<LeadsRepo> {
  const { PrismaClient } = await import("@prisma/client");
  const g = globalThis as unknown as { prisma?: InstanceType<typeof PrismaClient> };
  g.prisma ??= new PrismaClient();
  const prisma = g.prisma;
  return {
    findByEmail: (email) => prisma.user.findUnique({ where: { email } }),
    create: (data) =>
      prisma.user.create({ data: { ...data, lastLoginAt: new Date(), loginCount: 1 } }),
    async recordLogin(id) {
      await prisma.user.update({
        where: { id },
        data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
      });
    },
    list: () => prisma.user.findMany({ orderBy: { createdAt: "desc" } }),
  };
}

export async function getLeadsRepo(): Promise<LeadsRepo> {
  if (!onWorkers) return prismaRepo();
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const env = getCloudflareContext().env as Record<string, unknown>;
  if (!env.DB) throw new Error("D1 binding `DB` is missing — check wrangler.jsonc.");
  return d1Repo(env.DB as D1Like);
}
