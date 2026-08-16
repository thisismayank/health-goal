import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  deleteSessionByToken,
  getCurrentSessionToken,
} from "@/lib/auth/sessions";

export const dynamic = "force-dynamic";

async function handleLogout(req: Request) {
  const token = await getCurrentSessionToken();
  if (token) await deleteSessionByToken(token);
  await clearSessionCookie();
  return NextResponse.redirect(new URL("/login", req.url));
}

export async function POST(req: Request) {
  return handleLogout(req);
}

export async function GET(req: Request) {
  return handleLogout(req);
}
