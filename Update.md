# Progress — Update Log

Running record of what has been built, changed, and decided in this repo.
Newest entries at the top. Each entry: date, summary, changes, decisions, verification, next.

> Convention: this file is updated at the end of every working session. Keep entries factual —
> what changed, why, and how it was verified. Decisions get their own line so we can trace
> "why is it like this?" later.

---

## 2026-06-10 — Session 3: Volunteer roster + messaging, full admin suite

### Summary
Ported the CS1 issuer-workspace roster concept onto real data, added org-to-volunteer
in-app messaging, and built out the complete admin function set.

### Changes
- **Volunteer roster** (`/issuer/volunteers`, in issuer nav): roster derived from real
  claims (everyone who ever claimed an org opportunity), with derived status —
  `active` (verified work in last 30 days), `on a task` (live claim), `needs current
  waiver` (hasn't accepted the active waiver version), `inactive`. Stats, search,
  grouping by completed opportunity (CS1's task-type groups, computed from verified
  claims instead of mock labels). Per-volunteer: completions, credits earned with org,
  last activity. (`src/lib/services/roster.ts`)
- **Roster messaging**: issuers send in-app messages to the full roster or a
  completed-task group (CS1's email modal, made real). Recipients frozen at send time;
  participants get an inbox on their dashboard with unread highlighting and
  auto-mark-read. Ledger records `MESSAGE_SENT` (subject, scope, recipient count —
  body stays in the app DB). New tables `org_messages`, `message_recipients`.
- **Admin suite**:
  - `/admin/users`: search/filter all accounts; disable/re-enable (blocks login and
    invalidates in-flight sessions at the action layer); password reset (temp password
    shown once); participant credit adjustments (± with mandatory reason, can't go
    below zero, positive counts toward lifetime earned).
  - `/admin/oversight`: close any opportunity, cancel any pending redemption, remove
    MyCity posts with reason.
  - Existing: org approval/suspension (`/admin`), ledger & anchors (`/admin/ledger`).
  - **Every admin action is ledgered** (`USER_DISABLED/ENABLED`, `USER_PASSWORD_RESET`,
    `CREDITS_ADJUSTED`, `POST_REMOVED`, `TASK_CLOSED {byAdmin}`,
    `REDEMPTION_CANCELLED {byAdmin}`) and described in the public verification log —
    admin power is visible by construction.
- Schema: `users.status` column (additive migration handles existing databases).

### Decisions
- Roster membership = has ever claimed (not just completed) — issuers need to see and
  message people with open commitments, not only alumni.
- Messages are in-app only for now; email delivery rides on the Phase 1 notifications
  workstream (roadmap §5.1) rather than a parallel system.
- Admins cannot disable themselves or other admins from the UI; participant-only
  credit adjustments (org accounts hold no balances).
- Ledger never stores message bodies or passwords — subjects/counts/facts only.

### Verification
- Production build clean (21 routes).
- 25-assertion E2E: roster derivation (counts, credits, status, task groups, search),
  messaging (roster + group send, empty-group rejection, unread → read), credit
  adjustments (grant, over-burn rejection, missing-reason rejection, non-participant
  rejection), disable/enable + self-disable guard, password reset (temp password
  verified against stored hash), post moderation, admin task close, chain intact
  across all new event types.

### Next
- Email delivery for notifications + messages (Phase 1 hardening).
- Real `BaseAnchorAdapter` (Base Sepolia).

---

## 2026-06-10 — Session 2: Sandbox mode, MyCity Feed, public verification log

### Summary
Removed sandbox friction, added the first social surface, and made ledger verification
visible to non-technical viewers.

### Changes
- **Sandbox mode** (`SANDBOX_MODE`, default `true`): organizations are auto-approved at
  signup. Auto-approval is still recorded on the ledger as `ORG_APPROVED { sandbox: true }`
  so history stays honest. `SANDBOX_MODE=false` restores admin review. (`src/lib/config.ts`,
  `src/lib/services/identity.ts`)
- **MyCity Feed** (`/feed`, in every role's nav): issuer and redeemer orgs post updates
  (1,000-char limit); civic participants can heart/unheart posts; no comments by design.
  Heart restriction enforced at both the action layer and the service layer. New tables
  `posts`, `post_hearts`; new events `POST_CREATED`, `POST_HEARTED`, `POST_UNHEARTED`.
  (`src/lib/services/feed.ts`, `src/app/feed/`)
- **Public verification log** (`/transparency/log`): every ledger event re-verified live —
  hash recomputed (✓ hash) and link to previous event checked (✓ chain) — described in
  plain English with expandable proof detail (hash, prev, payload). Users pseudonymous,
  org names resolved. (`src/lib/ledger/describe.ts`, `verifyChainDetailed()` in
  `src/lib/ledger/ledger.ts`, `src/app/transparency/log/`)
- Seed now includes two sample MyCity posts.

### Decisions
- Participants have no approval gate anywhere (never did); sandbox mode only affects orgs.
- Waiver gate kept in sandbox — it is core product behavior, controlled by each issuer.
- Hearts are ledger events: social proof becomes part of the verifiable record.

### Verification
- Production build clean (18 routes).
- E2E: org auto-approval; post → heart → unheart → re-heart; org account blocked from
  hearting; feed counts correct; chain intact across all new event types; tamper test
  still detected at exact seq.

### Next
- Real `BaseAnchorAdapter` (Base Sepolia first) so anchors carry clickable tx hashes.
- See `~/dev/CitySync-Roadmap.md` for the full path forward.

---

## 2026-06-10 — Session 1: Initial build of the Volunteer Management Application

### Summary
Built the complete pilot application from scratch: database-first, event-sourced,
chain-ready. Full civic-credit loop working end-to-end.

### Changes
- **Stack**: Next.js 14 (App Router, server actions) · TypeScript · Tailwind ·
  Drizzle ORM + libSQL (`file:local.db` locally, Turso on Vercel) · jose sessions ·
  bcryptjs. Brand assets carried over from CS1.
- **Ledger core** (`src/lib/ledger/`): append-only, hash-chained event log
  (sha256 over prevHash | type | ts | actor | canonical-JSON payload), written in the
  same transaction as every projection update. Merkle roots over event ranges.
  `verifyChain()` recomputes the full chain.
- **Anchoring port** (`src/lib/protocol/anchor.ts`): `StubAnchorAdapter` (default) computes
  and stores roots locally; `BaseAnchorAdapter` is the documented integration point for
  posting roots to Base.
- **Protocol services** (`src/lib/services/`): identity (signup, org registration,
  approval), waivers (versioned, hash-first, atomic rollover — mirrors
  IssuerWaiverRegistry S-07), opportunities (create → claim → submit → verify/reject,
  waiver gate, slot limits — mirrors OpportunityManager), redemption (two-step
  request + finalize-by-code, burn-on-finalize — mirrors Redemption contract), stats.
- **Event names mirror the City::Sync contract suite** (`TASK_CLAIMED`, `CREDITS_MINTED`,
  `WAIVER_ACCEPTED`…) so pilot history can be replayed onto chain modules later.
- **Roles & UI**: participant (browse/claim/submit, wallet, redeem), issuer (publish,
  verify & mint, waiver management), redeemer (offerings, finalize-by-code), admin
  (org approval, ledger explorer, anchor creation), public `/transparency`.
- **Auth**: email/password, JWT session cookie, role-guarded layouts.
- Seed: admin + demo issuer (Riverside Food Bank) + demo redeemer (Metro Transit
  Authority) + demo participant; 2 opportunities, 2 offerings, 1 active waiver.

### Decisions
- **Database-first, chain-later**: validate the economics before paying chain friction;
  the ledger preserves provenance for later replay (per architecture discussion).
- **libSQL over Postgres**: zero-config locally, Turso free tier on Vercel, no dialect split.
- **Credits non-transferable by construction** — no transfer endpoint exists.
- **Waivers hash-first**: org keeps the document; ledger stores sha256 + acceptances
  against that hash. Platform stays out of the agreement (registry, not party).
- Verification mode is IssuerOnly for the pilot; other contract modes slot in behind the
  same service functions.

### Verification
- Production build clean (16 routes).
- 20-assertion E2E through the real services: waiver gate blocks unsigned claims;
  double-claims rejected; over-balance redemptions rejected; wrong-org and replayed
  redemption codes rejected; balances correct after mint/burn; anchor created; full
  chain verified intact; tampering with event #5 detected at seq 5.
- Live server smoke test: all routes 200, auth redirect 307, brand assets served,
  transparency page reports "chain intact" on fresh seed.

### Known gaps (deliberate)
- Anchors have no on-chain tx yet (`ANCHOR_MODE=stub`).
- Seeded waiver text is placeholder — real counsel required before any real participant signs.
- No email verification, password reset, or rate limiting (sandbox).
- Single city implied; no multi-tenancy yet.
