# Pubbblic Platform — Authenticated Organization Workspaces

Current build: 0.2.0 (infrastructure implementation; database activation pending).

## Implemented source

- Next.js 16 with server/browser Supabase SSR clients, session refresh proxy, verified claims protection, email OTP and magic-link callback.
- Protected /dashboard and /login routes. The original local-only demo moved to /preview.
- Organizations with owner/admin/editor/viewer roles, atomic owner bootstrap, admin-driven invitations matched to verified sign-in emails, invitation acceptance and tenant switching.
- Releases with Row Level Security (RLS), optimistic concurrency version checking, immutable revision snapshots, and archive instead of destructive delete.
- Private release-assets storage with organization/release scoped object paths, authenticated policies, 10 MB limit and MIME restrictions.
- No service-role key or publisher credentials in the browser; publisher submissions and payments remain disabled.

## Runtime setup required

This repo does not yet have access to an eligible **Pubbblic** Supabase project through the connected app. DO NOT reuse Qalori, TXKPRO or FigSuite Supabase databases.

1. Connect the dedicated Pubbblic Supabase project to the Pubbblic Supabase app, or select an appropriate organization for creating a new project.
2. Review and apply `supabase/migrations/20261108180000_organizations_releases_rls.sql` on that dedicated project only.
3. In Vercel project `pubbblic-platform`, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to that project's publishable values. Rebuild after setting the values; browser variables are bundled at build time.
4. Supabase Auth: enable email authentication and confirmed emails. Configure Site URL to the authorized app origin and allowed redirect URL to `https://<authorized-app-origin>/auth/callback`. Never use wildcard production redirect URLs.
5. Default email template may send a Magic Link; the app supports that callback. To enable *six-digit OTP code entry*, include `{{ .Token }}` in the email template, as documented by Supabase. Set up dedicated SMTP and Auth rate limits before customer launch.
6. Run structural checks in `supabase/tests/verify_structure.sql`, Supabase security advisors and real two-user / two-organization RLS tests.
7. Verify signup, valid code/link, expired code/link, sign out, session refresh, tenant switching, unauthorized org access, release create/edit/version conflict, invite acceptance, private asset upload/read isolation and attachment restrictions.
8. Only after these gates pass should the customer-facing domain and production access be enabled.

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

- Database migration not applied to a Pubbblic project; no end-to-end user/tenant test executed.
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
