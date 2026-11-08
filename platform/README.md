# Pubbblic Studio — First Product Build

**Stage:** Interactive product preview, not a production-ready distribution service.

The first standalone application build is in the platform directory, separate from the public marketing site in site/. It demonstrates the planned workspace, release editor and publication workflow without enabling incomplete external actions.

## Included

- Responsive sidebar workspace with Overview, Releases, Studio, Publisher Network, Reports and Settings.
- New release editor covering headline, summary, issuer, dateline, category, body, optional quote/attribution, boilerplate and media contact.
- Real-time release preview, character/word counts and deterministic editorial completeness checks.
- Manual Save to browser-local storage, edit, delete and JSON export.
- An unmistakably fictional sample announcement.
- Clear PRELAUNCH, NOT PUBLISHED and NOT CONNECTED states.
- No mock DeepSeek generation, no false publisher availability and no fictional reporting figures.
- Static noindex marketing metadata, robots.txt disallow rule and /api/health.

## Local development

Requires Node 22+. Run npm install, then npm run dev and visit http://localhost:3000. Run npm run build and npm run check before merging. Vercel project root is platform.

## Important security limitation

This preview has **no authentication, database, secure server storage or real publishing**. Draft data remains in browser localStorage only after the user clicks Save. Browser cache clearing may delete it. Do not enter confidential or real customer releases in the preview. Keep it as a Vercel preview until identity, storage and security work is complete.

## Next release gates

1. Create or choose a dedicated Pubbblic Supabase project; implement verified email login, sessions, organization tenancy, role permissions and RLS (PUB-02).
2. Replace browser drafts with server-side versioned releases, media storage and approval workflow (PUB-03 and PUB-04). Migrate opt-in demo drafts only with an explicit user action.
3. Integrate DeepSeek generation for a distinct publisher-specific version, validate factual fidelity and publisher rules before release (PUB-06.10–12).
4. Add approved publisher inventory and Pubbblic-owned account custody only, then official APIs / permitted Zyte Actions; no customer connections (PUB-05, PUB-07).
5. Durable jobs, pricing/Stripe, audit evidence, publication verification and production authorization gates (PUB-06, PUB-08, PUB-09, PUB-12).

**No customer publishing, production activation, billing or provider connection is implied by this preview build.**
