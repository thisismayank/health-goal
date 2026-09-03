/**
 * Persistent verification harness — the "would Devin catch this?" gate.
 *
 * Provisions three fresh personas (Sarah / Marcus / Alex, matching the
 * Devin retest doc), drives the full cold-start flow end-to-end via
 * HTTP (test-login endpoint + cold_start_seed cookie), fetches every
 * surface a stranger touches, extracts key values via regex, and
 * cross-checks pairs that must agree.
 *
 * Why this exists: rounds 1 and 2 of Devin's testing surfaced bugs
 * that were structurally invisible to my typechecks and unit-style
 * verifications — a fix would land in one system (loadFitnessSnapshot)
 * and miss the parallel systems (computeCharacterSheet, computeRank,
 * plan-progress narrative) that consumed the same data via a different
 * query. This harness catches those contradictions by looking at what
 * an actual visitor sees on each screen.
 *
 * Usage:
 *   # dev (default)
 *   npm run dev                         # in another terminal
 *   BASE_URL=http://localhost:3000 npx tsx --env-file=.env.local scripts/verify-personas.ts
 *
 *   # prod
 *   BASE_URL=https://rainier-companion.vercel.app \
 *   TEST_LOGIN_TOKEN=$(vercel env pull ... | grep TEST | cut -d= -f2) \
 *     npx tsx scripts/verify-personas.ts
 *
 * Requires:
 *   - TEST_LOGIN_TOKEN env var (from Vercel env or .env.local)
 *   - APP_ENCRYPTION_KEY env var (to mint valid cold_start_seed cookies)
 *   - DATABASE_URL for cleanup (deletes verify-* users before + after)
 *   - A running server at BASE_URL
 *
 * Cost note: each persona triggers a plan generation. If LLM narrative
 * generation is wired to Gemini in the target env, expect ~1 Gemini
 * call per persona (~$0 on the free tier, cents on paid).
 */

import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { userProfile } from "../src/db/schema";

// -------- config --------

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const TOKEN = process.env.TEST_LOGIN_TOKEN;
const KEY = process.env.APP_ENCRYPTION_KEY;
if (!TOKEN) {
  console.error("TEST_LOGIN_TOKEN not set");
  process.exit(1);
}
if (!KEY) {
  console.error("APP_ENCRYPTION_KEY not set");
  process.exit(1);
}
const KEY_BUF = Buffer.from(KEY, "hex");

type Persona = {
  name: string;
  email: string;
  slug: string;
  answers: {
    longestHikeBucket: "never" | "under_3" | "3_to_6" | "6_to_10" | "over_10";
    weeklyHoursBucket: "zero" | "1_to_3" | "3_to_6" | "over_6";
    priorAltBucket:
      | "never_above_6k"
      | "to_8_10k"
      | "to_12_14k"
      | "above_14k";
  };
  // Expected qualities of the resulting state. Contradiction checks
  // compare surfaces against each other, but a few per-persona
  // baselines (e.g., Alex's END must be non-zero, Alex's rank must
  // be C) prevent silent baseline-not-reaching-stats regressions.
  expect: {
    verdict: "comfortable" | "achievable" | "hard" | "do_not_attempt";
    rankLetter: string;
    endMustBeNonZero: boolean;
    powMustBeNonZero: boolean;
  };
};

const PERSONAS: Persona[] = [
  {
    name: "Sarah",
    email: "verify-sarah@basecamp.dev",
    slug: "rainier-dc",
    answers: {
      longestHikeBucket: "3_to_6",
      weeklyHoursBucket: "1_to_3",
      priorAltBucket: "to_8_10k",
    },
    expect: {
      verdict: "do_not_attempt",
      rankLetter: "D",
      endMustBeNonZero: true,
      powMustBeNonZero: true,
    },
  },
  {
    name: "Marcus",
    email: "verify-marcus@basecamp.dev",
    slug: "kilimanjaro-machame",
    answers: {
      longestHikeBucket: "never",
      weeklyHoursBucket: "zero",
      priorAltBucket: "never_above_6k",
    },
    expect: {
      verdict: "do_not_attempt",
      rankLetter: "E",
      endMustBeNonZero: false,
      powMustBeNonZero: false,
    },
  },
  {
    name: "Alex",
    email: "verify-alex@basecamp.dev",
    slug: "whitney-dayhike",
    answers: {
      longestHikeBucket: "over_10",
      weeklyHoursBucket: "over_6",
      priorAltBucket: "above_14k",
    },
    expect: {
      verdict: "achievable",
      rankLetter: "C",
      endMustBeNonZero: true,
      powMustBeNonZero: true,
    },
  },
];

// -------- cookie jar + fetch helpers --------

type Jar = Map<string, string>;

function jarHeader(jar: Jar): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function absorbSetCookie(jar: Jar, res: Response): void {
  // Response's headers.getSetCookie() returns an array in Node 20+.
  const raw =
    typeof (res.headers as unknown as { getSetCookie?: () => string[] })
      .getSetCookie === "function"
      ? (res.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
      : (res.headers.get("set-cookie") ?? "").split(/,(?=[^ ])/);
  for (const line of raw) {
    if (!line) continue;
    const [pair] = line.split(";");
    const eq = pair.indexOf("=");
    if (eq < 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    // Cookie deleted (Expires past)
    if (/Expires=Thu, 01 Jan 1970/i.test(line)) {
      jar.delete(name);
      continue;
    }
    jar.set(name, value);
  }
}

async function get(
  url: string,
  jar: Jar,
  opts?: { followRedirects?: boolean },
): Promise<{ status: number; text: string; location: string | null }> {
  const follow = opts?.followRedirects ?? true;
  let current = url;
  let hops = 0;
  while (hops < 10) {
    const res = await fetch(current, {
      redirect: "manual",
      headers: { cookie: jarHeader(jar) },
    });
    absorbSetCookie(jar, res);
    const location = res.headers.get("location");
    if (
      follow &&
      (res.status === 301 ||
        res.status === 302 ||
        res.status === 307 ||
        res.status === 308) &&
      location
    ) {
      current = new URL(location, current).toString();
      hops += 1;
      continue;
    }
    const text = await res.text();
    return { status: res.status, text, location };
  }
  throw new Error(`Too many redirects starting from ${url}`);
}

// -------- seed-cookie mint (mirrors src/lib/cold-start/seed.ts) --------

function signSeed(slug: string, answers: Persona["answers"]): string {
  const seed = { slug, answers, writtenAt: Date.now() };
  const payload = Buffer.from(JSON.stringify(seed), "utf8").toString("base64url");
  const sig = createHmac("sha256", KEY_BUF).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

// -------- HTML extractors --------

// The rendered HTML is React server-rendered; specific data lives both
// in visible tags AND in the RSC payload script. Extractors are
// deliberately loose — grab the first plausible match, tolerate the
// RSC-escaped duplicate. If a check breaks because the extractor
// returned null, that's a real signal that surface didn't render what
// we expected (a bug in itself).

function extractFirst(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

function extractHomeClassLetter(html: string): string | null {
  // North-star bar: <span ...>Class</span><span ...>E</span>
  return extractFirst(
    html,
    />Class<\/span>[\s\S]{0,200}?<span[^>]*>([EDCBAS])</,
  );
}

function extractProgressClassLetter(html: string): string | null {
  // /progress [HIKER CLASS] panel: [CLASS] label then a 6xl text div
  // with the single letter, followed by a label like "Casual Walker".
  return extractFirst(
    html,
    /\[HIKER CLASS\][\s\S]{0,400}?text-6xl[^>]*>([EDCBAS])</,
  );
}

function extractPresetClassLetter(html: string): string | null {
  // Verdict card's Terrain dimension row renders "Class C
  // (self-reported)" or "Class C" as the current label. Take the
  // first letter after "Class " in that context.
  return extractFirst(html, /Class\s+([EDCBAS])\b/);
}

function extractWkFractionFinal(html: string): string | null {
  // North-star bar structure:
  //   <span>Wk</span>
  //   <span>1<span class="text-muted ...">/<!-- -->40</span></span>
  // React inserts <!-- --> template comments between `/` and the
  // denominator digit, so relax through both boundaries.
  const m = html.match(
    />Wk<\/span>[\s\S]{0,300}?<span[^>]*>(\d{1,3})[\s\S]{0,120}?\/[\s\S]{0,50}?(\d{1,3})</,
  );
  if (m) return `${m[1]}/${m[2]}`;
  return null;
}

function extractStatValueAndMetric(
  html: string,
  key: "STR" | "END" | "POW" | "REC" | "WILL",
): { value: number | null; metric: string | null } {
  // /progress renders each stat card like:
  //   <span>END</span><span>Endurance</span></div><div>
  //     [<span>trend</span>]?
  //     <span class="text-2xl ...">VALUE</span>
  //   </div>
  //   <div>...</div>
  //   <div class="text-xs text-muted">METRIC LINE</div>
  const valueRe = new RegExp(
    `>${key}<\\/span>[\\s\\S]{0,400}?text-2xl[^>]*>(\\d{1,3})<`,
  );
  const value = extractFirst(html, valueRe);
  const metricRe = new RegExp(
    `>${key}<\\/span>[\\s\\S]{0,700}?text-xs text-muted"[^>]*>([^<]{5,140})<`,
  );
  const metric = extractFirst(html, metricRe);
  return {
    value: value != null ? parseInt(value, 10) : null,
    metric,
  };
}

function extractVerdictLabel(html: string): string | null {
  // Verdict card renders VERDICT_LABEL prominently. Match the four
  // canonical labels; order matters because "Ready with prep" contains
  // "Ready" as a substring.
  const labels = [
    "Not without prep or a guide",
    "Hard — stretch objective",
    "Ready with prep",
    "Ready",
  ];
  for (const l of labels) {
    if (html.includes(l)) return l;
  }
  return null;
}

function extractPeakDemandLabel(html: string): boolean {
  return /peak-week demand/.test(html);
}

function extractSuggestedAdjustmentCount(html: string): number {
  // Bullets render as `<span class="text-blue-400">▸</span>` — count the ▸.
  // RSC payload may duplicate; take half if even and > 2.
  const matches = html.match(/▸/g);
  if (!matches) return 0;
  const raw = matches.length;
  // RSC payload typically doubles them. Halve when the value is even
  // and > 2 — cheap heuristic that's right for both duplicated and
  // non-duplicated encodings.
  return raw > 2 && raw % 2 === 0 ? raw / 2 : raw;
}

function extractWeeksLine(html: string): string | null {
  const m = html.match(
    /(closing the biggest gap takes about|Beyond a single training-block horizon|Not enough recent training)[^<]{0,200}/,
  );
  return m ? m[0].slice(0, 120) : null;
}

function extractFeaturedVerdict(html: string): string | null {
  // Featured trail card renders a verdict label inside a [FEATURED]
  // block. Fall back to null if the card isn't present.
  const featured = html.match(/\[FEATURED[^\]]*\][\s\S]{0,3000}/);
  if (!featured) return null;
  return extractVerdictLabel(featured[0]);
}

function extractComplianceFromStat(html: string): number | null {
  // WILL card metric line is "N% 4-wk compliance · Kd streak".
  return numOrNull(extractFirst(html, /(\d{1,3})% 4-wk compliance/));
}

function extractComplianceFromNarrative(html: string): number | null {
  // Plan-progress LLM narrative can mention compliance in prose:
  // "plan begins with 33% compliance", "N% compliance so far", etc.
  // Search the plan-progress card region for any "X%" that reads as
  // compliance.
  const region = html.match(/\[PLAN PROGRESS\][\s\S]{0,3000}/);
  if (!region) return null;
  const m = region[0].match(/(\d{1,3})%[^<]{0,60}?compliance/);
  return m ? parseInt(m[1], 10) : null;
}

function extractTrainCompliance(html: string): number | null {
  // /train renders `<span>N<!-- -->%</span> compliance so far`.
  // React inserts template comments between the value and the
  // percent sign. Round-3 regression: onboardedAt filter reached
  // computeWill + plan-rollup but NOT this inline calc.
  return numOrNull(
    extractFirst(
      html,
      /(\d{1,3})[\s\S]{0,40}?%[\s\S]{0,80}?compliance so far/,
    ),
  );
}

function extractNextClass(html: string): string | null {
  // /progress renders `Next class: <!-- -->D<!-- --> · <!-- -->Weekend Hiker`.
  // React template comments between the label, letter and separator.
  // Off-by-one in computeRank showed the wrong letter here (Devin
  // r3: Class D user saw NEXT B, skipping C).
  return extractFirst(
    html,
    /Next class:[\s\S]{0,50}?([EDCBAS])[\s\S]{0,50}?·/,
  );
}

function extractFeaturedTrailName(html: string): string | null {
  // Home renders featured card with the trail's name below the
  // [FEATURED] label. Used to spot low-endurance-cap picks (an easy
  // 1.8-mile walk rated Hard for a class-E user, r3 flag).
  const region = html.match(/\[FEATURED[^\]]*\][\s\S]{0,600}/);
  if (!region) return null;
  return extractFirst(region[0], /class="[^"]*font-semibold[^"]*"[^>]*>([^<]{3,80})</);
}

function numOrNull(s: string | null): number | null {
  if (s == null) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

// -------- per-persona runner --------

type Checks = {
  contradictions: string[];
  values: Record<string, unknown>;
};

async function verifyPersona(p: Persona): Promise<Checks> {
  // Clean pre-existing verify user (so re-runs are idempotent).
  await db.delete(userProfile).where(eq(userProfile.email, p.email));

  const jar: Jar = new Map();
  jar.set("cold_start_seed", signSeed(p.slug, p.answers));

  // Drive the flow: test-login → onboarding/seed → home/welcome.
  const loginUrl = `${BASE}/api/auth/test-login?email=${encodeURIComponent(
    p.email,
  )}&token=${encodeURIComponent(TOKEN!)}&create=1`;
  const loginRes = await get(loginUrl, jar);
  if (loginRes.status !== 200) {
    throw new Error(
      `test-login (through /onboarding/seed) ended at status ${loginRes.status}`,
    );
  }
  if (!jar.has("basecamp_session")) {
    throw new Error(
      `session cookie not set after test-login flow — is TEST_LOGIN_TOKEN valid at ${BASE}?`,
    );
  }

  // Fetch surfaces. Order matters only for populating home_visit event.
  const home = await get(`${BASE}/`, jar);
  const progress = await get(`${BASE}/progress`, jar);
  const preset = await get(
    `${BASE}/trails/preset/${encodeURIComponent(p.slug)}`,
    jar,
  );
  const train = await get(`${BASE}/train`, jar);

  const values: Record<string, unknown> = {};

  // Home
  values.homeStatus = home.status;
  values.homeClass = extractHomeClassLetter(home.text);
  values.homeWk = extractWkFractionFinal(home.text);
  values.homeFeaturedVerdict = extractFeaturedVerdict(home.text);

  // /progress
  values.progressStatus = progress.status;
  values.progressClass = extractProgressClassLetter(progress.text);
  const end = extractStatValueAndMetric(progress.text, "END");
  const pow = extractStatValueAndMetric(progress.text, "POW");
  const will = extractStatValueAndMetric(progress.text, "WILL");
  values.progressEndValue = end.value;
  values.progressEndMetric = end.metric;
  values.progressPowValue = pow.value;
  values.progressPowMetric = pow.metric;
  values.progressWillValue = will.value;
  values.progressWillMetric = will.metric;
  values.progressStatCompliance = extractComplianceFromStat(progress.text);
  values.progressNarrativeCompliance = extractComplianceFromNarrative(
    progress.text,
  );

  // Preset
  values.presetStatus = preset.status;
  values.presetVerdict = extractVerdictLabel(preset.text);
  values.presetClass = extractPresetClassLetter(preset.text);
  values.presetPeakDemand = extractPeakDemandLabel(preset.text);
  values.presetBulletCount = extractSuggestedAdjustmentCount(preset.text);
  values.presetWeeksLine = extractWeeksLine(preset.text);

  // /train
  values.trainStatus = train.status;
  values.trainCompliance = extractTrainCompliance(train.text);

  // /progress next-class + featured refinement
  values.progressNextClass = extractNextClass(progress.text);
  values.homeFeaturedName = extractFeaturedTrailName(home.text);

  const contradictions: string[] = [];

  // ---- Consistency: same values must agree across surfaces ----
  if (
    values.homeClass &&
    values.progressClass &&
    values.homeClass !== values.progressClass
  ) {
    contradictions.push(
      `Home class '${values.homeClass}' != /progress class '${values.progressClass}'`,
    );
  }
  if (
    values.presetClass &&
    values.homeClass &&
    values.presetClass !== values.homeClass
  ) {
    contradictions.push(
      `Verdict-card class '${values.presetClass}' != Home header class '${values.homeClass}'`,
    );
  }

  if (
    values.progressStatCompliance != null &&
    values.progressNarrativeCompliance != null &&
    values.progressStatCompliance !== values.progressNarrativeCompliance
  ) {
    contradictions.push(
      `Compliance mismatch on /progress: stat card says ${values.progressStatCompliance}%, narrative says ${values.progressNarrativeCompliance}%`,
    );
  }

  if (
    values.progressStatCompliance != null &&
    values.trainCompliance != null &&
    values.progressStatCompliance !== values.trainCompliance
  ) {
    contradictions.push(
      `Compliance mismatch across surfaces: /progress says ${values.progressStatCompliance}%, /train says ${values.trainCompliance}% (Devin r3: the onboardedAt filter needs to reach /train's inline calc too)`,
    );
  }

  // Next-class letter must be exactly one above current class in the
  // ladder E→D→C→B→A→S. Devin r3: a Class D user saw "NEXT B"
  // (skipping C) after the class-floor fix landed with the wrong
  // GATES index offset.
  if (values.progressClass && values.progressNextClass) {
    const ladder = ["E", "D", "C", "B", "A", "S"];
    const curIdx = ladder.indexOf(values.progressClass as string);
    const nextIdx = ladder.indexOf(values.progressNextClass as string);
    if (curIdx >= 0 && nextIdx >= 0 && nextIdx !== curIdx + 1) {
      contradictions.push(
        `Next-class off-by-one: current ${values.progressClass}, next ${values.progressNextClass} (expected ${ladder[curIdx + 1] ?? "(none)"})`,
      );
    }
  }

  // ---- Regressions from prior Devin rounds ----
  if (typeof values.homeWk === "string" && /\/41$/.test(values.homeWk)) {
    contradictions.push(
      `Home header shows ${values.homeWk} — the "/41" pattern that keeps regressing (expected /40 for standard mountain_summit plans)`,
    );
  }

  if (values.homeFeaturedVerdict === "Not without prep or a guide") {
    contradictions.push(
      `Featured trail assessed as 'Not without prep or a guide' — the pick-vs-assess contradiction is back`,
    );
  }

  // Verdict card must show the peak-demand relabel (Amendment 2).
  if (
    values.presetStatus === 200 &&
    values.presetVerdict &&
    values.presetVerdict !== "Ready" &&
    values.presetVerdict !== "Not without prep or a guide" &&
    !values.presetPeakDemand
  ) {
    contradictions.push(
      `Verdict card missing "peak-week demand" relabel — the bare 1260-min-per-week bug may be back`,
    );
  }

  // Gap bullets: ≥2 required on any non-Ready verdict.
  if (
    values.presetVerdict &&
    values.presetVerdict !== "Ready" &&
    typeof values.presetBulletCount === "number" &&
    values.presetBulletCount < 2
  ) {
    contradictions.push(
      `Verdict card has only ${values.presetBulletCount} "How to close the gap" bullet(s); expected ≥2 for ${values.presetVerdict}`,
    );
  }

  // Weeks line: some text must render (no blank line) on any non-Ready verdict.
  if (
    values.presetVerdict &&
    values.presetVerdict !== "Ready" &&
    !values.presetWeeksLine
  ) {
    contradictions.push(
      `Verdict card has no weeks/status line for ${values.presetVerdict}`,
    );
  }

  // do_not_attempt must show the horizon copy, never the "closing
  // the biggest gap takes about N weeks" number. Devin r4 launch
  // blocker: Sarah's Rainier read "Not without prep or a guide" and
  // "closing the biggest gap takes about 4 weeks" on the same card,
  // because estimateWeeksToReady returned a small number when
  // worstRatio wasn't near-zero. The engine now returns null on
  // do_not_attempt regardless of ratio — this check will catch any
  // regression at the display layer too.
  if (
    values.presetVerdict === "Not without prep or a guide" &&
    typeof values.presetWeeksLine === "string" &&
    values.presetWeeksLine.includes("closing the biggest gap")
  ) {
    contradictions.push(
      `do_not_attempt verdict rendering "closing the biggest gap" weeks line — should be the "Beyond a single training-block horizon" fallback`,
    );
  }

  // ---- Per-persona baseline expectations ----
  if (
    values.presetVerdict &&
    !verdictMatches(values.presetVerdict as string, p.expect.verdict)
  ) {
    contradictions.push(
      `Verdict '${values.presetVerdict}' doesn't match expected '${p.expect.verdict}' for ${p.name}`,
    );
  }
  if (
    values.progressClass &&
    values.progressClass !== p.expect.rankLetter
  ) {
    contradictions.push(
      `/progress class '${values.progressClass}' != expected '${p.expect.rankLetter}' for ${p.name}`,
    );
  }
  if (
    p.expect.endMustBeNonZero &&
    typeof values.progressEndValue === "number" &&
    values.progressEndValue === 0
  ) {
    contradictions.push(
      `${p.name}: /progress END=0 but baseline should lift it — parallel-systems drift (Round-2 regression)`,
    );
  }
  if (
    p.expect.powMustBeNonZero &&
    typeof values.progressPowValue === "number" &&
    values.progressPowValue === 0
  ) {
    contradictions.push(
      `${p.name}: /progress POW=0 but baseline should lift it — parallel-systems drift (Round-2 regression)`,
    );
  }

  // Cleanup
  await db.delete(userProfile).where(eq(userProfile.email, p.email));

  return { values, contradictions };
}

function verdictMatches(actual: string, expected: string): boolean {
  const map: Record<string, string> = {
    comfortable: "Ready",
    achievable: "Ready with prep",
    hard: "Hard — stretch objective",
    do_not_attempt: "Not without prep or a guide",
  };
  return actual === map[expected];
}

// -------- main --------

async function main() {
  console.log(`\nverify-personas against ${BASE}\n`);
  const results: Array<{ persona: Persona; checks: Checks }> = [];
  for (const p of PERSONAS) {
    console.log(`— ${p.name} @ ${p.slug}`);
    try {
      const checks = await verifyPersona(p);
      results.push({ persona: p, checks });
      const nContra = checks.contradictions.length;
      console.log(
        `  ${nContra === 0 ? "✓" : "✗"} ${nContra} contradiction${nContra === 1 ? "" : "s"}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ RUN ERROR: ${msg}`);
      results.push({
        persona: p,
        checks: { values: {}, contradictions: [`RUN ERROR: ${msg}`] },
      });
    }
  }

  console.log("\n=== values ===");
  for (const { persona, checks } of results) {
    console.log(`\n${persona.name}:`);
    for (const [k, v] of Object.entries(checks.values)) {
      console.log(`  ${k.padEnd(30)} ${JSON.stringify(v)}`);
    }
  }

  console.log("\n=== contradictions ===");
  let total = 0;
  for (const { persona, checks } of results) {
    if (checks.contradictions.length === 0) continue;
    console.log(`\n${persona.name}:`);
    for (const c of checks.contradictions) {
      console.log(`  ✗ ${c}`);
      total += 1;
    }
  }
  if (total === 0) {
    console.log("(none)");
  }

  if (total > 0) {
    console.error(`\n✗ ${total} contradiction(s) across ${results.length} personas`);
    process.exit(1);
  }
  console.log(`\n✓ All ${results.length} personas passed`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
