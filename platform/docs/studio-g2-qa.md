# G2 Studio foundation — implemented November 10, 2026

**Scope:** PUB-03.01, PUB-03.02 initial implementation, PUB-03.06 initial comparison/restore, with the PUB-02.04 RLS regression check. This document is implementation and test evidence, **not** an approval of G1/G2 or external publishing.

## Data contracts

The canonical `public.press_releases` row remains scoped to `organization_id`; all mutations are subject to the existing tenant RLS, editor-role predicate and draft-only update trigger. The record retains typed fields for headline, summary, issuer, dateline, category, body, attributed quote, boilerplate, and media contact. Database checks cap field lengths. `body_format` was added with values `plain` and `markdown`. All existing releases were migrated to `plain` by default without rewriting body text. New editor drafts use `markdown`.

`public.release_readiness(release_id)` is a **security invoker** database function producing seven readiness checks with documented criteria, visible only to the authorized release reader under RLS. **Partial drafts are valid** and can autosave before all checks pass. Readiness is advice and must not automatically approve, publish, or bypass fact-checking.

`public.press_release_versions` remains append-only: its existing trigger captures each successful insert/update of the canonical release. Each snapshot includes its body representation and actor. The app provides 30 most recent snapshots for comparison and restore; older records remain in the database.

## Authoring behavior

- A responsive formatting toolbar inserts a safe subset of Markdown: headings, bold, italic, bullet and numbered lists, quotes and HTTP(S) links. No dependency on browser contenteditable HTML is required.
- Preview uses **React escaped nodes**, never `dangerouslySetInnerHTML`. Arbitrary HTML is shown as text and is not evaluated as executable markup. Outbound preview links require HTTP(S), `noopener noreferrer nofollow`.
- An editable draft becomes dirty when any field changes; after about 2.7 seconds of inactivity it is saved to the tenant-secured database. A brand-new empty draft is not persisted until it contains a headline or body.
- Each save uses `UPDATE ... WHERE version = expected AND status = draft`, increments `version`, and requires a returned row. If no row matches, the UI reports a conflict instead of silently overwriting.
- Manual Save now is always available. The UI distinguishes new/dirty/saving/saved/conflict/error. Browser/tab navigation warns about unsaved changes; mobile browser behavior may vary, so users should verify synchronization.
- Version history shows prior entries. Compare presents earlier versus current headline/body; **Restore** applies all canonical form fields as a **new** version, preserving original immutable snapshots. Restore is blocked while unsaved edits remain.
- Existing secure media flow is unchanged. No publisher submissions, DeepSeek rewriting or financial integrations were enabled.

## Applied migrations

- `20261110200000_release_body_format.sql`
- `20261110201000_release_readiness.sql`

## Verified

- Vercel Next.js/TypeScript preview deployment compiled and built successfully before the final navigation guard fix.
- SQL transaction test as an authorized organization owner created a draft update, verified a single snapshot was captured, and verified a stale version update affected zero rows. Rolled back with no persistent test writes.
- SQL RLS test as one organization's owner verified another organization's release was invisible and could not be mutated, could not be retrieved through readiness RPC, and the owner's own release returned seven readiness checks. All test writes rolled back.
- Supabase Security Advisor: pre-existing disabled leaked-password-protection warning persists; no new RLS warning observed.

## Required manual acceptance before G2 signoff

1. In the protected Vercel preview, create a release without completing all editorial fields. Wait for autosave, refresh, and confirm persistence with matching organization.
2. Edit headline and body, wait for autosave, verify the saved indicator and a new revision.
3. In two signed-in sessions edit the same draft; confirm the second stale save displays a conflict and does not overwrite the first.
4. Format headings, lists, bold, quotes and an HTTPS link. Confirm live preview matches. Paste HTML or a javascript: link in the body; it must display as ordinary text and not execute.
5. Open version history, compare an older revision and restore it as a *new* version; verify prior versions remain unchanged.
6. Verify Viewer read-only access, Editor limited write access, and no cross-tenant file/release access with actual invited accounts.
7. Test mobile Safari and desktop keyboard navigation, selection formatting, network failures, save recovery, and accessibility before marking PUB-03.02 or G2 complete.

**Pending roadmap items:** detailed release templates (PUB-03.04), media scanning/transformations (PUB-03.05), editorial review state machine (PUB-04.02), scheduling (PUB-03.08), and full approval/publication evidence. All external distribution still requires G3/G4 authority.

## Publisher runtime architecture correction

PUB-07 epic and #67, #69, #73 explicitly retire local Puppeteer/Chrome. Approved execution uses Pubbblic-owned publisher accounts, official APIs or Zyte Actions Mode through `https://api.zyte.com/v1/extract` with publisher permission, cloud-side sessions, rate limits, safe upload capability checks, and authenticated operator fallback. Actual connector implementation remains a future gate; changing GitHub issues does not deploy Zyte or bypass account/ToS requirements.

Zyte reference: https://docs.zyte.com/zyte-api/usage/browser.html
