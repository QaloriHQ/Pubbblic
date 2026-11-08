# ADR-0003: Mandatory DeepSeek rewrite per external publisher

**Status:** Accepted
**Decision date:** 2026-11-08
**Decision authority:** Product owner
**Supersedes:** Assumptions that the approved master release is submitted unchanged to multiple destinations
**Related ADR:** [ADR-0002](0002-pubbblic-owned-publisher-accounts.md)

## Context and decision

Pubbblic accepts one customer-authored press release, which is checked and explicitly approved as an immutable canonical release version. Before any **external publisher** receives the release, Pubbblic must use the DeepSeek API to produce a separate, publisher-specific editorial variant based on the current destination requirements.

Pubbblic owns all publisher accounts; no customer-connected publisher account, delegated credential or external publisher sign-in is offered.

A generated version is a *faithful editorial adaptation*, not permission to fabricate, mislead, inflate claims or manipulate search rankings through superficial synonym changes. It must meet the publisher's actual editorial policy and respect the original release's essential message, approved material facts and rights.

## Pipeline

1. Customer submits master release and supporting facts/media.
2. Pubbblic editorial workflow validates and approves immutable \`release_version_id\`.
3. Customer chooses available external publishers; eligibility requires current publisher rights and Pubbblic-owned account standing.
4. Distribution planner resolves each selected destination to an effective, reviewed \`publisher_rules_version\`.
5. Durable queue enqueues one DeepSeek rewrite per \`release_version_id + publisher_id + publisher_rules_version + prompt_version\`.
6. DeepSeek returns structured draft fields: \`headline\`, \`summary\`, \`body\`, \`boilerplate\`, \`media_refs\`, \`factual_assertions\`, \`editorial_notes\`.
7. Pubbblic parses, schema-validates, fact-checks and checks destination constraints. Independent deterministic rules and editorial review are mandatory; model-provided confidence alone cannot authorize publication.
8. If a variant contains new/mutated facts, quotes, figures, dates, attribution, locations, hyperlinks, misleading sentiment or prohibited claims, stop and escalate. Substantive changes require renewed customer authorization.
9. On pass, freeze the variant and its content hash; only that variant can be submitted for that publisher.
10. Execute using the destination's permitted route (official partner API, authorized Zyte Actions, or Pubbblic-operated manual workflow).
11. Store submission receipts, exact submitted variant ID and URL; verify published material against that destination variant; record changes and discrepancy evidence.

## Core product rules

- **One master, N publisher variants:** one separately generated version for each external publisher, even if two destinations share requirements. The Pubbblic newsroom may use the canonical approved release unless a separate internal editorial policy requires adaptation.
- **No facts invented:** preserve customer-approved names, locations, dates, measurements, prices, links, quote wording/attribution, product claims, signatures and disclosures unless a reviewer obtains new customer approval.
- **Distinct editorial adaptation:** adjust relevant length/format/structure/neutrality/keywords/links within genuine publisher rules. Avoid mechanical 'article spinning', search manipulation, or misrepresentation.
- **Customer control:** user approves the master; optionally previews all publisher variants in a distribution review dashboard. Automatic publication of variants is permissible only when deterministic/factual checks pass and the changes are editorial, not substantive.
- **Review escalation:** failed, ambiguous or materially different variants enter \`needs_review\`; a reviewer may reject/regenerate or request customer approval, never silently ignore a failed fact check.
- **No fallback to unchanged master:** if rewriting is mandatory for an external publisher and generation fails, hold that destination rather than dispatching the unadapted original.
- **Account mode remains Pubbblic-owned:** publishing permissions and quotas remain destination-specific and must authorize distribution on behalf of third-party customers.
- **No guarantee:** 'rewritten', 'submitted', 'accepted for review' and 'published' are distinct states.

## Data contracts (recommended)

- \`publisher_editorial_profiles\`: publisher ID, version, field constraints, citations, approvals, effective time.
- \`release_variants\`: unique \`release_version_id\`, publisher ID, rules version, prompt version, variant version, JSON content, content hash, generation and validation statuses, timestamps, reviewer.
- \`variant_fact_checks\`: immutable assertions compared to canonical facts, findings, overrides, reviewer and provenance.
- \`ai_generation_usage\`: provider/model identifier, prompt version, request ID, token counts, estimated cost, retry count, redacted failure class.
- \`campaign_destinations\`: frozen \`release_variant_id\`, execution method, publisher account ID (server-side only), authorization and current state.
- \`submission_attempts\`: destination ID, variant ID/hash, external receipt, attempt ID, final outcome and evidence.

Use tenant-aware RLS for customer-visible versions and strictly service-role-only access to publisher secrets. Never record API keys or unredacted private publisher sessions in logs or GitHub.

## DeepSeek API integration notes (subject to ongoing documentation review)

- Server-side endpoint: \`https://api.deepseek.com/chat/completions\`.
- Default model: \`deepseek-flash\`. Consider \`deepseek-v4-pro\` only after testing quality/cost improvements.
- Request JSON output using \`response_format: {"type":"json_object"}\` and a prompt including 'json' and the expected schema. JSON validity is NOT schema validity or factual correctness; validate and reject blank/truncated/invalid outputs.
- Use bounded request concurrency, retry budgets, timeouts, tokens-per-job and spend ceilings. Monitor model changes and benchmark against regression fixtures.
- Customer content sent to an external AI provider must have suitable customer notice, contractual/privacy review, data minimization and retention controls.

## Required tests and gates

1. Unit fixture: all 19 target editorial profiles can produce and validate an individual version without cross-tenant leakage.
2. Canonical immutability: rewriting does not mutate the approved master or change original quotes/numbers/attribution.
3. Missing rules, ambiguous publisher permissions or stale rule versions block dispatch.
4. JSON truncation, malformed response, provider 429, timeout and partial network failure lead to safe retries/escalation.
5. Multi-publisher batches are idempotent, cost-accounted, and preserve independent variant IDs.
6. The customer/authorized reviewer can inspect the original and publisher version, corrections, and provenance.
7. Submitted receipt records the exact version/hash, while publication verification evaluates the content actually posted.
8. No destination is enabled before publisher permission, editorial compliance, security/UAT and product-owner launch approval.

## GitHub roadmap mapping

- PUB-06.10 — publisher rules
- PUB-06.11 — DeepSeek rewrite generation and provenance
- PUB-06.12 — factual QA, review, dispatch gate
- PUB-06.03 — publisher execution routing
- PUB-06.04 — variant-bound idempotency
- PUB-08.03 — exact variant publication matching
- PUB-12.01 — end-to-end staging acceptance

**Implementation note:** Existing local ZIP/CSV imports may contain earlier 138-issue snapshots. GitHub issues and this ADR are authoritative; the new three issues must be added to the active GitHub Project and source backlog during the next sync.
