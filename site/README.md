# Pubbblic marketing site

Production prelaunch marketing site built with Next.js App Router, TypeScript, Tailwind CSS and Heroicons. Its source lives in this `site/` directory so the eventual application can be developed separately.

## Included

- Home and 26 prelaunch content pages built for distinct press-release information and commercial-search intents.
- Static `sitemap.xml`, `robots.txt`, unique metadata and canonical URLs, breadcrumbs and structured data for guides.
- Mobile-responsive navigation, illustrated platform workflow, realistic product-stage disclosures and early-access CTAs.
- Consent-based waitlist form, service-role-only Supabase storage contract, scheduled Resend email drip, subscriber opt-out.
- Explicitly **no paid orders or live third-party publisher submissions** until the publisher-permission and product launch gates are approved.

## Local

Run `npm install && npm run dev` within `site/`. Use `npm run check` and `npm run build` before any deployment.

## Vercel

Project: `pubbblic-marketing`; canonical site: `https://pubbblic.com`; GitHub repo: `QaloriHQ/Pubbblic`, source directory `site/`.

**Git integration is currently not installed for this repository in Vercel.** The initial production deployment was performed from the GitHub commit's source files via the Vercel API. To automate future builds, install Vercel's GitHub integration with access to `QaloriHQ/Pubbblic` and configure project Root Directory = `site`.

## Database and sending credentials

Use a **dedicated Pubbblic Supabase project**, not an unrelated product's database. Review and apply `supabase/migrations/202611080001_marketing_waitlist.sql`, then configure these in Vercel Production:

- `SUPABASE_URL`: dedicated Supabase API URL.
- `SUPABASE_SERVICE_ROLE_KEY`: secret, server-side only.
- `RESEND_API_KEY`: secret from the connected Resend account.
- `RESEND_FROM`: sender on a DNS-verified domain, e.g., `Pubbblic <updates@pubbblic.com>`.
- `CRON_SECRET`: long, random and distinct secret to authenticate the daily Vercel Cron call.
- `UNSUBSCRIBE_SIGNING_SECRET`: separate long random value for unsubscribe link verification.
- `NEXT_PUBLIC_SITE_URL`: `https://pubbblic.com`.
- `WAITLIST_LAUNCHED`: `false` until public service launch; set `true` to pause the prelaunch drip.

The form **fails closed** with HTTP 503 if database secrets are missing. It does not pretend signups were stored. The cron likewise fails closed without email credentials. Do not treat code deployment as proof that subscriptions are being collected.

## Drip emails

All signups require explicit consent. Planned sequence: welcome; writing education; publisher-specific adaptations; delivery reporting; prelaunch progress; monthly low-frequency updates until launch. Emails include an unsubscribe confirmation link. Provider idempotency keys guard against accidental duplicate sends.

Before enabling marketing sends, add a legitimate postal contact address to each email and validate sender authentication, deliverability, suppression/unsubscribe behavior, complaint webhooks and region-specific consent requirements. Configure provider and API rate limiting/abuse protection. Review privacy and terms with qualified counsel where applicable.

## Release check

1. Vercel production deployment is READY and serves public pages.
2. DNS apex and `www` resolve to Vercel and SSL is valid.
3. Sitemap and metadata paths render, mobile UX and accessibility are reviewed.
4. Database migration is applied and RLS access is tested.
5. A controlled opt-in test is saved; duplicate signups do not duplicate rows.
6. A controlled Resend email arrives and unsubscribe stops all subsequent emails.
7. Cron token, logging, bounce/complaint suppression and email compliance are verified.

SEO is a long-term content-quality process. The site deliberately avoids fictitious publisher partnerships, guaranteed search rankings, fake reviews, or claims that the distribution platform is already available.
