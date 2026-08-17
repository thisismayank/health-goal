import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { stravaAccount } from "@/db/schema";
import { requireCurrentUser } from "@/lib/data";
import { FinishOnboardingButton } from "./finish-button";
import { PlanStep } from "./plan-step";

export const dynamic = "force-dynamic";

type StepKey = "1" | "2" | "3";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireCurrentUser();
  if (user.onboardedAt) redirect("/");

  const params = await searchParams;
  const stepRaw = typeof params.step === "string" ? params.step : "1";
  const step: StepKey =
    stepRaw === "3" ? "3" : stepRaw === "2" ? "2" : "1";

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center py-8">
      <div className="w-full max-w-lg space-y-6">
        <StepIndicator current={step} />
        {step === "1" ? <WelcomeStep firstName={firstName(user.name)} /> : null}
        {step === "2" ? <PlanStep /> : null}
        {step === "3" ? <ConnectStep userId={user.id} /> : null}
      </div>
    </div>
  );
}

function firstName(name: string): string {
  return name.split(" ")[0];
}

function StepIndicator({ current }: { current: StepKey }) {
  const stepOrder: StepKey[] = ["1", "2", "3"];
  const currentIdx = stepOrder.indexOf(current);
  return (
    <div className="flex items-center gap-2 justify-center flex-wrap">
      <StepDot label="Welcome" active={current === "1"} done={currentIdx > 0} />
      <StepConnector done={currentIdx > 0} />
      <StepDot label="Plan" active={current === "2"} done={currentIdx > 1} />
      <StepConnector done={currentIdx > 1} />
      <StepDot label="Connect" active={current === "3"} done={false} />
    </div>
  );
}

function StepDot({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  const tone = active
    ? "border-blue-400 bg-blue-950/40 text-blue-300"
    : done
      ? "border-accent/60 bg-accent-strong/10 text-accent"
      : "border-panel-border text-muted";
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-mono ${tone}`}
      >
        {done ? "✓" : label.charAt(0)}
      </div>
      <span className={`text-xs uppercase tracking-widest ${active ? "text-blue-300" : done ? "text-accent" : "text-muted"}`}>
        {label}
      </span>
    </div>
  );
}

function StepConnector({ done }: { done: boolean }) {
  return (
    <div
      className={`h-px w-8 ${done ? "bg-accent/50" : "bg-panel-border"}`}
    />
  );
}

function WelcomeStep({ firstName }: { firstName: string }) {
  return (
    <div className="space-y-6 text-center">
      <div className="space-y-3">
        <div className="text-xs font-mono uppercase tracking-widest text-blue-400">
          [WELCOME]
        </div>
        <h1 className="text-3xl font-semibold leading-tight">
          Hi {firstName}. Ever wondered if a trail is really hard{" "}
          <span className="text-blue-300">for you</span>?
        </h1>
        <p className="text-sm text-muted leading-relaxed max-w-md mx-auto">
          Trails get labelled Easy / Moderate / Hard — but those ratings
          ignore your actual fitness. Basecamp uses your recent training to
          tell you what any hike will feel like{" "}
          <em className="text-foreground/80 not-italic">for you</em>, right now.
        </p>
      </div>

      <div className="rounded-lg border border-blue-500/30 bg-blue-950/10 p-4 space-y-2 text-left">
        <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400">
          [HOW IT WORKS]
        </div>
        <ol className="text-sm space-y-1.5 list-decimal list-inside marker:text-blue-400">
          <li>Connect a data source — Strava, Apple Health, or Garmin.</li>
          <li>Pick any trail you're curious about (500+ preset trails).</li>
          <li>
            See a personalized <strong>For You</strong> rating with what to
            work on before you go.
          </li>
        </ol>
      </div>

      <div className="flex flex-col items-center gap-3">
        <Link
          href="/welcome?step=2"
          className="w-full sm:w-auto sm:min-w-[280px] rounded-md bg-accent-strong text-background font-medium px-6 py-3 hover:bg-accent transition text-center"
        >
          Get started →
        </Link>
        <p className="text-[11px] text-muted">Takes about 2 minutes.</p>
      </div>
    </div>
  );
}

async function ConnectStep({ userId }: { userId: number }) {
  const [strava] = await db
    .select({ athleteId: stravaAccount.athleteId })
    .from(stravaAccount)
    .where(eq(stravaAccount.userId, userId))
    .limit(1);
  const stravaConnected = !!strava;

  return (
    <div className="space-y-5">
      <div className="space-y-2 text-center">
        <div className="text-xs font-mono uppercase tracking-widest text-blue-400">
          [CONNECT]
        </div>
        <h1 className="text-2xl font-semibold">Where's your training data?</h1>
        <p className="text-sm text-muted leading-relaxed max-w-md mx-auto">
          Connecting one source is enough. You can add more later.
        </p>
      </div>

      <section
        className={`rounded-lg border p-4 space-y-3 ${
          stravaConnected
            ? "border-accent/50 bg-accent-strong/5"
            : "border-panel-border bg-panel"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium">Strava</div>
            <div className="text-xs text-muted mt-0.5">
              Auto-imports every run, hike, and ride. Best for most people.
            </div>
          </div>
          {stravaConnected ? (
            <span className="text-xs font-mono uppercase tracking-wider text-accent whitespace-nowrap">
              ✓ CONNECTED
            </span>
          ) : (
            <Link
              href="/api/strava/connect"
              className="rounded-md bg-accent-strong hover:bg-accent text-background font-medium text-sm px-3 py-1.5 whitespace-nowrap"
            >
              Connect →
            </Link>
          )}
        </div>
        {stravaConnected && (
          <p className="text-xs text-muted">
            Recent activities are flowing in. Your For You ratings will
            personalize as data arrives.
          </p>
        )}
      </section>

      <details className="rounded-lg border border-panel-border bg-panel p-4 group">
        <summary className="cursor-pointer text-sm font-medium select-none flex items-center justify-between">
          <span>iPhone user? Set up Apple Health instead.</span>
          <span className="text-xs text-muted group-open:rotate-180 transition">
            ▾
          </span>
        </summary>
        <div className="mt-3 space-y-2 text-sm text-muted leading-relaxed">
          <p>
            1. Install{" "}
            <a
              className="text-blue-300 hover:underline"
              href="https://apps.apple.com/app/health-auto-export/id1115567069"
              target="_blank"
              rel="noopener noreferrer"
            >
              Health Auto Export
            </a>{" "}
            on iOS (paid app, ~$8/yr).
          </p>
          <p>
            2. Add a REST API integration pointing at Basecamp's webhook —
            copy the URL + your personal token from Settings after this.
          </p>
          <p>
            3. Enable steps, workouts, sleep, HRV, resting HR, VO2max.
          </p>
          <p className="text-[11px] italic pt-1">
            Skip this for now if you're on Android or want to try Basecamp
            without a data connection. We'll give generic ratings.
          </p>
        </div>
      </details>

      <div className="flex flex-col items-center gap-3 pt-2">
        <FinishOnboardingButton
          primary
          label={stravaConnected ? "Continue to trails →" : "Continue to trails →"}
        />
        {!stravaConnected && (
          <FinishOnboardingButton
            label="Skip data connection for now"
            variant="ghost"
          />
        )}
      </div>
    </div>
  );
}
