import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserFromSession } from "@/lib/auth/sessions";
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

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <div className="text-xs font-mono uppercase tracking-widest text-blue-400">
            BASECAMP
          </div>
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="text-sm text-muted">
            Personalized trail readiness for any hike you're planning.
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
              sign-in link. It expires in 15 minutes.
            </p>
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
