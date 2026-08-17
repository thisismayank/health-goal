import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { coachMessage } from "@/db/schema";
import { requireCurrentUser } from "@/lib/data";
import {
  getCredsForRequest,
  markUsed,
} from "@/lib/llm/credentials";
import { getAdapter } from "@/lib/llm/providers";
import { buildCoachSystem } from "@/lib/llm/coach-context";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // stream up to 60s

/**
 * Coach chat streaming endpoint.
 *
 * Contract:
 *   POST body: { text: string }
 *   Response: text/event-stream with lines like:
 *     data: {"kind":"delta","text":"...token..."}
 *     data: {"kind":"done"}
 *     data: {"kind":"error","message":"..."}
 *
 * History is loaded from DB (coach_message) — the client doesn't need
 * to echo it back. On completion the assistant reply is persisted so
 * the next request picks it up automatically.
 */
export async function POST(req: Request) {
  const user = await requireCurrentUser();
  const body = (await req.json().catch(() => null)) as {
    text?: string;
  } | null;
  const text = body?.text?.trim();
  if (!text) {
    return NextResponse.json(
      { ok: false, error: "empty_message" },
      { status: 400 },
    );
  }
  if (text.length > 4000) {
    return NextResponse.json(
      { ok: false, error: "message_too_long" },
      { status: 400 },
    );
  }

  const creds = await getCredsForRequest(user.id);
  if (!creds) {
    return NextResponse.json(
      { ok: false, error: "no_provider_configured" },
      { status: 400 },
    );
  }

  const adapter = getAdapter(creds.provider);
  const system = await buildCoachSystem(user);

  // Load prior turns (last 40) so context includes conversation history
  // without unbounded growth.
  const prior = await db
    .select({
      role: coachMessage.role,
      content: coachMessage.content,
    })
    .from(coachMessage)
    .where(eq(coachMessage.userId, user.id))
    .orderBy(asc(coachMessage.createdAt));
  const trimmed = prior.slice(-40);

  // Persist the incoming user turn immediately.
  await db.insert(coachMessage).values({
    userId: user.id,
    role: "user",
    content: text,
  });

  const messages = [...trimmed, { role: "user" as const, content: text }];

  const encoder = new TextEncoder();
  let assembled = "";
  let tokensIn = 0;
  let tokensOut = 0;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (obj: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(obj)}\n\n`),
        );
      };
      try {
        for await (const chunk of adapter.streamChat({
          apiKey: creds.apiKey,
          modelId: creds.modelId ?? undefined,
          system,
          messages,
        })) {
          if (chunk.kind === "delta") {
            assembled += chunk.text;
            emit({ kind: "delta", text: chunk.text });
          } else if (chunk.kind === "usage") {
            tokensIn = chunk.tokensIn;
            tokensOut = chunk.tokensOut;
          } else if (chunk.kind === "error") {
            emit({ kind: "error", message: chunk.message });
          }
        }
        // Persist the assistant reply on completion. If nothing was
        // yielded (upstream produced no deltas), skip.
        if (assembled.length > 0) {
          await db.insert(coachMessage).values({
            userId: user.id,
            role: "assistant",
            content: assembled,
            provider: creds.provider,
            modelId: creds.modelId ?? adapter.defaultModel,
            tokensIn: tokensIn || null,
            tokensOut: tokensOut || null,
          });
          await markUsed(user.id);
        }
        emit({ kind: "done", tokensIn, tokensOut });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "stream_failed";
        console.error("[coach] stream error:", msg);
        emit({ kind: "error", message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
