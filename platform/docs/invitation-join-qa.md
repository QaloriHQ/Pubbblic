# Pubbblic organization invitations — implementation and activation

## Architecture

- Pubbblic persists organization invitation records with the assigned role, expiry, and verified-email match. Existing and newly registered users share one acceptance workflow.
- A verified owner/admin invokes the `notify-organization-invitation` Supabase Edge Function to send one **branded, organization-specific transactional email**.
- The sender uses a dedicated **Zoho Mail API (recommended for existing Pubbblic mailbox)** or **Resend** provider, never the Supabase Auth OTP template. It renders organization name, invited role, expiry date and a Join workspace URL.
- Recipients open `/invite/<id>`, verify their email via Supabase Auth (eight-digit OTP when needed), view the matching invitation, and explicitly accept it. Email delivery never adds membership.
- Role and organization verification is done through RLS-protected invitation reads and `accept_organization_invitation` RPC, not browser metadata or URL claims. Wrong account cannot accept.
- Access emails do not automatically create Auth accounts, unlike the previous `signInWithOtp` dispatcher.
- Sending is secured with explicit membership authorization, atomic attempt reservation, a 2-minute cooldown, a five-accepted-email limit, and a ten-attempt cap. Failures preserve invitation records.
- The preview is Vercel-protected; invited external users may need Vercel team access. To invite external testers without that barrier, deploy to an approved public staging domain after access-control acceptance.

## Activate transactional email (Supabase Edge Function secrets)

Because Zoho SMTP credentials stored in Supabase Auth are not available to Edge Functions, **separate API credentials are required**. Configure **one** provider:

### Zoho Mail API (recommended; same mailbox/domain as Pubbblic Auth)

Set these as secrets for the Pubbblic Supabase project, not in the browser or GitHub:
```env
INVITATION_EMAIL_PROVIDER=zoho
INVITATION_FROM_EMAIL=hello@pubbblic.com
PUBBBLIC_APP_ORIGIN=https://pubbblic-platform-71mnercfm-qaloris-projects.vercel.app
ZOHO_MAIL_ACCOUNT_ID=<Zoho Mail account ID for hello@pubbblic.com>
ZOHO_OAUTH_CLIENT_ID=<client-id>
ZOHO_OAUTH_CLIENT_SECRET=<client-secret>
ZOHO_OAUTH_REFRESH_TOKEN=<refresh-token-with-ZohoMail.messages.CREATE>
```
Set `ZOHO_ACCOUNTS_BASE_URL` and `ZOHO_MAIL_BASE_URL` only if the mailbox is in a non-US Zoho datacenter. Mail API OAuth refresh tokens are **different** from SMTP app passwords.
Resources:
- https://www.zoho.com/mail/help/api/getting-started-with-api.html
- https://www.zoho.com/mail/help/api/post-send-an-email.html
- https://www.zoho.com/developer/oauth/web-server-apps/refresh-access-token.html

### Resend alternative

```env
INVITATION_EMAIL_PROVIDER=resend
INVITATION_FROM_EMAIL=hello@pubbblic.com
PUBBBLIC_APP_ORIGIN=https://pubbblic-platform-71mnercfm-qaloris-projects.vercel.app
RESEND_API_KEY=<verified-sender-domain-Resend-key>
```

Verify `pubbblic.com` in the provider and configure SPF/DKIM/DMARC before opening public signups. Do not send from an unverified address. Never configure both providers at the same time.
Set `PUBBBLIC_APP_ORIGIN` to a **stable authorized app URL** as soon as one exists. Never point invitation emails at arbitrary user-provided redirect URLs.

## Tests and release gates

1. Save a new organization invitation; confirm the row exists with correct email and role even if the mail provider is unavailable.
2. With sender configured, click Send invitation. Confirm response accepted and track `notification_state`, `notification_delivery_provider`, `notification_sent_at`, `notification_provider_message_id`.
3. Confirm branded email includes organization, role, expiration, and direct Join workspace CTA.
4. New user: open email in private browser, request/signup with OTP, verify, review and explicitly accept. Confirm role.
5. Existing user: sign in and accept. Check multiple-organization switcher and correct landing workspace.
6. Wrong email user: cannot see or accept invitation; expired invitation cannot be accepted; duplicate acceptance is rejected or idempotently handled by RPC.
7. Viewer cannot edit releases; Editor can edit only permitted organization content; no cross-tenant file or release reads.
8. Verify resend cooldown, retry after provider failure, per-invitation limits, and correct user-facing messages.
9. Supabase Security Advisor, live delivery logs and acceptance records must be reviewed before production authorization.

Invitation delivery is **not live until the separate transactional provider secrets are configured**; copying join links remains a supported manual fallback.
