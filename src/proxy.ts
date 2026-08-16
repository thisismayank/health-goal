import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const REALM = "Basecamp";
const SESSION_COOKIE = "basecamp_session";

// Public routes that bypass the session gate. Auth pages need to be
// reachable when signed out; webhooks authenticate with their own tokens;
// PWA assets (manifest + icons) must be fetchable by the browser without
// a session cookie so the install prompt and home-screen icon work.
const PUBLIC_PATHS = new Set<string>([
  "/login",
  "/manifest.webmanifest",
  "/icon",
  "/apple-icon",
]);
const PUBLIC_PREFIXES: string[] = [
  "/api/auth/",
  "/api/strava/webhook",
  "/api/health-import",
];

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

// Optional outer HTTP-Basic gate for pre-launch staging. When AUTH_PASSWORD
// (and optionally AUTH_USERNAME) are set, every request must satisfy basic
// auth AS WELL AS the per-user session gate below. Remove the env vars in
// production once you're ready to open the doors.
function passesBasicAuthGate(request: NextRequest): NextResponse | null {
  const password = process.env.AUTH_PASSWORD;
  if (!password) return null;

  const username = process.env.AUTH_USERNAME ?? "basecamp";
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
      const idx = decoded.indexOf(":");
      if (idx !== -1) {
        const u = decoded.slice(0, idx);
        const p = decoded.slice(idx + 1);
        if (safeEqual(u, username) && safeEqual(p, password)) return null;
      }
    } catch {
      // fall through to 401
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
    },
  });
}

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function proxy(request: NextRequest) {
  // Outer staging gate (optional).
  const basicRejection = passesBasicAuthGate(request);
  if (basicRejection) return basicRejection;

  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname)) return withPathname(request, pathname);

  // Session gate: cookie must be present. Actual validity is verified in
  // pages via getCurrentUser (stale/expired sessions trigger a redirect
  // there). This edge check keeps the fast path free of DB work.
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionToken) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/" && pathname !== "/login") {
      loginUrl.searchParams.set("next", pathname + search);
    }
    return NextResponse.redirect(loginUrl);
  }

  return withPathname(request, pathname);
}

// Attach x-pathname on the forwarded request so server components can
// tailor the shell (hide North Star bar on /login and /welcome, etc.).
function withPathname(request: NextRequest, pathname: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // Everything except static assets and Next internals runs through the proxy.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
