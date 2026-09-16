import { Sendsprite } from "sendsprite";

/**
 * Transactional email through Sendsprite (defy.works' own SES-backed API).
 * `SENDSPRITE_API_KEY` selects the hosted instance; `SENDSPRITE_URL` points
 * at a self-hosted one. Without a key, emails are logged instead of sent so
 * local development still works (the link is printed to the server log).
 */
const apiKey = process.env.SENDSPRITE_API_KEY;
// Explicit default: the SDK also reads SENDSPRITE_URL itself and would take an
// empty string from the container env as a (broken) base URL.
const client = apiKey
  ? new Sendsprite({ apiKey, baseUrl: process.env.SENDSPRITE_URL?.trim() || "https://sendsprite.com" })
  : null;

export const emailEnabled = Boolean(client);

const FROM = process.env.EMAIL_FROM ?? "Artifacts <artifacts@defy.works>";
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Lets Sendsprite dedupe a retried send. */
  idempotencyKey?: string;
  tags?: Record<string, string>;
}

export async function sendEmail(mail: Mail): Promise<{ id: string | null }> {
  if (!client) {
    console.log(`[email:dev] to=${mail.to} subject=${JSON.stringify(mail.subject)}\n${mail.text}`);
    return { id: null };
  }
  const { id } = await client.emails.send({
    from: FROM,
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    idempotencyKey: mail.idempotencyKey,
    tags: mail.tags,
  });
  return { id };
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * One layout for every message: ink background, indigo button, mono stamp
 * label — the defy.works tokens reduced to what email clients render.
 */
export function layout(opts: { eyebrow: string; title: string; body: string; cta: { label: string; url: string }; footer?: string }) {
  const { eyebrow, title, body, cta, footer } = opts;
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title></head>
<body style="margin:0;padding:0;background:#000000;color:#ffffff;font-family:'Space Grotesk',ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#000000;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;">
        <tr><td style="padding:0 0 24px;font-size:13px;letter-spacing:-0.01em;">
          <span style="font-weight:700;">defy.works</span> <span style="color:rgba(255,255,255,0.3);">/</span> <span style="color:rgba(255,255,255,0.6);">artifacts</span>
        </td></tr>
        <tr><td style="background:#0a0a0a;border:1px solid rgba(255,255,255,0.14);border-radius:12px;padding:32px 28px;">
          <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:#a5b4fc;">${escape(eyebrow)}</div>
          <h1 style="margin:12px 0 0;font-size:26px;line-height:1.15;letter-spacing:-0.03em;font-weight:700;color:#ffffff;">${escape(title)}</h1>
          <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.65);">${escape(body)}</p>
          <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 0;"><tr><td style="background:#6366f1;border-radius:8px;">
            <a href="${escape(cta.url)}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${escape(cta.label)}</a>
          </td></tr></table>
          <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:rgba(255,255,255,0.4);word-break:break-all;">Or paste this link into your browser:<br><a href="${escape(cta.url)}" style="color:#a5b4fc;">${escape(cta.url)}</a></p>
        </td></tr>
        <tr><td style="padding:20px 4px 0;font-size:11px;line-height:1.6;color:rgba(255,255,255,0.35);">${escape(footer ?? `Sent by Artifacts at ${SITE}. If you didn't request this, you can ignore it.`)}</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  const text = `${eyebrow}\n\n${title}\n\n${body}\n\n${cta.label}: ${cta.url}\n\n${footer ?? `Sent by Artifacts at ${SITE}. If you didn't request this, you can ignore it.`}`;
  return { html, text };
}

export function magicLinkMail(to: string, url: string): Mail {
  const { html, text } = layout({
    eyebrow: "Sign in",
    title: "Your sign-in link",
    body: "Click the button to sign in to Artifacts. The link works once and expires in 10 minutes.",
    cta: { label: "Sign in to Artifacts", url },
  });
  return { to, subject: "Sign in to Artifacts", html, text, tags: { kind: "magic-link" } };
}

export function shareInviteMail(to: string, opts: { inviter: string; title: string; role: string; url: string }): Mail {
  const { html, text } = layout({
    eyebrow: "Shared with you",
    title: opts.title,
    body: `${opts.inviter} gave you ${opts.role} access to this artifact. Sign in with this email address to open it.`,
    cta: { label: "Open artifact", url: opts.url },
  });
  return { to, subject: `${opts.inviter} shared "${opts.title}" with you`, html, text, tags: { kind: "share" } };
}
