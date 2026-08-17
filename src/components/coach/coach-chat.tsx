"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  id: number | string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
};

const SUGGESTIONS = [
  "Am I on track this week?",
  "I'm sore in the legs — should I move tomorrow's session?",
  "What should I prioritize for the next 4 weeks?",
  "Explain today's workout — why this and not intervals?",
];

export function CoachChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load history on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/coach/history", { cache: "no-store" });
        const body = (await res.json()) as {
          ok: boolean;
          messages?: Message[];
        };
        if (!cancelled && body.ok && body.messages) {
          setMessages(body.messages);
        }
      } catch {
        // Silent — user can still send.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Autoscroll to bottom on new message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async (bodyText: string) => {
    if (sending || !bodyText.trim()) return;
    const trimmed = bodyText.trim();
    setError(null);
    setSending(true);
    const nowKey = `local-${Date.now()}`;
    setMessages((m) => [
      ...m,
      { id: `${nowKey}-u`, role: "user", content: trimmed },
      { id: `${nowKey}-a`, role: "assistant", content: "", pending: true },
    ]);
    setText("");

    try {
      const res = await fetch("/api/coach/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const chunk = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const dataLine = chunk
            .split("\n")
            .find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          try {
            const evt = JSON.parse(dataLine.slice(5).trim()) as {
              kind: string;
              text?: string;
              message?: string;
            };
            if (evt.kind === "delta" && evt.text) {
              setMessages((m) => {
                const clone = [...m];
                const last = clone[clone.length - 1];
                if (last?.role === "assistant") {
                  clone[clone.length - 1] = {
                    ...last,
                    content: last.content + evt.text,
                    pending: true,
                  };
                }
                return clone;
              });
            } else if (evt.kind === "done") {
              setMessages((m) => {
                const clone = [...m];
                const last = clone[clone.length - 1];
                if (last?.role === "assistant") {
                  clone[clone.length - 1] = { ...last, pending: false };
                }
                return clone;
              });
            } else if (evt.kind === "error") {
              throw new Error(evt.message ?? "stream error");
            }
          } catch (parseErr) {
            // eat individual bad chunks
            console.warn("[coach] bad SSE frame", parseErr);
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Send failed";
      setError(msg);
      setMessages((m) => {
        const clone = [...m];
        const last = clone[clone.length - 1];
        if (last?.role === "assistant" && last.pending && !last.content) {
          clone.pop();
        }
        return clone;
      });
    } finally {
      setSending(false);
    }
  };

  const clearHistory = async () => {
    if (!confirm("Wipe the coach chat history?")) return;
    await fetch("/api/coach/history", { method: "DELETE" });
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-14rem)] min-h-[400px]">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 pr-1 -mr-1"
      >
        {loaded && messages.length === 0 && (
          <div className="rounded-md border border-panel-border bg-panel/40 p-4 space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400">
              [FIRST MESSAGE]
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">
              Ask anything about your plan, today&apos;s session, a trail
              you&apos;re eyeing, or how a workout felt. The coach sees your
              plan, recent workouts, and readiness signal.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  disabled={sending}
                  className="text-xs px-2.5 py-1 rounded-full border border-panel-border text-muted hover:text-blue-200 hover:border-blue-500/40 transition disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </div>

      {error && (
        <p className="text-xs text-danger py-1" role="alert">
          {error}
        </p>
      )}

      <form
        className="flex items-end gap-2 pt-2 border-t border-panel-border/60"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(text);
            }
          }}
          placeholder="Ask the coach…"
          rows={2}
          className="flex-1 min-h-[42px] max-h-40 rounded-md bg-panel border border-panel-border px-3 py-2 text-sm resize-none focus:border-blue-500/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="rounded-md bg-accent-strong hover:bg-accent text-background font-medium text-sm px-4 py-2 disabled:opacity-50 shrink-0"
        >
          {sending ? "…" : "Send"}
        </button>
      </form>

      {messages.length > 0 && (
        <div className="pt-2 flex items-center justify-end">
          <button
            type="button"
            onClick={clearHistory}
            disabled={sending}
            className="text-[11px] text-muted hover:text-danger underline underline-offset-4 disabled:opacity-50"
          >
            Clear history
          </button>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
          isUser
            ? "bg-blue-500/20 text-blue-100 border border-blue-500/30"
            : "bg-panel border border-panel-border text-foreground/90"
        }`}
      >
        {message.content ||
          (message.pending ? (
            <span className="inline-flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse [animation-delay:300ms]" />
            </span>
          ) : null)}
      </div>
    </div>
  );
}
