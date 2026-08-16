import { NextResponse } from "next/server";
import {
  checkMagicLinkRateLimit,
  issueMagicLink,
  magicLinkUrl,
} from "@/lib/auth/magic-links";
import { sendMagicLinkEmail } from "@/lib/auth/email";
import { isValidEmail } from "@/lib/auth/tokens";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = (await req.json()) as { email?: string };
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_email" },
      { status: 400 },
    );
  }

  const email = (body.email ?? "").trim();
  if (!email || !isValidEmail(email)) {
    return NextResponse.json(
      { ok: false, error: "invalid_email" },
      { status: 400 },
    );
  }

  const limitReason = await checkMagicLinkRateLimit(email);
  if (limitReason) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 },
    );
  }

  try {
    const { token, email: normalized } = await issueMagicLink(email);
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ??
      new URL(req.url).origin;
    const link = magicLinkUrl(baseUrl, token);
    const result = await sendMagicLinkEmail(normalized, link);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: "send_failed" },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("request-link failed:", err);
    return NextResponse.json(
      { ok: false, error: "send_failed" },
      { status: 500 },
    );
  }
}
