import Link from "next/link";
import { requireOnboardedUser } from "@/lib/data";
import { getAccountView } from "@/lib/llm/credentials";
import { CoachConnectForm } from "@/components/coach/connect-form";
import { CoachChat } from "@/components/coach/coach-chat";

export const dynamic = "force-dynamic";

export default async function CoachPage() {
  const user = await requireOnboardedUser();
  const view = await getAccountView(user.id);

  if (!view) {
    return (
      <div className="space-y-5">
        <section>
          <h1 className="text-2xl font-semibold">Coach</h1>
          <p className="text-sm text-muted mt-1 leading-relaxed">
            A chat coach that knows your plan, recent workouts, and
            readiness signal. Talks like a coach, not a chatbot. Bring
            your own LLM key so we never touch billing — you pay the
            provider directly at whatever tier you already have.
          </p>
        </section>
        <CoachConnectForm existing={null} />
        <section className="rounded-md border border-panel-border bg-panel/40 p-4 text-xs text-muted space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400">
            [WHY BYO KEY]
          </div>
          <p className="leading-relaxed">
            Serious LLM chat gets expensive fast (~$0.01-0.05 per turn
            depending on model + context). If we billed you, we&apos;d
            need to markup or throttle. Instead, you connect your own
            key and control the tier + limit. Anthropic&apos;s $5 credit
            covers hundreds of turns; OpenAI&apos;s free tier gets you
            started. Encrypted at rest, never displayed after paste.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-2xl font-semibold">Coach</h1>
          <Link
            href="/settings"
            className="text-xs text-muted hover:text-foreground"
          >
            Provider settings →
          </Link>
        </div>
        <p className="text-[11px] text-muted mt-1">
          {view.provider} · ••••{view.apiKeyLast4}
          {view.modelId && ` · ${view.modelId}`}
        </p>
      </section>
      <CoachChat />
    </div>
  );
}
