# Pubbblic organization invitations — Supabase Auth implementation

## Architecture

- **Supabase Auth:** Email verification and sign-in for existing and new users. Pubbblic already has Zoho SMTP configured in Supabase Auth; no separate Zoho Mail API or Resend API configuration is required.
- **Pubbblic database:** Organization invitation, intended recipient email, assigned role, expiration and pending/accepted state. These records are protected by tenant-aware RLS.
- **Supabase Edge Function:** `notify-organization-invitation` verifies an authenticated owner/admin, claims an invitation send slot with a two-minute cooldown, then calls `signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: invitationUrl } })`. This uses Supabase's existing configured SMTP.
- **Recipient experience:** `/invite/[id]` permits new or existing users to verify their email using the configured eight-digit OTP, review invitation details after authentication, and explicitly click **Accept invitation and join**.
- **Authorization:** Membership is granted only through the server-side `accept_organization_invitation` RPC; the email link alone cannot grant access. Wrong-account acceptance is forbidden.
- **Messaging:** The invitation page supports entering a code already received, avoiding a second OTP request. Pending invitation UI shows Supabase's email-request status. Copy join link works independently of email.
- **Legacy telemetry:** Older email-request fields remain for audit compatibility. New requests set `notification_delivery_provider='supabase_auth'`. Provider acceptance is not a delivery guarantee.
- **Sending limits:** Maximum 5 accepted email requests / 10 attempts, with a two-minute cooldown per invitation.

## Required Supabase Auth email-template step

In **Authentication → Emails → Templates**, update BOTH **Confirm sign up** and **Magic link or OTP** to include the OTP variable `{{ .Token }}` AND a generic application link:

```html
<p>Continue in Pubbblic:</p>
<a href="{{ .RedirectTo }}" style="display:inline-block;background:#2652de;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;">Open Pubbblic</a>
<p>Enter your verification code and accept the invitation if one is waiting for you.</p>
```

Use `{{ .RedirectTo }}`, not a dynamic organization-name placeholder. This works for standard email sign-in and invitations; the app's invitation sender supplies the invitation-specific redirect URL. **Never remove `{{ .Token }}` from these templates**, since the app expects numeric email codes.

In **Authentication → URL Configuration**, add the exact configured preview invitation redirect:
`https://pubbblic-platform-ks6y1kgqu-qaloris-projects.vercel.app/invite/*`

When a permanent staging/app domain is approved, change the allowlist and `PUBBBLIC_APP_ORIGIN` Edge Function secret to that same HTTPS origin. The function has a temporary preview fallback. Avoid wildcard domains outside the authorized origin. **Do not add any separate Zoho API OAuth secrets.**

If this email-template step is not yet complete, the verification code can still arrive through Supabase Auth. The owner can use **Copy join link** to share the secure invitation URL; the invitee can open it and enter the code via **I already have an email code**.

## Live acceptance tests

1. Owner creates invitation. Confirm exact email, role and expiry are persisted even if sending fails.
2. Supabase Auth accepts the OTP request. Confirm the email arrives via existing Zoho SMTP with a code and, after template update, an **Open Pubbblic** link.
3. Test a brand-new email recipient: authenticate, review role, explicitly accept; membership is created once.
4. Test an already-registered recipient: sign in and accept, then switch organizations.
5. Wrong signed-in email cannot view the invitation or accept it. An expired invitation cannot be accepted.
6. Validate Viewer read-only and Editor limited write access; no cross-organization releases or private media visible.
7. Confirm resend cooldowns, fail-safe record preservation, status accuracy and real email delivery.
8. Keep Vercel preview protection until a staging access plan is approved. External invitees may require Vercel-authorized access.
9. Do not mark G1 production-ready until the above real-user tests pass.

## Notes

Supabase's built-in **Invite user** template is intended for Auth account invitations. It cannot directly assign Pubbblic organization roles to existing users. Here, the same OTP/confirm templates serve both new and existing users. The Pubbblic invitation record remains the source of truth for role assignment.
