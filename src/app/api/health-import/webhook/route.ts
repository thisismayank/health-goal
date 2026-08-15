import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/data";
import { importHealthPayload } from "@/lib/health-import/parser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function tokenMatches(authHeader: string | null): boolean {
  const expected = process.env.HEALTH_IMPORT_TOKEN;
  if (!expected) return false;
  if (!authHeader) return false;
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET() {
  // Simple health check for setup validation.
  return NextResponse.json({ ok: true, endpoint: "health-import/webhook" });
}

export async function POST(request: Request) {
  if (!tokenMatches(request.headers.get("authorization"))) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "no user configured" },
      { status: 500 },
    );
  }

  try {
    const result = await importHealthPayload(
      user.id,
      user.timezone,
      payload,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("health-import webhook failed:", e);
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
