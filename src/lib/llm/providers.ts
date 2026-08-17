/**
 * Provider abstraction for the coach chat. Every provider adapter
 * implements streamChat() which yields text deltas. The chat route
 * doesn't care which LLM is behind it; the user's stored credential
 * decides.
 *
 * Two providers ship in MVP: Anthropic (Claude) and OpenAI (GPT).
 * Gemini is deferred — we already use the Google API for narrative
 * generation server-side; folding it into user-provided chat can
 * come later.
 */

import type { LlmProvider } from "@/db/schema";

export type ChatRole = "system" | "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };

export type StreamChunk =
  | { kind: "delta"; text: string }
  | { kind: "usage"; tokensIn: number; tokensOut: number }
  | { kind: "error"; message: string };

export type ChatStreamOptions = {
  apiKey: string;
  modelId?: string; // provider default when omitted
  system: string;
  messages: ChatMessage[]; // user/assistant only (system passed separately)
  maxTokens?: number;
};

export type ProviderAdapter = {
  provider: LlmProvider;
  defaultModel: string;
  displayName: string;
  keyPattern: RegExp; // sanity check on paste
  /**
   * Streams the assistant reply as a series of chunks. Callers consume
   * with `for await`. Throws on network / auth errors before yielding
   * anything; per-chunk errors surface as { kind: 'error' } deltas.
   */
  streamChat: (opts: ChatStreamOptions) => AsyncIterable<StreamChunk>;
};

// ------------- Anthropic (Claude) -------------

const anthropic: ProviderAdapter = {
  provider: "anthropic",
  defaultModel: "claude-sonnet-4-5",
  displayName: "Anthropic (Claude)",
  keyPattern: /^sk-ant-[\w-]{20,}$/,
  async *streamChat({ apiKey, modelId, system, messages, maxTokens = 1024 }) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelId ?? anthropic.defaultModel,
        max_tokens: maxTokens,
        system,
        stream: true,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new Error(`Anthropic ${res.status}: ${text.slice(0, 200)}`);
    }
    yield* parseSse(res.body, (event) => {
      const data = event.data as Record<string, unknown> | null;
      if (!data) return null;
      if (event.event === "content_block_delta") {
        const d = data.delta as { type?: string; text?: string } | undefined;
        if (d?.type === "text_delta" && typeof d.text === "string") {
          return { kind: "delta", text: d.text };
        }
      }
      if (event.event === "message_delta") {
        const usage = data.usage as
          | { input_tokens?: number; output_tokens?: number }
          | undefined;
        if (usage) {
          return {
            kind: "usage",
            tokensIn: usage.input_tokens ?? 0,
            tokensOut: usage.output_tokens ?? 0,
          };
        }
      }
      return null;
    });
  },
};

// ------------- OpenAI (GPT) -------------

const openai: ProviderAdapter = {
  provider: "openai",
  defaultModel: "gpt-4o-mini",
  displayName: "OpenAI (GPT)",
  keyPattern: /^sk-[\w-]{20,}$/,
  async *streamChat({ apiKey, modelId, system, messages, maxTokens = 1024 }) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId ?? openai.defaultModel,
        stream: true,
        stream_options: { include_usage: true },
        max_completion_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenAI ${res.status}: ${text.slice(0, 200)}`);
    }
    yield* parseSse(res.body, (event) => {
      // OpenAI uses `data: ...` lines but no `event:` field. Our
      // parser handles either — event.event will be undefined here.
      const data = event.data as
        | {
            choices?: Array<{ delta?: { content?: string } }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number };
          }
        | null;
      if (!data) return null;
      const delta = data.choices?.[0]?.delta?.content;
      if (delta) {
        return { kind: "delta", text: delta };
      }
      if (data.usage) {
        return {
          kind: "usage",
          tokensIn: data.usage.prompt_tokens ?? 0,
          tokensOut: data.usage.completion_tokens ?? 0,
        };
      }
      return null;
    });
  },
};

// ------------- Google (Gemini) -------------

const gemini: ProviderAdapter = {
  provider: "gemini",
  defaultModel: "gemini-2.0-flash-exp",
  displayName: "Google (Gemini)",
  keyPattern: /^AI[\w-]{35,}$/,
  async *streamChat({ apiKey, modelId, system, messages, maxTokens = 1024 }) {
    const model = modelId ?? gemini.defaultModel;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

    // Gemini uses "parts" content and distinct system_instruction.
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: system }] },
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new Error(`Gemini ${res.status}: ${text.slice(0, 200)}`);
    }
    yield* parseSse(res.body, (event) => {
      const data = event.data as
        | {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
            usageMetadata?: {
              promptTokenCount?: number;
              candidatesTokenCount?: number;
            };
          }
        | null;
      if (!data) return null;
      const text = data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? "")
        .join("");
      if (text) return { kind: "delta", text };
      if (data.usageMetadata) {
        return {
          kind: "usage",
          tokensIn: data.usageMetadata.promptTokenCount ?? 0,
          tokensOut: data.usageMetadata.candidatesTokenCount ?? 0,
        };
      }
      return null;
    });
  },
};

const ADAPTERS: Record<LlmProvider, ProviderAdapter> = {
  anthropic,
  openai,
  gemini,
};

export function getAdapter(provider: LlmProvider): ProviderAdapter {
  return ADAPTERS[provider];
}

export function allAdapters(): ProviderAdapter[] {
  return Object.values(ADAPTERS);
}

// ------------- Shared SSE parser -------------

type SseEvent = {
  event?: string;
  // `data` is JSON.parse'd; SSE frames without JSON come through as
  // strings and are ignored.
  data: unknown;
};

async function* parseSse(
  body: ReadableStream<Uint8Array>,
  extract: (event: SseEvent) => StreamChunk | null,
): AsyncIterable<StreamChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE events end with a blank line
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const evt = parseSseFrame(raw);
        if (!evt) continue;
        if (typeof evt.data === "string" && evt.data === "[DONE]") continue;
        const chunk = extract(evt);
        if (chunk) yield chunk;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseSseFrame(raw: string): SseEvent | null {
  let event: string | undefined;
  const dataLines: string[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  const dataStr = dataLines.join("\n");
  try {
    return { event, data: JSON.parse(dataStr) };
  } catch {
    return { event, data: dataStr };
  }
}
