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
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(
      `\n[magic-link] Resend not configured. Send this to ${to} manually:\n  ${link}\n`,
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
      "Tap the link below to sign in to Basecamp:",
      link,
      "",
      "This link expires in 15 minutes and can only be used once.",
      "",
      "If you didn't request this, ignore this email.",
    ].join("\n"),
    html: renderHtml(link),
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

function renderHtml(link: string): string {
  return `<!doctype html>
<html>
<body style="font-family:-apple-system,system-ui,sans-serif;background:#0a0b0d;color:#e8eaed;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;padding:24px;background:#14161a;border:1px solid #23262c;border-radius:8px">
    <div style="font-family:ui-monospace,monospace;font-size:11px;letter-spacing:0.15em;color:#7dd3fc;text-transform:uppercase">
      [SIGN-IN LINK]
    </div>
    <h1 style="font-size:18px;margin:12px 0 8px 0">Tap to sign in to Basecamp</h1>
    <p style="color:#9aa0a6;font-size:14px;line-height:1.5;margin:0 0 20px 0">
      Expires in 15 minutes. One-time use.
    </p>
    <a href="${link}" style="display:inline-block;background:#4fa552;color:#0a0b0d;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:500">
      Sign in →
    </a>
    <p style="color:#9aa0a6;font-size:12px;margin-top:24px">
      Or paste this URL: <br/>
      <span style="word-break:break-all;color:#7dd3fc">${link}</span>
    </p>
    <p style="color:#9aa0a6;font-size:12px;margin-top:24px;border-top:1px solid #23262c;padding-top:16px">
      Didn't request this? Ignore this email — nothing will happen.
    </p>
  </div>
</body>
</html>`;
}
