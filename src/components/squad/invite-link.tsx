"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { leaveSquad, regenerateSquadInviteToken } from "@/lib/actions";

export function SquadInviteLink({
  squadId,
  inviteToken,
  isAdmin,
}: {
  squadId: number;
  inviteToken: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [token, setToken] = useState(inviteToken);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const [origin, setOrigin] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const url = token && origin ? `${origin}/squad/join/${token}` : "";

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fall through
    }
  };

  const regenerate = () => {
    if (!confirm("Regenerate the invite link? Old link stops working immediately.")) return;
    startTransition(async () => {
      try {
        const res = await regenerateSquadInviteToken(squadId);
        setToken(res.token);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed");
      }
    });
  };

  const leave = () => {
    if (!confirm("Leave this squad? You can re-join if you have the invite link.")) return;
    startTransition(async () => {
      await leaveSquad(squadId);
      router.push("/squad");
    });
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-blue-500/40 bg-blue-950/10 p-4 space-y-2">
        <div className="text-[10px] font-mono uppercase tracking-widest text-blue-300">
          [INVITE LINK]
        </div>
        {url ? (
          <>
            <div className="rounded bg-background/60 border border-panel-border px-3 py-2 text-xs font-mono break-all text-blue-200">
              {url}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copy}
                className="rounded-md bg-accent-strong text-background text-sm font-medium px-3 py-1.5 hover:bg-accent transition"
              >
                {copied ? "Copied ✓" : "Copy link"}
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={regenerate}
                  disabled={pending}
                  className="rounded-md border border-panel-border text-sm text-muted hover:text-foreground px-3 py-1.5 disabled:opacity-50"
                >
                  {pending ? "…" : "Regenerate"}
                </button>
              )}
            </div>
            <p className="text-[10px] text-muted">
              Anyone with this link can join (max 8 members per squad).
              Regenerate to revoke a link you shared by mistake.
            </p>
          </>
        ) : (
          <p className="text-xs text-muted">
            Invites disabled.{" "}
            {isAdmin && (
              <button
                type="button"
                onClick={regenerate}
                className="text-blue-300 hover:underline"
              >
                Generate a new link
              </button>
            )}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={leave}
        disabled={pending}
        className="text-xs text-muted hover:text-danger transition disabled:opacity-50"
      >
        Leave squad
      </button>
    </div>
  );
}
