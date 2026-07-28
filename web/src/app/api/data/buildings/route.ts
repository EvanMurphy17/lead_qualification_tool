import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

interface R2BucketLike {
  get(key: string): Promise<{ body: ReadableStream } | null>;
}

/** Full building payload — requires an account. Anonymous visitors get the
 *  public preview payload (public/data/buildings-preview.json.gz) instead.
 *  Served from R2 on Cloudflare Workers, from disk on Node hosting/dev. */
export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const headers = {
    "Content-Type": "application/gzip",
    "Cache-Control": "private, max-age=3600",
  };

  // Cloudflare: R2 bucket bound as DATA
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const env = getCloudflareContext().env as Record<string, unknown>;
    if (env.DATA) {
      const obj = await (env.DATA as R2BucketLike).get("buildings.json.gz");
      if (!obj) {
        return NextResponse.json(
          { error: "Dataset missing in R2. Upload with: wrangler r2 object put loadstone-data/buildings.json.gz --file private-data/buildings.json.gz --remote" },
          { status: 500 }
        );
      }
      return new NextResponse(obj.body, { headers });
    }
  } catch {
    // not running on Cloudflare — fall through to filesystem
  }

  try {
    const [fs, path] = await Promise.all([import("node:fs/promises"), import("node:path")]);
    const p = path.join(process.cwd(), "private-data", "buildings.json.gz");
    const buf = await fs.readFile(p);
    return new NextResponse(new Uint8Array(buf), { headers });
  } catch {
    return NextResponse.json(
      { error: "Dataset missing on server. Run python scripts/build_web_dataset.py" },
      { status: 500 }
    );
  }
}
