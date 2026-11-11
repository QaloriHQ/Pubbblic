# Pubbblic invitation: change OTP emails to clickable links

Supabase Auth delivers emails using existing custom Zoho SMTP. No Zoho Mail API integration is needed.

New user: `inviteUserByEmail({ redirectTo })` uses the **Invite user** template; source: `platform/email-templates/invite-user.html`.
Existing user: `signInWithOtp({options:{shouldCreateUser:false,emailRedirectTo}})` uses **Magic link or OTP**; source: `platform/email-templates/magic-link.html`.

The hosted Magic link or OTP template must contain the anchor `<a href="{{ .ConfirmationURL }}">`. A template containing only `{{ .Token }}` produces a verification code instead.

## Required one-time Auth dashboard configuration

1. Supabase → Authentication → Emails → Templates → **Magic link or OTP**. Set subject to **Your secure Pubbblic sign-in link**. Paste `platform/email-templates/magic-link.html` and save.
2. Confirm **Invite user** has `{{ .ConfirmationURL }}` and the separately branded invite template is saved (new users).
3. Supabase → Authentication → URL Configuration. Canonical Site URL: `https://app.pubbblic.com`. Redirect URL must allow `https://app.pubbblic.com/invite/**`. Keep any other required live callback URLs.
4. Resend invitation (subject to server-side 120-second cooldown). Existing recipients should see a blue **Continue to Pubbblic** button; it must authenticate and return to `/invite/{id}`.
5. Verify new-user link, existing-user link, mismatched-email rejection, invitation expiry/revocation, explicit acceptance, and ordinary passwordless sign-in (the Magic template is shared with login).

GitHub editing alone does not change hosted Supabase Auth templates. These must be saved in Supabase manually using dashboard access; the current Supabase connector cannot modify Auth templates. Until then, existing account emails can still arrive as codes. The team screen's Copy join link points at the stable verified app domain.

The Magic Link is a *sign-in credential*, not authorization to join an organization. Pubbblic grants membership only after verifying the recipient's email and explicit acceptance via its database RPC.
