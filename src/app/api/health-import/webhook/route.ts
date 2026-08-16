import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { userProfile } from "@/db/schema";
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

  // External webhook — no session cookie. Route to a specific user via
  // HEALTH_IMPORT_USER_EMAIL env until we ship per-user webhook tokens.
  const routeEmail = process.env.HEALTH_IMPORT_USER_EMAIL?.trim().toLowerCase();
  if (!routeEmail) {
    return NextResponse.json(
      { ok: false, error: "HEALTH_IMPORT_USER_EMAIL not set" },
      { status: 500 },
    );
  }
  const [user] = await db
    .select()
    .from(userProfile)
    .where(eq(userProfile.email, routeEmail))
    .limit(1);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: `no user with email ${routeEmail}` },
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
