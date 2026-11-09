// Pubbblic: dispatch organization invitation access email via existing Supabase Auth SMTP.
// An invitation remains a separate, RLS-protected database record. No client-side admin key.
// This sends a sign-in/confirmation OTP to the invitee, NOT a custom organization email.
// Once verified, the recipient sees the pending organization invitation in their dashboard.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function reply(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
function pickKey(variable: string, legacy: string): string | undefined {
  try {
    const all = Deno.env.get(variable);
    const fromJson = all ? JSON.parse(all) : null;
    return fromJson?.default || Deno.env.get(legacy) || undefined;
  } catch {
    return Deno.env.get(legacy) || undefined;
  }
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return reply({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const pub = pickKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
  const secret = pickKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !pub || !secret) return reply({ error: "email_dispatch_not_configured" }, 503);

  const authHeader = request.headers.get("authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return reply({ error: "authentication_required" }, 401);

  let invitationId: string;
  try {
    const payload = await request.json();
    invitationId = String(payload?.invitation_id || "");
  } catch { return reply({ error: "invalid_request" }, 400); }
  if (!UUID.test(invitationId)) return reply({ error: "invalid_invitation_id" }, 400);

  const userClient = createClient(url, pub, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: "Bearer " + jwt } },
  });
  const { data: userData, error: identityError } = await userClient.auth.getUser(jwt);
  const user = userData?.user;
  if (identityError || !user?.id || !user.email_confirmed_at)
    return reply({ error: "verified_sign_in_required" }, 401);

  // Direct membership lookup and invitation RLS both must authorize this call.
  const { data: inv, error: lookupError } = await userClient
    .from("organization_invitations")
    .select("id,organization_id,email,role,expires_at,accepted_at,notification_last_attempt_at,notification_sent_at,notification_send_count")
    .eq("id", invitationId)
    .maybeSingle();
  if (lookupError) return reply({ error: "invitation_lookup_failed" }, 500);
  if (!inv) return reply({ error: "invitation_not_found_or_forbidden" }, 403);
  const { data: member, error: membershipError } = await userClient
    .from("organization_memberships").select("role")
    .eq("organization_id", inv.organization_id).eq("user_id", user.id)
    .maybeSingle();
  if (membershipError || !["owner", "admin"].includes(member?.role ?? ""))
    return reply({ error: "permission_denied" }, 403);
  if (inv.accepted_at || new Date(inv.expires_at).getTime() <= Date.now())
    return reply({ error: "invitation_not_active" }, 409);
  if ((inv.notification_send_count || 0) >= 5)
    return reply({ error: "invitation_send_limit_reached" }, 429);

  const adminClient = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const now = new Date();
  const cutoff = new Date(now.getTime() - 120000);
  const { data: claimed, error: claimError } = await adminClient
    .from("organization_invitations")
    .update({ notification_state: "sending", notification_last_attempt_at: now.toISOString() })
    .eq("id", inv.id)
    .is("accepted_at", null)
    .gt("expires_at", now.toISOString())
    .lt("notification_send_count", 5)
    .or("notification_last_attempt_at.is.null,notification_last_attempt_at.lt." + cutoff.toISOString())
    .select("id")
    .maybeSingle();
  if (claimError) return reply({ error: "invitation_delivery_reservation_failed" }, 503);
  if (!claimed) return reply({ error: "email_recently_requested_try_later" }, 429);

  // Calls GoTrue's built-in mailer, already configured to use Pubbblic's Zoho SMTP.
  // For existing accounts, sends the Magic link / OTP template; for new accounts,
  // sends Confirm sign up. The recipient signs in and accepts the pending invitation.
  const mailer = createClient(url, pub, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let sent = false;
  let sendError: unknown = null;
  try {
    const { error } = await mailer.auth.signInWithOtp({
      email: inv.email,
      options: {
        shouldCreateUser: true,
        // The OTP template can expose {{ .RedirectTo }} as "Open invitation".
        // Recipient still must verify ownership of the invited email and accept.
        emailRedirectTo: "https://pubbblic-platform-l4wivtuci-qaloris-projects.vercel.app/invite/" + inv.id,
      },
    });
    if (error) sendError = error;
    else sent = true;
  } catch (error) { sendError = error; }

  if (!sent) {
    await adminClient.from("organization_invitations")
      .update({ notification_state: "failed" }).eq("id", inv.id);
    console.error("Pubbblic invitation Auth email request failed", String(sendError).slice(0,250));
    return reply({ error: "email_delivery_request_failed", invitation_saved: true }, 502);
  }

  const { error: trackingError } = await adminClient
    .from("organization_invitations")
    .update({
      notification_state: "sent",
      notification_sent_at: new Date().toISOString(),
      notification_send_count: (inv.notification_send_count || 0) + 1,
    }).eq("id", inv.id);
  if (trackingError) {
    console.error("Pubbblic invitation sent but tracking update failed");
    return reply({ email_request_accepted: true, tracking_failed: true }, 202);
  }
  return reply({ email_request_accepted: true, method: "supabase_auth_otp", invitation_saved: true }, 200);
});
