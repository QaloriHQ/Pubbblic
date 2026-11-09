// Pubbblic organization invitations: transactional email only, never account provisioning.
// Supabase Auth verifies identity; private.accept_invitation_impl grants membership.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sendLimit = 5;
const attemptLimit = 10;
const cooldownMs = 120_000;
const defaultPreviewOrigin = "https://pubbblic-platform-l4wivtuci-qaloris-projects.vercel.app";
const respond = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers });

function pickKey(variable: string, legacy: string): string | undefined {
  try {
    const raw = Deno.env.get(variable);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.default || Deno.env.get(legacy) || undefined;
  } catch {
    return Deno.env.get(legacy) || undefined;
  }
}
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
}
function appOrigin(): string {
  const value = Deno.env.get("PUBBBLIC_APP_ORIGIN") || defaultPreviewOrigin;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash)
    throw new Error("invalid_app_origin");
  return url.origin;
}
type Message = { to: string; organization: string; role: string; expiry: string; url: string };
function renderMessage(message: Message) {
  const org = escapeHtml(message.organization);
  const role = escapeHtml(message.role[0].toUpperCase() + message.role.slice(1));
  const expires = escapeHtml(new Date(message.expiry).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  }));
  const href = escapeHtml(message.url);
  const subject = "You're invited to join " + message.organization + " on Pubbblic";
  const text = [
    "You've been invited to " + message.organization + " on Pubbblic.",
    "Role: " + message.role + ". Invitation expires " + expires + ".",
    "Review invitation: " + message.url,
    "You'll sign in or create your Pubbblic account using an email verification code.",
    "Membership is activated only after you select Accept invitation.",
    "If you weren't expecting this invitation, ignore this email.",
    "Pubbblic — a Mahtco company, https://pubbblic.com",
  ].join("\n\n");
  const html = \`<!doctype html><html lang="en"><head><meta charset="UTF-8"></head>
  <body style="background:#f5f7fb;margin:0;padding:28px;font-family:Arial,Helvetica,sans-serif;color:#17233f">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:auto;background:#fff;border-radius:14px;border:1px solid #dfe6f2">
      <tr><td style="padding:34px">
        <div style="font-size:30px;font-weight:800;letter-spacing:-1.5px">pubbblic<span style="color:#2652de">.</span></div>
        <p style="font-size:11px;font-weight:700;letter-spacing:2px;color:#6580b7;margin:30px 0 12px">ORGANIZATION INVITATION</p>
        <h1 style="font-size:29px;line-height:1.25;margin:0 0 14px">You're invited to collaborate</h1>
        <p style="font-size:15px;line-height:1.8;color:#576984">You've been invited to join <strong>\${org}</strong> on Pubbblic.</p>
        <table role="presentation" width="100%" style="background:#f2f5fc;border-radius:9px;margin:20px 0;padding:16px">
          <tr><td style="padding:6px;font-size:13px;color:#687995">Organization</td><td style="padding:6px;text-align:right;font-weight:bold;font-size:13px">\${org}</td></tr>
          <tr><td style="padding:6px;font-size:13px;color:#687995">Your role</td><td style="padding:6px;text-align:right;font-weight:bold;font-size:13px">\${role}</td></tr>
          <tr><td style="padding:6px;font-size:13px;color:#687995">Expires</td><td style="padding:6px;text-align:right;font-size:13px">\${expires}</td></tr>
        </table>
        <p style="margin:27px 0"><a href="\${href}" style="display:inline-block;padding:15px 24px;background:#2652de;color:#fff;font-size:14px;text-decoration:none;border-radius:8px;font-weight:bold">Review invitation &amp; join</a></p>
        <p style="font-size:13px;line-height:1.8;color:#687995">Existing members can sign in. New users can create an account using a verification code. Joining requires explicitly accepting this invitation.</p>
        <p style="font-size:12px;line-height:1.7;color:#8492a8">If you weren't expecting this invitation, you can safely ignore it. This invitation does not grant access until you accept.</p>
        <div style="border-top:1px solid #e7ecf4;padding-top:21px;margin-top:28px;font-size:11px;color:#8f9cb1">
          Pubbblic · a <a href="https://mahtco.com" style="color:#476ac9">Mahtco</a> company · <a href="https://pubbblic.com" style="color:#476ac9">pubbblic.com</a>
        </div>
      </td></tr>
    </table>
  </body></html>\`;
  return { html, text, subject };
}
type Delivery = { id: string | null; provider: "zoho" | "resend" };
class DeliveryError extends Error {
  constructor(public code: string) { super(code); }
}
function deliveryConfig(): "zoho" | "resend" | null {
  const provider = Deno.env.get("INVITATION_EMAIL_PROVIDER");
  if (provider === "resend" && Deno.env.get("RESEND_API_KEY")) return "resend";
  if (provider === "zoho" && ["ZOHO_MAIL_ACCOUNT_ID", "ZOHO_OAUTH_CLIENT_ID",
    "ZOHO_OAUTH_CLIENT_SECRET", "ZOHO_OAUTH_REFRESH_TOKEN"].every(k => Boolean(Deno.env.get(k)))) return "zoho";
  return null;
}
async function sendEmail(message: Message, provider: "zoho" | "resend", attempt: number, invitationId: string): Promise<Delivery> {
  const { html, text, subject } = renderMessage(message);
  const from = Deno.env.get("INVITATION_FROM_EMAIL") || "hello@pubbblic.com";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) throw new DeliveryError("invalid_sender");
  if (provider === "resend") {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + Deno.env.get("RESEND_API_KEY"),
        "Content-Type": "application/json",
        "Idempotency-Key": \`pubbblic-invitation-\${invitationId}-\${attempt}\`,
      },
      body: JSON.stringify({ from: \`Pubbblic <\${from}>\`, to: [message.to], subject, html, text }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new DeliveryError("resend_rejected_" + response.status);
    const result = await response.json();
    if (!result?.id) throw new DeliveryError("resend_invalid_response");
    return { provider, id: String(result.id) };
  }
  const clientId = Deno.env.get("ZOHO_OAUTH_CLIENT_ID")!;
  const clientSecret = Deno.env.get("ZOHO_OAUTH_CLIENT_SECRET")!;
  const refreshToken = Deno.env.get("ZOHO_OAUTH_REFRESH_TOKEN")!;
  const accountsBase = Deno.env.get("ZOHO_ACCOUNTS_BASE_URL") || "https://accounts.zoho.com";
  const mailBase = Deno.env.get("ZOHO_MAIL_BASE_URL") || "https://mail.zoho.com";
  if (!/^https:\/\/accounts\.zoho\.(com|eu|in|com\.au|jp|com\.cn)$/.test(accountsBase) ||
      !/^https:\/\/mail\.zoho\.(com|eu|in|com\.au|jp|com\.cn)$/.test(mailBase))
    throw new DeliveryError("zoho_domain_not_allowed");
  const accountId = Deno.env.get("ZOHO_MAIL_ACCOUNT_ID")!;
  if (!/^\d{3,30}$/.test(accountId)) throw new DeliveryError("zoho_account_invalid");
  const tokenResponse = await fetch(accountsBase + "/oauth/v2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token", client_id: clientId,
      client_secret: clientSecret, refresh_token: refreshToken,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!tokenResponse.ok) throw new DeliveryError("zoho_oauth_rejected_" + tokenResponse.status);
  const tokenData = await tokenResponse.json();
  if (!tokenData?.access_token) throw new DeliveryError("zoho_oauth_token_unavailable");
  const response = await fetch(mailBase + "/api/accounts/" + accountId + "/messages", {
    method: "POST",
    headers: {
      Authorization: "Zoho-oauthtoken " + tokenData.access_token,
      "Content-Type": "application/json", Accept: "application/json",
    },
    body: JSON.stringify({
      fromAddress: from, toAddress: message.to, subject, content: html,
      mailFormat: "html", encoding: "UTF-8",
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new DeliveryError("zoho_mail_rejected_" + response.status);
  const result = await response.json();
  if (Number(result?.status?.code) !== 200) throw new DeliveryError("zoho_mail_request_rejected");
  return { provider, id: result?.data?.messageId ? String(result.data.messageId) : null };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return respond({ error: "method_not_allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const pub = pickKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
  const secret = pickKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !pub || !secret) return respond({ error: "supabase_not_configured" }, 503);
  const jwt = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return respond({ error: "authentication_required" }, 401);

  let invitationId: string;
  try {
    const body = await request.json();
    invitationId = String(body?.invitation_id || "");
  } catch { return respond({ error: "invalid_json" }, 400); }
  if (!uuid.test(invitationId)) return respond({ error: "invalid_invitation" }, 400);

  const requester = createClient(url, pub, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: "Bearer " + jwt } },
  });
  const { data: { user }, error: userError } = await requester.auth.getUser(jwt);
  if (userError || !user?.id || !user.email_confirmed_at)
    return respond({ error: "verified_login_required" }, 401);

  const { data: invite, error: readError } = await requester
    .from("organization_invitations")
    .select("id,organization_id,email,role,expires_at,accepted_at,notification_last_attempt_at,notification_send_count,notification_attempt_count")
    .eq("id", invitationId).maybeSingle();
  if (readError) return respond({ error: "invitation_lookup_failed" }, 500);
  if (!invite) return respond({ error: "invitation_not_found_or_forbidden" }, 403);
  const { data: member, error: memberError } = await requester
    .from("organization_memberships").select("role")
    .eq("organization_id", invite.organization_id).eq("user_id", user.id).maybeSingle();
  if (memberError || !["owner", "admin"].includes(member?.role || ""))
    return respond({ error: "not_authorized" }, 403);
  if (invite.accepted_at || new Date(invite.expires_at).getTime() <= Date.now())
    return respond({ error: "invitation_inactive" }, 409);
  if (invite.notification_send_count >= sendLimit || invite.notification_attempt_count >= attemptLimit)
    return respond({ error: "invitation_send_limit" }, 429);
  if (invite.notification_last_attempt_at &&
      Date.now() - new Date(invite.notification_last_attempt_at).getTime() < cooldownMs)
    return respond({ error: "invitation_cooldown" }, 429);

  const { data: org, error: orgError } = await requester
    .from("organizations").select("name").eq("id", invite.organization_id).single();
  if (orgError || !org?.name) return respond({ error: "organization_lookup_failed" }, 500);
  const provider = deliveryConfig();
  if (!provider) return respond({ error: "transactional_email_not_configured", invitation_saved: true }, 503);

  let joinUrl: string;
  try { joinUrl = appOrigin() + "/invite/" + invite.id; }
  catch { return respond({ error: "invitation_origin_not_configured" }, 503); }

  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const now = new Date();
  const cutoff = new Date(now.getTime() - cooldownMs).toISOString();
  const attempt = invite.notification_attempt_count + 1;
  // Atomic claim: prevents two concurrent sends from consuming the same slot.
  const { data: claim, error: claimError } = await admin.from("organization_invitations")
    .update({
      notification_state: "sending",
      notification_attempt_count: attempt,
      notification_last_attempt_at: now.toISOString(),
      notification_last_error: null,
    })
    .eq("id", invite.id)
    .eq("notification_attempt_count", invite.notification_attempt_count)
    .eq("notification_send_count", invite.notification_send_count)
    .is("accepted_at", null).gt("expires_at", now.toISOString())
    .or("notification_last_attempt_at.is.null,notification_last_attempt_at.lt." + cutoff)
    .select("id").maybeSingle();
  if (claimError) return respond({ error: "delivery_reservation_failed" }, 503);
  if (!claim) return respond({ error: "invitation_cooldown_or_changed" }, 429);

  try {
    const delivery = await sendEmail({
      to: invite.email, organization: org.name, role: invite.role,
      expiry: invite.expires_at, url: joinUrl,
    }, provider, attempt, invite.id);
    const { error: trackError } = await admin.from("organization_invitations")
      .update({
        notification_state: "sent",
        notification_sent_at: new Date().toISOString(),
        notification_send_count: invite.notification_send_count + 1,
        notification_delivery_provider: delivery.provider,
        notification_provider_message_id: delivery.id,
        notification_last_error: null,
      }).eq("id", invite.id).eq("notification_attempt_count", attempt);
    if (trackError) {
      console.error("Invitation provider accepted; tracking failed", String(trackError.code || "db_error"));
      return respond({ email_request_accepted: true, tracking_failed: true }, 202);
    }
    return respond({ email_request_accepted: true, method: "branded_invitation", provider: delivery.provider }, 200);
  } catch (err) {
    const code = err instanceof DeliveryError ? err.code : "transport_unavailable";
    await admin.from("organization_invitations").update({
      notification_state: "failed", notification_last_error: code,
    }).eq("id", invite.id).eq("notification_attempt_count", attempt);
    console.error("Invitation delivery failed", code);
    return respond({ error: "transactional_email_request_failed", reason: code, invitation_saved: true }, 502);
  }
});
