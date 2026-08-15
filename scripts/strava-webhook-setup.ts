import { db } from "../src/db/client";
import { stravaWebhookSubscription } from "../src/db/schema";
import {
  createSubscription,
  deleteSubscription,
  listSubscriptions,
} from "../src/lib/strava/client";

const callbackUrl =
  process.argv[2] ??
  "https://rainier-companion.vercel.app/api/strava/webhook";

const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;

async function main() {
  if (!verifyToken) throw new Error("STRAVA_WEBHOOK_VERIFY_TOKEN not set");
  console.log(`target callback: ${callbackUrl}`);

  const existing = await listSubscriptions();
  console.log(`existing subscriptions: ${existing.length}`);
  for (const sub of existing) {
    console.log(`  id=${sub.id} url=${sub.callback_url}`);
  }

  // Delete any mismatched subscriptions (Strava allows only one per app).
  for (const sub of existing) {
    if (sub.callback_url !== callbackUrl) {
      console.log(`deleting stale subscription ${sub.id}`);
      await deleteSubscription(sub.id);
    }
  }

  const matched = existing.find((s) => s.callback_url === callbackUrl);
  if (matched) {
    console.log(`subscription already matches: id=${matched.id}`);
    return;
  }

  console.log("creating subscription…");
  const { id } = await createSubscription(callbackUrl, verifyToken);
  console.log(`created subscription id=${id}`);

  await db.insert(stravaWebhookSubscription).values({
    subscriptionId: id,
    callbackUrl,
    verifyToken,
  });
  console.log("recorded in DB");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
