# Pubbblic G1 — password-first onboarding and organization invitations

Status: Supabase schema and Edge Functions deployed; Vercel preview built. Real-user QA is required before G1 is closed.

## Onboarding sequence

1. **Secure account.** Supabase Auth verifies email first; newly created users set a password (12–128 characters with uppercase, lowercase and a number) via the authenticated complete-onboarding-password Edge Function. Supabase Auth stores the password; public.user_onboarding stores only a completion timestamp.
2. **Workspace.** Create an organization with create_organization or accept an existing invitation with accept_organization_invitation. Invitees should not create a duplicate organization.
3. **Team and invitations (optional).** Owners and admins may invite collaborators; everyone can skip this step. The Continue and Skip controls immediately advance to the release step and record a best-effort, user-scoped progress timestamp without any privileged Edge Function dependency. Owners/admins can invite later from Team & invitations.
4. **First press release (optional).** Owners/admins/editors may open the private release editor or skip directly to the full Studio dashboard. Viewers open their read-only workspace. Draft creation is never required to complete onboarding, and nothing publishes externally.

The /dashboard page requires only password completion and organization membership. Team setup is optional, and a failed progress write cannot block access to the first release. The /invite/[id] page directs newly authenticated invitees to password setup before permitting membership acceptance. Existing pilot accounts were grandfathered to preserve ongoing QA work; only users created after migration are required to set up a password.

The login page also offers "Sign in with password" once a password is set; email OTP continues for signup and recovery.

## Invitation email selection

The protected notify-organization-invitation function uses Supabase Auth and existing Zoho SMTP:

- New recipient without an Auth account: admin.inviteUserByEmail with the invited organization URL. This sends the **Invite user** template and creates an unconfirmed user.
- Registered recipient: only on recognized email_exists or user_already_exists errors, signInWithOtp with shouldCreateUser:false and the same invited organization URL. This sends the **Magic link or OTP** template.
- The function responds generically, does not disclose account-existence details to the browser, and cannot grant organization membership. Pubbblic's stored invitation and its RLS-controlled explicit acceptance remain the source of truth.

No additional Zoho Mail API or Resend integration is required.

## Supabase dashboard configuration required

1. Authentication → Emails → **Invite user**: retain the link placeholder {{ .ConfirmationURL }} and brand the email for newly invited Pubbblic users.
2. Authentication → Emails → **Magic link or OTP**: retain {{ .Token }} (this project's eight-digit code), and add a generic Open Pubbblic link with href="{{ .RedirectTo }}" to take existing users to the invitation URL.
3. Authentication → Emails → **Confirm sign up**: retain {{ .Token }}; optionally add the same generic Open Pubbblic link for standard registration.
4. Authentication → URL Configuration: allow the QA preview redirect https://pubbblic-platform-hosr12xie-qaloris-projects.vercel.app/invite/* and the matching /auth/callback as needed. When an approved stable staging/application domain exists, use that origin instead, update the redirect allowlist, and set PUBBBLIC_APP_ORIGIN to match. Previews are not permanent production URLs.
5. Authentication → Providers → Email: ensure email/password auth is permitted; configure appropriate password length, email limits, and enable leaked-password protection before customer release. Supabase Security Advisor currently warns that leaked-password protection is disabled.

Do not paste provider credentials or passwords into GitHub, logs, or chat. Supabase Auth sends through the existing Zoho SMTP connection.

## Verified and outstanding

A rollback-only database test passed for new-account onboarding state initialization, RLS visibility, denial of team completion before password setup, denial before organization membership, and marking the team step after prerequisites. The test left no new users or organizations. Team completion no longer depends on an Edge Function or a privileged RPC. A narrowly scoped authenticated RLS policy permits editing only the user's own optional invitations_reviewed_at field, never password state or another user's record.

The Vercel preview build passed TypeScript checks and includes /onboarding and /invite/[id].

Real-user acceptance tests still required:
- Native Invite user email → confirmation → session → password creation → workspace setup/join.
- Existing account OTP → invite page → explicit acceptance.
- Verify password-based login and recovery behavior.
- Wrong-user and expired-invite rejection, Viewer read-only vs Editor permission, organization isolation.
- Valid sender emails and redirect allowlist; Vercel preview protection can restrict external testers.
- Verify release persistence and onboarding exit, session refresh, email delivery/error states.

The Acme Agency QA invitation has not been automatically accepted or resent.

## Implementation paths

- platform/app/onboarding/page.tsx
- platform/components/OnboardingWizard.tsx
- platform/components/LoginForm.tsx
- platform/components/InvitationJoin.tsx
- platform/supabase/functions/notify-organization-invitation/index.ts
- platform/supabase/functions/complete-onboarding-password/index.ts
- platform/supabase/functions/complete-onboarding-team/index.ts
- platform/supabase/migrations/20261110120000_user_onboarding_sequence.sql
- platform/supabase/migrations/20261110130000_onboarding_team_edge_permissions.sql

## Nov 10 hotfix — team setup must never block

A real onboarding attempt reached Step 03 and the complete-onboarding-team function returned HTTP 401. The required team-step gate has been removed from /dashboard. Both "Continue to first release" and "Skip team setup for now" advance immediately, and the optional progress timestamp is saved directly through an authenticated, column-restricted RLS policy. Inviting collaborators is still available during onboarding and later from Team & invitations. 

## UX update — both team and release steps optional

The **Skip team setup for now** action uses a visible outlined secondary button with the same hit-target height, rounded corners, brand-blue focus state and responsive full-width mobile treatment as other onboarding actions. On Step 4, authors may choose **Create first release** or **Skip first release · Go to dashboard**. The skip route never creates an empty draft or changes organization permissions. `/dashboard` only requires a verified session, completed password step and organization membership.

### Version-controlled Invite user email

The branded, table-based HTML lives at `platform/email-templates/invite-user.html` with subject **You're invited to Pubbblic**. Retain `{{ .ConfirmationURL }}` exactly: it's the native Supabase Auth verification link for **Invite user**. It is not the Pubbblic org-acceptance RPC. After verification, Pubbblic shows the correct pending invitation and requires explicit acceptance. The organization name is intentionally not interpolated because the built-in Supabase Auth email template cannot read the invitation record securely by itself.

In the hosted Supabase dashboard, paste the template HTML under Authentication → Emails → Invite user, set the subject, and save. Hosted email configuration is not changed just by committing the file. The sender's redirect URL must be on the Supabase allow list. Real email confirmation and continuation still require end-to-end testing.
