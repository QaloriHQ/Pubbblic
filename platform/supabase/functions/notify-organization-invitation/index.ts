// Pubbblic organization invitations: Supabase Auth delivers OTP email via the configured SMTP.
// Organization and role access remains in Pubbblic's RLS-protected invitations + accept RPC.
// No separate Zoho Mail API, Resend API, or client-accessible service-role key required.
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
// Temporary preview fallback. Replace with a stable, approved app origin at launch.
const defaultPreviewOrigin = "https://pubbblic-platform-5nehj6it1-qaloris-projects.vercel.app";
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
function appOrigin(): string {
  const value = Deno.env.get("PUBBBLIC_APP_ORIGIN") || defaultPreviewOrigin;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash)
    throw new Error("invalid_app_origin");
  return url.origin;
}
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return respond({ error: "method_not_allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const publishable = pickKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
  const secret = pickKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !publishable || !secret) return respond({ error: "supabase_not_configured" }, 503);
  const jwt = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return respond({ error: "authentication_required" }, 401);

  let invitationId = "";
  try {
    const body = await request.json();
    invitationId = String(body?.invitation_id || "");
  } catch {
    return respond({ error: "invalid_request" }, 400);
  }
  if (!uuid.test(invitationId)) return respond({ error: "invalid_invitation_id" }, 400);

  const requester = createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: "Bearer " + jwt } },
  });
  const { data: { user }, error: userError } = await requester.auth.getUser(jwt);
  if (userError || !user?.id || !user.email_confirmed_at)
    return respond({ error: "verified_sign_in_required" }, 401);

  // Both invitation RLS and organization membership must authorize this request.
  const { data: invite, error: lookupError } = await requester
    .from("organization_invitations")
    .select("id,organization_id,email,role,accepted_at,cancelled_at,expires_at,notification_last_attempt_at,notification_send_count,notification_attempt_count")
    .eq("id", invitationId).maybeSingle();
  if (lookupError) return respond({ error: "invitation_lookup_failed" }, 500);
  if (!invite) return respond({ error: "invitation_not_found_or_forbidden" }, 403);
  const { data: membership, error: membershipError } = await requester
    .from("organization_memberships").select("role")
    .eq("organization_id", invite.organization_id).eq("user_id", user.id).maybeSingle();
  if (membershipError || !["owner", "admin"].includes(membership?.role || ""))
    return respond({ error: "permission_denied" }, 403);
  const now = new Date();
  if (invite.accepted_at || invite.cancelled_at || new Date(invite.expires_at).getTime() <= now.getTime())
    return respond({ error: "invitation_not_active" }, 409);
  if (invite.notification_send_count >= sendLimit || invite.notification_attempt_count >= attemptLimit)
    return respond({ error: "invitation_send_limit" }, 429);
  if (invite.notification_last_attempt_at &&
      now.getTime() - new Date(invite.notification_last_attempt_at).getTime() < cooldownMs)
    return respond({ error: "invitation_cooldown" }, 429);

  let invitationUrl: string;
  try { invitationUrl = appOrigin() + "/invite/" + invite.id; }
  catch { return respond({ error: "invitation_origin_not_configured" }, 503); }

  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const attempt = invite.notification_attempt_count + 1;
  const cutoff = new Date(now.getTime() - cooldownMs).toISOString();
  // Compare-and-swap prevents two concurrent send requests from sharing one attempt.
  const { data: claimed, error: claimError } = await admin.from("organization_invitations")
    .update({
      notification_state: "sending",
      notification_attempt_count: attempt,
      notification_last_attempt_at: now.toISOString(),
      notification_last_error: null,
    })
    .eq("id", invite.id)
    .eq("notification_attempt_count", invite.notification_attempt_count)
    .eq("notification_send_count", invite.notification_send_count)
    .is("accepted_at", null)
    .is("cancelled_at", null)
    .gt("expires_at", now.toISOString())
    .or("notification_last_attempt_at.is.null,notification_last_attempt_at.lt." + cutoff)
    .select("id").maybeSingle();
  if (claimError) return respond({ error: "delivery_reservation_failed" }, 503);
  if (!claimed) return respond({ error: "invitation_cooldown_or_changed" }, 429);

  // New accounts: native Supabase Invite user template (admin-only).
  // Existing accounts: Magic link or OTP template. Never reveal which branch
  // ran to the caller; authorization is already restricted to an org admin.
  // Both point to the same Pubbblic invitation acceptance page.
  let mailErrorCode: string | null = null;
  let deliveryMethod: "supabase_auth_invite" | "supabase_auth_otp" = "supabase_auth_invite";
  try {
    const { error: invitationError } = await admin.auth.admin.inviteUserByEmail(
      invite.email, { redirectTo: invitationUrl }
    );
    if (invitationError) {
      const code = String(invitationError.code || "");
      const isExisting = code === "email_exists" || code === "user_already_exists" ||
        /already registered|already exists/i.test(invitationError.message || "");
      if (isExisting) {
        deliveryMethod = "supabase_auth_otp";
        const mailer = createClient(url, publishable, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { error } = await mailer.auth.signInWithOtp({
          email: invite.email,
          options: { shouldCreateUser: false, emailRedirectTo: invitationUrl },
        });
        if (error) mailErrorCode = "auth_email_request_" + String(error.status || "failed");
      } else {
        mailErrorCode = "auth_invitation_request_" + String(invitationError.status || "failed");
      }
    }
  } catch {
    mailErrorCode = "auth_email_request_failed";
  }

  if (mailErrorCode) {
    await admin.from("organization_invitations")
      .update({ notification_state: "failed", notification_last_error: mailErrorCode })
      .eq("id", invite.id).eq("notification_attempt_count", attempt);
    return respond({ error: "auth_email_request_failed", reason: mailErrorCode, invitation_saved: true }, 502);
  }

  const { error: trackingError } = await admin.from("organization_invitations")
    .update({
      notification_state: "sent",
      notification_sent_at: new Date().toISOString(),
      notification_send_count: invite.notification_send_count + 1,
      notification_delivery_provider: deliveryMethod,
      notification_provider_message_id: null,
      notification_last_error: null,
    })
    .eq("id", invite.id).eq("notification_attempt_count", attempt);
  if (trackingError) {
    console.error("Supabase Auth accepted invitation email but tracking update failed");
    return respond({ email_request_accepted: true, method: "supabase_auth", tracking_failed: true }, 202);
  }
  return respond({
    email_request_accepted: true,
    method: "supabase_auth",
    invitation_saved: true,
    // This confirms API acceptance, not delivery, verification or membership.
  }, 200);
});
