# City/Sync: repository assessment and mission coordination plan

Prepared September 22, 2026. This is an assessment and proposed implementation sequence, not an implementation or a replacement for previously approved product decisions.

**City/Sync already has much of the operating foundation for the practical system discussed in this conversation. The next product milestone should connect existing organizational programs to shared missions, preserve responsibility between contributions, and measure whether the resulting service improves.**

**Review scope.** The main checkout is `/Users/nathansuits/dev/Progress`, `main` at `aabaed6`. The September business plan points to the newer development worktree, `/Users/nathansuits/dev/Progress-aesthetic-lab`, `branch1/CSV1.0` at `63b3e9b`; I also inspected its current working files. The histories differ by one main-only commit and 25 development-only commits. The newer worktree has four existing modified UI files. Neither application checkout was modified by this review. This document is the only added repository artifact.

The assessment covers schemas, domain services, selected server actions and screens, ledger delivery, existing regression scripts, and architecture/business planning documents. It is not a production-environment audit, a comprehensive security audit, or a browser usability study. Source implementation does not establish adoption, service impact, or operating reliability at scale.

**Checks performed.** TypeScript checks passed in both checkouts with `tsc --noEmit --incremental false`. The newer worktree's program-workspace, volunteer-intake, and city-ledger-outbox regression scripts passed using their disposable database-copy mechanisms. Email delivery was explicitly set to the stub adapter. No production database was targeted. A production build and live deployment review were not performed.

**What is already valuable.** The application separates individual identity from organizational authority, supports organization permissions, records participation, and supplies reusable scheduling and intake workflows. City databases hold separate credit wallets and journals. The transactional outbox supplies a useful boundary for extending coordination across institutions. The newer work adds substantive program management, rather than only changing appearance.

| Capability | Main checkout | Newer development worktree | Next requirement for the practical model |
|---|---|---|---|
| Organizational operations | Opportunities, shifts, claims, attendance, rosters, messages, reports | More scheduling, recurring assignments, staff assignments, batch verification, event chat | Preserve these working flows |
| Program structure | Opportunities belong directly to organizations | Organization-owned programs and reusable positions | Associate existing programs with shared missions |
| Continuing work | Shift and claim history | Work areas with purpose, next step, status, and linked positions | Accountable owner, dependencies, accepted deliverables, and handoffs |
| Measurement | Participation, estimated scheduled hours, credits | Custom units, targets, reporting periods, dated entries, correction notes | Outcome definitions, baselines, evidence, aggregation rules, and review |
| Onboarding | City onboarding and organization waiver/credential gates | Shared, program-specific, or no onboarding; application and admission workflows; versioned materials | One understandable requirements evaluator with justified requirements and exceptions |
| Learning and recognition | Resume, feed, credit records | Private reflections, improvement ideas, personal/team appreciation | An idea-to-experiment-to-adoption workflow |
| Portable trust | Global credential types with expiry and revocation | Same foundation plus organization-local eligibility/identity records | Recipient-controlled acceptance by issuer, purpose, scope, and validity |
| Shared governance | Organization roles and city administration | Stronger organization workflows | Mission membership, resident representation, decision rights, and review/appeal |
| Public accountability | Hash chain, local Merkle anchors, public event display | Private-intake event exclusions | Explicit publication rules, permitted evidence, outcome summaries |
| Economic support | Credit issuance and redemption | Participation UI stages credit visibility | Funded coordinators, access support, and optional recognition independent of service recording |

Evidence: [main schema](/Users/nathansuits/dev/Progress/src/lib/db/schema.ts:340), [newer program schema](/Users/nathansuits/dev/Progress-aesthetic-lab/src/lib/db/schema.ts:454), [work areas and metrics](/Users/nathansuits/dev/Progress-aesthetic-lab/src/lib/db/program-workspace-schema.ts:27), [program workspace guide](/Users/nathansuits/dev/Progress-aesthetic-lab/PROGRAM_WORKSPACE.md:1), [intake guide](/Users/nathansuits/dev/Progress-aesthetic-lab/VOLUNTEER_INTAKE.md:1).

**The remaining product gap is the relationship between organizations.** A program currently belongs to one organization. A work area can link positions from that program, and measurements are scoped to the organization/program. These are useful foundations for mission continuity, but they do not yet establish a jointly governed outcome, an obligation accepted by another organization, or common measurement across partners.

For example, a food bank, neighborhood association, and transport provider could all contribute to reliable food access. City/Sync can record much of their individual volunteer activity. The proposed extension would record their joint purpose, which part each partner has accepted, what is blocked, who receives the next handoff, and whether residents' access improves.

**Preserve the existing application and add a small mission layer.** Keep organization-owned programs, tasks, shifts, claims, credentials, waivers, and operational records. Initially retain the current deployment and database layout with explicit authorization boundaries. The September business plan already permits this sequencing; it should guide near-term work over the earlier architecture document's more aggressive organization-database extraction sequence. See [business plan](/Users/nathansuits/dev/Progress/deliverables/planning-documents/CitySync_Business_Plan_and_Public_Infrastructure_Roadmap.md:75).

Proposed relationships:

```text
City or local network
  Mission: shared purpose, service population/place, accountable lead
    Participating organizations and resident representatives
    Agreed outcomes and measurement definitions
    Links to existing organization-owned programs
      Existing work areas with owners and completion criteria
        Existing positions, shifts, and participation claims
        Deliverables, dependencies, and accepted handoffs
```

A mission should not give partners access to one another's applicants, waivers, internal notes, or private service records. Each partner expressly shares selected commitments, artifacts, and measurements. A mission-level role grants mission-level powers, not organization ownership. Existing authority identities can support this, but authorization needs explicit mission scopes.

**Proposed domain additions, in build order.** These are conceptual records, not a demand to implement every table in the first release.

| Domain | Minimal information | Reuse and migration approach |
|---|---|---|
| Mission | City, purpose, population/place, accountable lead, review date, status, visibility | New record; organization programs continue independently |
| Mission membership and program links | Accepted partner membership, authorized representative, role, linked program, visibility agreement | New explicit associations; no automatic sharing when an organization joins |
| Outcome definition | Measure, unit, baseline/date, target/date, collection method, steward, population/period, aggregation rule | Extend the existing metrics mechanism with structured meaning |
| Work commitment | Existing work area, owner, reviewer, due/review date, acceptance criteria, dependencies | Extend work areas; use normalized associations as links become consequential |
| Handoff and artifact | Sender, intended recipient, related commitment, deliverable/reference, receipt state, next action | New records; private content stays in authorized storage |
| Observation | Outcome, period, value or numerator/denominator, source, reviewer, evidence reference, correction relationship | Extend metric entries while preserving existing manual totals |
| Participation preference | Interests, desired commitment, availability, learning goals, support needs, consent | Extend participant settings; keep sensitive support details restricted |
| Improvement proposal | Observed issue, hypothesis, responsible reviewer, trial, decision, follow-up | Start from existing private reflections with explicit permission to share |

Map existing manual metrics to a clearly labeled manual-total type. Do not reinterpret old entries as independently verified outcomes. Rates require denominators; snapshots require an as-of date; unique households require an explicit counting method. Summing every entry cannot correctly represent all these measures. Do not infer cross-organization unique people from organizational totals or centralize household identity merely to produce a dashboard.

**The first implementation should prove one complete mission cycle.** Use one locally selected service problem with two or three willing organizations, an accountable paid coordinator, and resident input. Food access is an illustrative candidate, not a validated choice or a claim that partner commitments already exist.

1. The partners agree on one service outcome and assign a steward for its measurement.
2. The coordinator creates a mission and invites each partner through an explicit acceptance step.
3. Each organization links an existing program and accepts one or more work commitments.
4. A volunteer sees the contribution's purpose and joins an existing shift or a bounded project commitment.
5. The organization records the contribution. A deliverable, unresolved issue, or next step can be attached with appropriate visibility.
6. The next responsible person or organization acknowledges the handoff. Silence remains an unresolved handoff, not successful completion.
7. The outcome steward records a measurement and its evidence. The team reviews both service performance and coordination effort.
8. One proposed improvement is tested, accepted or declined with reasons, and incorporated into maintained guidance if successful.

The key demonstration is that a volunteer can finish a session or leave a project and another person can continue without reconstructing context. A second demonstration is that a partner can withdraw and responsibilities can be reassigned without losing history or interrupting essential service.

**Use four focused product surfaces.**

- The participant home shows chosen missions, the next useful contribution, their team/contact, preparation requirements, and what happened after their last contribution. Existing scheduling remains available.
- The program workspace retains its current structure and adds mission links, accountable work areas, handoff status, and relevant outcome measures.
- The mission workspace shows partner responsibilities, unmet capacity, blocked work, upcoming decisions, and reviewed results. It should distinguish missing people from missing transport, equipment, money, or authority.
- The coordinator queue brings together pending approvals, unaccepted handoffs, requests for help, coverage gaps, measurement reviews, and improvement proposals. Every item has an owner and a next action.

For occasional participation, provide bounded instructions and review. For recurring service, maintain a consistent team and backup. For project contributions, provide deliverable acceptance. For stewardship, assign continuing responsibility and a supported transfer process. A commitment's time horizon is a participation choice; it is separate from permission to act for an organization.

**Resolve several existing implementation and policy tensions.**

| Finding | Evidence and practical consequence | Recommended response |
|---|---|---|
| Contribution verification depends on credit minting | The newer `verifyCompletion` calls the city credit service before recording the verified claim. A city-wallet failure can therefore prevent recording completed service. | Commit service verification and a recognition request atomically in the operational database. Process optional credits idempotently afterward, with visible pending status and reconciliation. Preserve current earned history. |
| Participation penalties are broad | Three onboarding no-shows while a participant remains new can create a 183-day city bar; late self-cancellation is blocked inside 24 hours. | Reconsider as an explicit product-policy decision. Provide late-cancellation recording, reasons, rescheduling, support, and human review; scope restrictions to justified risks and provide recourse. Do not silently change the existing rule. |
| Self-service capacity checking occurs before the insert transaction | `checkClaimGate` counts claims before `claimShift` begins its write transaction. The per-person uniqueness constraint does not enforce total shift capacity. | Enforce capacity atomically and add a simultaneous-last-slot regression. This is a source-level concurrency concern, not a reproduced production incident. |
| Portable credentials accept a broad global type | `getHeldCredentials` checks verified status and expiry but does not evaluate whether the receiving organization recognizes the issuer or intended use. | Preserve source attestations and introduce explicit receiving-organization acceptance policies. Reusable evidence should reduce repetition while retaining justified local decisions. |
| Public event exposure relies on exclusions | The newer ledger excludes designated intake events, but other events can still be copied to the city ledger and displayed with payloads. | Define an allowlist and disclosure schema for new mission events. Public results should be approved aggregates; membership in a mission must not publish private case or support information. |
| Production authentication has a development-secret fallback | Both inspected session implementations fall back to a known string when `AUTH_SECRET` is absent. This does not establish the deployed configuration. | Fail startup in production when the secret is missing, and test configuration failure explicitly. |
| Dependency baseline needs updating | Both manifests specify Next.js 14.2.18. The framework's December 2025 advisory already identifies later patched 14.x releases. | Select a supported, patched baseline and run release checks. This review did not determine a live exploit or audit every dependency. |
| Documentation overstates complete event sourcing | Some state updates do not emit full reconstruction data; for example, work-area audit events intentionally omit free-form content. | Describe the implementation as transactional application state with an audit journal unless a particular projection has a tested replay contract. Keep private operational backups. |

Code references: [verification and credit coupling](/Users/nathansuits/dev/Progress-aesthetic-lab/src/lib/services/opportunities.ts:1281), [participation restrictions](/Users/nathansuits/dev/Progress-aesthetic-lab/src/lib/services/city-participation.ts:109), [late cancellation](/Users/nathansuits/dev/Progress-aesthetic-lab/src/lib/services/opportunities.ts:1185), [capacity check](/Users/nathansuits/dev/Progress-aesthetic-lab/src/lib/services/opportunities.ts:1061), [claim transaction](/Users/nathansuits/dev/Progress-aesthetic-lab/src/lib/services/opportunities.ts:1162), [credential acceptance](/Users/nathansuits/dev/Progress-aesthetic-lab/src/lib/services/credentials.ts:13), [event disclosure](/Users/nathansuits/dev/Progress-aesthetic-lab/src/lib/ledger/ledger.ts:96), [public payload display](/Users/nathansuits/dev/Progress-aesthetic-lab/src/components/ledger/VerificationLog.tsx:46), [session secret](/Users/nathansuits/dev/Progress-aesthetic-lab/src/lib/auth/session.ts:20), [work-area audit content](/Users/nathansuits/dev/Progress-aesthetic-lab/src/app/aesthetic-lab/issuer/program-workspace-actions.ts:93). External reference: [Next.js security update](https://nextjs.org/blog/security-update-2025-12-11).

These concerns should be addressed according to the chosen pilot's scope. Existing passing regression checks do not cover all concurrency, cross-database recovery, publication, and production-configuration cases.

**Governance and operations must be built alongside software.** Each pilot mission needs an accountable coordinator, partner commitments, a supported process for resolving disputes, resident representation, and a coverage plan for essential work. Budget for coordinator time, volunteer access costs, training, supervision, measurement, and fallback delivery. Software can show a shortage; a funded operator must be able to act on it.

Keep residents and public-purpose organizations free at the point of participation, consistent with the September plan. A government commissioner or private sponsor can fund the network's operation. Separate the company's service fee, the mission's delivery/access budget, and any credit-benefit funding. Credits cannot pay staff or create transport capacity by themselves. See [free-access and payer model](/Users/nathansuits/dev/Progress/deliverables/planning-documents/CitySync_Business_Plan_and_Public_Infrastructure_Roadmap.md:46).

Resident voice should include people receiving services and those unable to volunteer. The older roadmap's contribution-linked voting proposal should be revisited before using it for public priorities. Contribution records can inform operational expertise; public representation needs its own agreed basis. This is a recommendation for a policy discussion, not an implemented change.

**Proposed delivery sequence.** Advance on evidence rather than an invented percentage-complete estimate.

| Stage | Product and engineering work | Operating work | Acceptance gate |
|---|---|---|---|
| 0. Establish the baseline | Reconcile the two branches without losing documents or local edits; designate the deployable version; add critical configuration, capacity, privacy, and recovery checks | Choose one problem, coordinator, partner group, and budget owner; record the current workflow burden | A reproducible release and a funded, agreed pilot scope |
| 1. Connect existing programs | Mission, accepted membership, scoped program links, accountable work areas, one agreed outcome | Partners agree who owns which service commitments and what they will share | Two organizations can pursue the same mission while private records remain isolated |
| 2. Make work continue | Deliverable acceptance, handoffs, next-owner acknowledgement, review dates, backup/reassignment, basic project commitments | Practice departures, absences, and partner withdrawal | Work continues after the original contributor leaves; unaccepted work is visible |
| 3. Close the learning loop | Structured outcomes, evidence references, corrections, private feedback, proposal/trial/decision flow | Conduct regular service and resident reviews; act on identified shortages | At least one measured improvement changes the operating process |
| 4. Prove repeatability | Harden the used paths, exports, monitoring, support tools, acceptance-policy reuse | Run a complete operating cycle and seek a concrete renewal decision | Useful service, acceptable burden, and funded continuation are demonstrated |
| 5. Expand shared infrastructure | Cross-organization credential acceptance and narrowly scoped external APIs; independent verification where demanded | Agree trust, maintenance, and operator responsibilities | A second network or external institution reuses the capability successfully |

Keep blockchain integration, independent organization-node extraction, generalized policy engines, and sophisticated automated matching on their evidence-gated architectural path. The existing anchor adapter is a stub/integration point; it does not currently supply external public-chain finality. The mission pilot can establish coordination value before those broader investments. See [anchor adapter](/Users/nathansuits/dev/Progress/src/lib/protocol/anchor.ts:21).

**Evaluate the pilot against the current workflow.** Agree definitions and targets after observing a baseline. Suggested measures are time from interest to first useful contribution; staff minutes per fulfilled commitment; unresolved handoffs and their age; coverage and missed-service rate; relevant resident outcomes; volunteer experience and return intentions; and actual operating cost. Retention should not penalize successful bounded participation. Track unequal access and who remains unserved.

For the illustrative food-access mission, outputs might include completed deliveries; reliability might be the proportion of promised deliveries fulfilled on time; a resident outcome might be reported days without adequate food; capacity might be backup coverage and available delivery slots. Keep each measure's denominator and method explicit. A before/after change alone cannot establish causality; use a comparable group or staged rollout where feasible and report external changes and uncertainty.

**The next build specification should be a complete mission pilot using the current program workspace:** two or three organizations, one agreed service outcome, existing volunteer scheduling, an accountable coordinator, accepted handoffs, and a reviewed result. That is the smallest addition that tests the central idea: contributions can accumulate into dependable community capacity across institutional boundaries.
