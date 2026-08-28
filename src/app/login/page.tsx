import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserFromSession } from "@/lib/auth/sessions";
import { readSeedNoConsume } from "@/lib/cold-start/seed";
import { findTrailBySlug } from "@/lib/basecamp/trail-library";
import { getFullTrailLibrary } from "@/lib/basecamp/trail-coords";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getUserFromSession();
  if (user) redirect("/");

  const params = await searchParams;
  const sent = params.sent === "1";
  const email = typeof params.email === "string" ? params.email : "";
  const errorCode = typeof params.err === "string" ? params.err : null;

  // Cold-start peek — tailor copy so a stranger who just saw a
  // verdict on /start doesn't hit a generic "sign in" wall.
  const seed = await readSeedNoConsume();
  const seedPreset = seed
    ? (findTrailBySlug(seed.slug) ??
      getFullTrailLibrary().find((p) => p.slug === seed.slug))
    : null;
  const seedTrailShort = seedPreset
    ? seedPreset.name.split(" — ")[0].split(/[·•]/)[0].trim()
    : null;

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <div className="text-xs font-mono uppercase tracking-widest text-blue-400">
            BASECAMP
          </div>
          <h1 className="text-2xl font-semibold">
            {seedTrailShort ? "One more step" : "Sign in"}
          </h1>
          <p className="text-sm text-muted">
            {seedTrailShort
              ? `Enter your email to save your ${seedTrailShort} verdict and build your plan.`
              : "Personalized trail readiness for any hike you're planning."}
          </p>
        </div>

        {sent ? (
          <div className="rounded-lg border border-blue-500/30 bg-blue-950/10 p-5 space-y-3">
            <div className="text-xs font-mono uppercase tracking-widest text-blue-400">
              [LINK SENT]
            </div>
            <p className="text-sm leading-relaxed">
              Check{" "}
              <span className="font-medium text-blue-300">{email}</span> for a
              sign-in link or a 6-digit code. Link expires in 15 minutes.
            </p>
            {seedTrailShort && (
              <p className="text-[11px] text-blue-300/90 leading-relaxed border-l-2 border-blue-500/40 pl-2">
                On mobile? Type the code below to stay in this tab — the link
                may open a different browser and lose your {seedTrailShort}{" "}
                verdict.
              </p>
            )}
            <LoginForm
              defaultEmail={email}
              errorCode={errorCode}
              codeMode
            />
            <p className="text-xs text-muted">
              Didn't get it? Check spam, or{" "}
              <Link
                href="/login"
                className="text-blue-300 hover:underline"
              >
                request another
              </Link>
              .
            </p>
          </div>
        ) : (
          <LoginForm defaultEmail={email} errorCode={errorCode} />
        )}
      </div>
    </div>
  );
}
