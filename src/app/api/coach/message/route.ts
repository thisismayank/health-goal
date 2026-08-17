import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { coachMessage } from "@/db/schema";
import { requireCurrentUser } from "@/lib/data";
import {
  getCredsForRequest,
  markUsed,
} from "@/lib/llm/credentials";
import { getAdapter } from "@/lib/llm/providers";
import { buildCoachSystem } from "@/lib/llm/coach-context";
import { maybeRegenerate } from "@/lib/coach/summary";

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

  // Persist the incoming user turn immediately so a stream that fails
  // mid-generation still keeps the user's question in the transcript.
  // If the assistant reply comes back empty (Devin r3 #2 — provider
  // returns success with zero content), we roll this row back below so
  // orphan user turns don't accumulate.
  const [userTurn] = await db
    .insert(coachMessage)
    .values({
      userId: user.id,
      role: "user",
      content: text,
    })
    .returning({ id: coachMessage.id });

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
          // Fire-and-forget summary regeneration. Non-blocking so the
          // SSE closes immediately after 'done'.
          void maybeRegenerate(user.id);
          emit({ kind: "done", tokensIn, tokensOut });
        } else {
          // Empty completion. Providers occasionally return success
          // with zero content (safety refusal, model glitch, upstream
          // truncation). Old code emitted 'done' anyway → client spun
          // forever on an empty assistant bubble AND we left an orphan
          // user turn in the transcript.
          //
          // Fix: emit 'error' so the client shows retry, and roll back
          // the user turn we speculatively persisted so the next send
          // doesn't ship an ever-growing history of unanswered turns.
          await db
            .delete(coachMessage)
            .where(
              and(
                eq(coachMessage.id, userTurn.id),
                eq(coachMessage.userId, user.id),
              ),
            );
          emit({
            kind: "error",
            message:
              "The provider returned an empty response. Try again — this often clears on retry.",
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "stream_failed";
        console.error("[coach] stream error:", msg);
        // Same orphan-cleanup on hard errors, unless we already
        // streamed partial content (in which case leave both turns
        // so the user sees what came through).
        if (assembled.length === 0) {
          await db
            .delete(coachMessage)
            .where(
              and(
                eq(coachMessage.id, userTurn.id),
                eq(coachMessage.userId, user.id),
              ),
            );
        }
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
