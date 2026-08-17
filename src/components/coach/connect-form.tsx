"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { disconnectLlm, saveLlmCredentials } from "@/lib/actions";

type Provider = "anthropic" | "openai" | "gemini";

const PROVIDER_META: Record<
  Provider,
  { label: string; defaultModel: string; docsUrl: string; keyPlaceholder: string }
> = {
  anthropic: {
    label: "Anthropic (Claude)",
    defaultModel: "claude-sonnet-4-5",
    docsUrl: "https://console.anthropic.com/settings/keys",
    keyPlaceholder: "sk-ant-...",
  },
  openai: {
    label: "OpenAI (GPT)",
    defaultModel: "gpt-4o-mini",
    docsUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-...",
  },
  gemini: {
    label: "Google (Gemini)",
    defaultModel: "gemini-1.5-flash-latest",
    docsUrl: "https://aistudio.google.com/apikey",
    keyPlaceholder: "AI...",
  },
};

export function CoachConnectForm({
  existing,
}: {
  existing: {
    provider: Provider;
    apiKeyLast4: string;
    modelId: string | null;
  } | null;
}) {
  const router = useRouter();
  const [provider, setProvider] = useState<Provider>(existing?.provider ?? "anthropic");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState<string>(existing?.modelId ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const meta = PROVIDER_META[provider];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);
    startTransition(async () => {
      const r = await saveLlmCredentials({
        provider,
        apiKey,
        modelId: model.trim() || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOk("Coach connected. Try it on /coach.");
      setApiKey("");
      router.refresh();
    });
  };

  const disconnect = () => {
    setError(null);
    startTransition(async () => {
      await disconnectLlm();
      setConfirming(false);
      router.refresh();
    });
  };

  return (
    <div className="rounded-lg border border-panel-border bg-panel p-4 space-y-3">
      <div>
        <div className="font-medium">Coach LLM</div>
        <div className="text-xs text-muted mt-1">
          Bring your own API key. Nothing runs through our billing —
          you pay the provider directly, capped by the limits on your
          key. We only decrypt it server-side when the coach is actually
          answering; the last 4 chars are all we ever display.
        </div>
      </div>

      {existing ? (
        <div className="rounded-md border border-accent/50 bg-accent-strong/5 p-3 space-y-2">
          <div className="text-sm">
            <span className="text-accent font-mono">✓</span> Connected to{" "}
            <span className="font-medium">
              {PROVIDER_META[existing.provider].label}
            </span>
            <span className="text-muted">
              {" "}
              · key ••••{existing.apiKeyLast4}
              {existing.modelId && ` · model ${existing.modelId}`}
            </span>
          </div>
          {confirming ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-warn">
                This deletes your saved key. Chat history stays.
              </span>
              <button
                type="button"
                onClick={disconnect}
                disabled={pending}
                className="text-xs bg-danger/80 hover:bg-danger text-background rounded-md px-2 py-1 disabled:opacity-50"
              >
                {pending ? "Removing…" : "Confirm"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="text-xs text-muted hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-xs text-muted hover:text-danger underline underline-offset-4"
            >
              Disconnect / replace key
            </button>
          )}
        </div>
      ) : null}

      <form onSubmit={submit} className="space-y-3">
        <fieldset>
          <legend className="text-[10px] font-mono uppercase tracking-widest text-muted mb-1.5">
            Provider
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(Object.keys(PROVIDER_META) as Provider[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProvider(p)}
                className={`text-left rounded-md border px-3 py-2 transition ${
                  provider === p
                    ? "border-blue-400 bg-blue-950/40"
                    : "border-panel-border bg-background/40 hover:border-blue-500/40"
                }`}
              >
                <div className="text-sm font-medium">
                  {PROVIDER_META[p].label}
                </div>
                <div className="text-[11px] text-muted mt-0.5">
                  Default model {PROVIDER_META[p].defaultModel}
                </div>
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
            API key
          </span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={meta.keyPlaceholder}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-md bg-background border border-panel-border px-3 py-2 text-sm font-mono focus:border-blue-500/50 focus:outline-none"
          />
          <span className="block text-[11px] text-muted pt-0.5">
            🔒 AES-256-GCM encrypted before storage. Get one at{" "}
            <a
              className="text-blue-300 hover:underline"
              href={meta.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {meta.docsUrl.replace(/^https?:\/\//, "")}
            </a>
            .
          </span>
        </label>

        <label className="block space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted">
            Model (optional)
          </span>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={`default: ${meta.defaultModel}`}
            className="w-full rounded-md bg-background border border-panel-border px-3 py-2 text-sm font-mono focus:border-blue-500/50 focus:outline-none"
          />
        </label>

        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        {ok && <p className="text-sm text-accent">{ok}</p>}

        <button
          type="submit"
          disabled={pending || !apiKey.trim()}
          className="rounded-md bg-accent-strong hover:bg-accent text-background font-medium text-sm px-4 py-2 disabled:opacity-50"
        >
          {pending ? "Saving…" : existing ? "Update →" : "Connect →"}
        </button>
      </form>
    </div>
  );
}
