# Pubbblic invitation acceptance — QA setup

## Implementation

The protected Supabase function notify-organization-invitation sends an authentication OTP to the invited email. The recipient invitation link is /invite/{invitation-id}. It allows the invitee to authenticate using an eight-digit OTP, verify their own pending invitation, and explicitly accept. The invitation's Viewer/Editor/Admin role is assigned only by the server-side acceptance RPC after the verified email matches. Owners/admins may copy a join link from Team & Invitations; no invitation details or access are exposed to unverified visitors.

## Add invitation link to existing Supabase templates

In Supabase Authentication → Emails → Templates, add this CTA to both Magic link or OTP and Confirm sign up, after the {{ .Token }} code:

```html
<p>Continue to Pubbblic:</p>
<p><a href="{{ .RedirectTo }}" style="display:inline-block;padding:12px 20px;background:#2652de;color:#fff;text-decoration:none;border-radius:8px;">Open Pubbblic</a></p>
<p>Enter your verification code in Pubbblic, then accept the organization invitation.</p>
```

The CTA uses RedirectTo rather than ConfirmationURL so it opens the app without consuming any verification token. Because these templates also serve ordinary sign-in, retain generic wording rather than naming any particular organization. The Edge Function supplies an invitation-specific emailRedirectTo when sending an invitation email.

In Supabase Authentication → URL Configuration add to allowed redirects:
https://pubbblic-platform-l4wivtuci-qaloris-projects.vercel.app/invite/*

This is a temporary preview URL. At launch update both Supabase redirects and Edge Function to a stable authorized origin such as https://app.pubbblic.com/invite/*. Never accept arbitrary redirect domains.

Existing already-sent messages will NOT gain a link retroactively; resend after the cooldown, or share the copyable join URL directly.

## Acceptance tests

1. From Acme Agency's Team & Invitations, copy the existing pending invitation join link.
2. Open in a private session and sign in with the exact invited verified email.
3. Confirm the organization name and invitation role appear, then press Accept invitation and join.
4. Confirm membership is created once, invitation becomes accepted, and organization appears in switcher.
5. Verify Viewer can read permitted releases, cannot edit, and has no access to unrelated organizations.
6. Test wrong-account, expired invitation, duplicate acceptance, and mail sending cooldown.

An email request being accepted does not prove inbox delivery, and an email being delivered does not grant organization access.
