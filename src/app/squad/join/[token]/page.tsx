import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { squad } from "@/db/schema";
import { requireCurrentUser } from "@/lib/data";
import { JoinSquadButton } from "./join-button";

export const dynamic = "force-dynamic";

export default async function SquadJoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // Ensure the user is signed in — magic-link flow will bring them back here.
  const user = await requireCurrentUser();

  const [target] = await db
    .select({
      id: squad.id,
      name: squad.name,
    })
    .from(squad)
    .where(eq(squad.inviteToken, token))
    .limit(1);

  if (!target) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="max-w-sm w-full space-y-4 text-center">
          <div className="text-xs font-mono uppercase tracking-widest text-danger">
            [INVALID INVITE]
          </div>
          <h1 className="text-2xl font-semibold">Link doesn't work.</h1>
          <p className="text-sm text-muted leading-relaxed">
            The invite link is invalid or has been revoked. Ask the squad
            admin to send you a fresh one.
          </p>
          <Link
            href="/"
            className="text-sm text-blue-300 hover:underline"
          >
            Back to home →
          </Link>
        </div>
      </div>
    );
  }

  // If they'll be onboarded (should be — requireCurrentUser passed), skip
  // to their existing squad page. But if not onboarded, land here first —
  // we want the wizard AFTER they join.
  if (!user.onboardedAt) {
    redirect(`/welcome?next=${encodeURIComponent(`/squad/join/${token}`)}`);
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-sm w-full space-y-5 text-center">
        <div className="text-xs font-mono uppercase tracking-widest text-blue-400">
          [SQUAD INVITE]
        </div>
        <h1 className="text-2xl font-semibold leading-tight">
          Join <span className="text-blue-300">{target.name}</span>?
        </h1>
        <p className="text-sm text-muted leading-relaxed">
          You'll see this squad's trail completions and they'll see yours. You
          can leave anytime.
        </p>
        <JoinSquadButton token={token} squadName={target.name} />
      </div>
    </div>
  );
}
