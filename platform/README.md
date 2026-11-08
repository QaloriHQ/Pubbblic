# Pubbblic Platform — Authenticated Organization Workspaces

Current build: 0.2.0 (Supabase schema activated; preview authentication configuration in progress).

## Implemented source

- Next.js 16 with server/browser Supabase SSR clients, session refresh proxy, verified claims protection, email OTP and magic-link callback.
- Protected /dashboard and /login routes. The original local-only demo moved to /preview.
- Organizations with owner/admin/editor/viewer roles, atomic owner bootstrap, admin-driven invitations matched to verified sign-in emails, invitation acceptance and tenant switching.
- Releases with Row Level Security (RLS), optimistic concurrency version checking, immutable revision snapshots, and archive instead of destructive delete.
- Private release-assets storage with organization/release scoped object paths, authenticated policies, 10 MB limit and MIME restrictions.
- No service-role key or publisher credentials in the browser; publisher submissions and payments remain disabled.

## Activation status (November 8, 2026)

- Dedicated Supabase project: `Pubbblic Project` (`bcfyohbhhqbuhfwwedvc`), active.
- GitHub integration applied migration `20261108180000_organizations_releases_rls`. **Do not apply it again**.
- All six public application tables have RLS enabled; nine public-table policies and two storage-object policies installed.
- Private `release-assets` bucket with 10 MB limit and allowlisted MIME types installed.
- Initial Supabase security advisor now reports no findings; pre-existing `public.rls_auto_enable()` execute grants restricted.
- A rollback-only SQL test exercised two synthetic verified identities, organization creation, release versioning and cross-organization read/write restrictions; no test accounts or records were retained.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are configured for **Vercel preview**. Supabase's Vercel integration supplies them for production separately. Never put a service-role/secret key into `NEXT_PUBLIC_`.
- Verified build: `https://pubbblic-platform-bn21jsl01-qaloris-projects.vercel.app` (Vercel preview; SSO-protected).
- **Outstanding**: Auth Site URL and redirect allowlist, actual OTP/email delivery, two real signed-in users and media-isolation acceptance tests.

## Auth setup / remaining release gates

1. Supabase Dashboard → Authentication → URL Configuration: for the current test, set Site URL to `https://pubbblic-platform-bn21jsl01-qaloris-projects.vercel.app`, and add exactly `https://pubbblic-platform-bn21jsl01-qaloris-projects.vercel.app/auth/callback` as a redirect URL. Update these when switching to a stable authorized app domain. Do not use a wildcard for production.
2. Supabase Dashboard → Authentication → Providers → Email: enable email auth, confirm emails, and set sensible OTP expiry and throttling. The login app uses `signInWithOtp`; by default Supabase sends a Magic Link unless you customize the Magic Link template to include `{{ .Token }}`. Verify the template on a real opted-in test email.
3. Configure a verified custom SMTP provider and sender before opening signups broadly. Test delivery, throttling, expired tokens and sign-out.
4. Test two independently authenticated users in distinct organizations: access and mutation restrictions, invitations, editor/viewer capabilities, version conflicts, and private media upload/read. The rollback-only SQL test is not a substitute for actual user acceptance testing.
5. Keep `app.pubbblic.com` and the payment/publisher flows disabled until security, editorial and product-owner production gates pass.

The platform GitHub and Supabase integration are now connected. If enabling automatic database deployment, protect `main` with migration validation and security checks before merging new schema changes.

## Organization authorization design

- No direct organization/membership INSERT/UPDATE/DELETE from the browser. New organizations and invitation acceptance use narrowly authorized RPCs.
- Only owner/admin can create invitations.
- Owner/admin/editor can create and modify draft releases; viewer can read only.
- RLS uses `auth.uid()` and membership rows, not user-editable metadata claims.
- Release organization ID, creator ID, status and creation timestamp cannot be changed by client updates.
- Each save must increment the version by exactly one and records a row in `press_release_versions`.
- Revision objects are immutable to authenticated clients.
- Storage bucket `release-assets` is private. Object paths use organization/release IDs, storage policy checks access, and reads are via short-lived signed URLs.
- Disabling or suspending a user account and removing memberships requires a future admin governance workflow; no user-side role elevation UI exists.

## Limitations not yet cleared

- Database migration is applied and structural/transactional RLS checks passed, but real-user sign-in and end-to-end tenant/media tests still require completion.
- No automated invitation email; invitee sees pending invitations when logging in using the exact verified email.
- Storage checks file MIME/size via bucket policy, but a separate content-inspection pipeline is still recommended for uploaded files.
- No audit dashboard, billing, DeepSeek rewrite, Zyte publisher submission or live publication.
- No claim of production authentication readiness until SMTP, redirect URLs, anti-abuse protections, regression tests and production owner authorization are complete.

## Local

```bash
cd platform
npm install
npm run check
npm run build
npm run dev
```
