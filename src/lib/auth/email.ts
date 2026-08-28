/**
 * Magic-link email sender.
 *
 * Tries Resend if RESEND_API_KEY is set; otherwise falls back to logging
 * the link to the server console (dev/self-hosted mode). Never throws —
 * failed sends still return, and the caller can decide what to do.
 */

type SendResult =
  | { ok: true; via: "resend" }
  | { ok: true; via: "console"; link: string }
  | { ok: false; via: "resend"; error: string };

const FROM_ADDRESS =
  process.env.MAGIC_LINK_FROM ?? "Basecamp <onboarding@resend.dev>";

export async function sendMagicLinkEmail(
  to: string,
  link: string,
  code: string,
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(
      `\n[magic-link] Resend not configured. Send this to ${to} manually:\n  Link: ${link}\n  Code: ${code}\n`,
    );
    return { ok: true, via: "console", link };
  }

  const body = {
    from: FROM_ADDRESS,
    to,
    subject: "Your Basecamp sign-in link",
    text: [
      "Hi,",
      "",
      `Your 6-digit sign-in code: ${code}`,
      "",
      "Type it on the sign-in page (best on mobile), or tap the link:",
      link,
      "",
      "Code and link both expire in 15 minutes. One use each.",
      "",
      "If you didn't request this, ignore this email.",
    ].join("\n"),
    html: renderHtml(link, code),
  };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[magic-link] Resend failed ${res.status}: ${errText}`);
      return { ok: false, via: "resend", error: errText || `${res.status}` };
    }
    return { ok: true, via: "resend" };
  } catch (err) {
    console.error("[magic-link] Resend threw:", err);
    return {
      ok: false,
      via: "resend",
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

function renderHtml(link: string, code: string): string {
  return `<!doctype html>
<html>
<body style="font-family:-apple-system,system-ui,sans-serif;background:#0a0b0d;color:#e8eaed;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;padding:24px;background:#14161a;border:1px solid #23262c;border-radius:8px">
    <div style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:0.15em;color:#7dd3fc;text-transform:uppercase">
      [SIGN-IN CODE]
    </div>
    <h1 style="font-size:18px;margin:12px 0 8px 0">Your 6-digit code</h1>
    <div style="font-family:ui-monospace,monospace;font-size:32px;letter-spacing:0.4em;color:#e8eaed;background:#0a0b0d;border:1px solid #23262c;border-radius:6px;padding:16px 20px;margin:12px 0 8px 0;text-align:center;font-weight:600">
      ${code}
    </div>
    <p style="color:#9aa0a6;font-size:13px;line-height:1.5;margin:0 0 20px 0">
      Type this on the sign-in page you left open. Works best on mobile — avoids the browser jump.
    </p>
    <p style="color:#9aa0a6;font-size:12px;line-height:1.5;margin:20px 0 8px 0;border-top:1px solid #23262c;padding-top:16px">
      Or tap the link:
    </p>
    <a href="${link}" style="display:inline-block;background:#4fa552;color:#0a0b0d;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:500">
      Sign in →
    </a>
    <p style="color:#9aa0a6;font-size:12px;margin-top:16px">
      <span style="word-break:break-all;color:#7dd3fc">${link}</span>
    </p>
    <p style="color:#9aa0a6;font-size:12px;margin-top:24px;border-top:1px solid #23262c;padding-top:16px">
      Code and link both expire in 15 minutes. One use each. Didn't request this? Ignore — nothing will happen.
    </p>
  </div>
</body>
</html>`;
}
