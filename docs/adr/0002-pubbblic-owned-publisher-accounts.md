# ADR-0002: Pubbblic-owned publisher accounts only

**Status:** Accepted
**Decision date:** 2026-11-08
**Authority:** Product owner decision
**Scope:** Publisher connectivity, distribution, account custody, UX, security and launch gates

## Decision

Pubbblic exclusively creates, owns, controls and operates the publisher accounts used to submit customers' approved press releases to external destinations.

A Pubbblic customer creates, edits, approves and purchases distribution of a release inside Pubbblic. They **never** connect their own third-party publisher account, enter publisher credentials, grant publisher OAuth access, maintain publisher sessions or perform destination-site authentication.

This supersedes the previously proposed hybrid account model.

## Supported delivery methods

1. **Publisher API / formal partner delivery:** Execute through approved publisher access held by Pubbblic, within the applicable commercial agreement.
2. **Authorized Zyte API Actions workflow:** Pubbblic-controlled account, authorized and permitted form automation, executed by a remote service through its HTTP API. A connector may be activated only after permission, capacity, end-to-end verification and security gates pass.
3. **Pubbblic-operated manual submission:** When automation is unavailable or not authorized, an internal Pubbblic operator prepares/submits through Pubbblic's permitted account and records evidence. Customer participation is limited to approvals or corrections inside Pubbblic, not external login.

No publisher should be shown as available until permission, account standing, fees, geography and operational capacity are verified.

## Explicit exclusions

- Customer-connected / bring-your-own publisher account (BYOA).
- Customer-supplied publisher passwords, cookies, tokens or OAuth grants.
- Publisher Connections pages or connect/disconnect account flows in customer UI.
- Customer-assisted destination-site login and direct submission workflows.
- Browser or network evasion of CAPTCHA, MFA, anti-bot restrictions or publisher rules.
- Publication guarantees absent an actual contractual basis and verified evidence.

## Data and product implications

- Publisher account inventory is restricted to Pubbblic internal admins and service roles.
- Secrets and sessions are managed server-side, encrypted, audited and never exposed to tenant users.
- One publisher may have multiple Pubbblic-owned accounts only if permitted by that destination; never use multiple accounts to evade quotas.
- Distribution routes by destination eligibility and execution channel, not by customer login state.
- Customers only see availability, plan pricing, expected service levels, submission/editorial/publication status and independently verifiable proofs.
- Publisher revocation, credential suspension, quota exhaustion or legal changes disable new jobs and trigger operational escalation.
- Retain explicit customer authorization to distribute *their content*, independent of publisher-account ownership.
- Account-level limits, subscription costs, paid publishing credits and posting frequency factor into service pricing and capacity planning.

## Acceptance and release gates

- [ ] Each live destination has written evidence supporting Pubbblic's use of its own account to submit releases on behalf of paying third-party customers, including allowed automated/manual methods.
- [ ] Internal publisher account setup, MFA/expiry/rotation, session isolation and access revocation pass security tests.
- [ ] Authorized Zyte/API/manual connector completes a controlled pilot and produces an independently verified submission/publication record.
- [ ] Queues enforce global limits by destination and Pubbblic account, plus customer-specific campaign entitlements.
- [ ] Marketing and checkout do not represent submission as guaranteed publication or imply unauthorized publisher partnerships.
- [ ] No external publication is enabled until the destination-specific compliance gate and product-owner release authorization are approved.

## Backlog mapping

- PUB-00.01 — Core ADRs and contracts
- PUB-05.02 — Pubbblic-owned account authorization contract
- PUB-05.03 — Publisher registry, account inventory and eligibility
- PUB-05.04 — Internal account provisioning and admin controls
- PUB-05.07 — Pilot publisher authorization
- PUB-06.03 — Eligibility routing
- PUB-07.03 — Internal secrets/session broker
- PUB-07.06 — Pubbblic-operated manual submission workspace
- PUB-12.06 — Legal/publisher permissions gate

This ADR supersedes any contradictory account-mode language in older ZIP exports or historical roadmap documents; current GitHub issues and this ADR are the canonical forward implementation contract.
