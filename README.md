# City/Sync — Volunteer Management Application

An application for a closed-loop civic credit system connecting **Participants**,
**Issuer Organizations**, and **Redeemer Organizations** — built database-first with an
event-sourced ledger designed to migrate module-by-module onto the City::Sync contract suite.

## Architecture

```
UI (Next.js App Router, server actions)
  └── Protocol services           src/lib/services/
        identity · waivers · opportunities · redemption
  └── Control database            identities · city registry · access
  └── One database per city       wallets · credit journal · hash chain · anchors
  └── Anchoring port              src/lib/protocol/anchor.ts
        StubAnchorAdapter (default) | BaseAnchorAdapter (integration point)
  └── Drizzle ORM + libSQL        src/lib/db/
        file:local.db locally · Turso on Vercel
```

Design rules carried over from the protocol work:

- **Each city has an independent credit economy**: Berkeley credits never appear in Mexico City,
  and each city has its own wallet table, credit journal, and hash chain.
- **A single global identity** follows the participant between cities, without sharing city balances.
- **Every state mutation writes its event in the same transaction** as the projection update.
  The ledger is the system of record; tables are projections.
- **Waivers are hash-first**: the org keeps the document; the ledger records `sha256(body)` and
  each acceptance against that hash. This is exactly what a future on-chain
  `IssuerWaiverRegistry` stores — nothing else changes.
- **Anchoring is a port**: `ANCHOR_MODE=stub` computes and publishes Merkle roots locally;
  implementing `BaseAnchorAdapter` (comments inline) turns the same roots into Base transactions.

## Getting started

```bash
npm install
cp .env.example .env     # defaults work out of the box
npm run setup            # creates schema + seeds demo data
npm run dev              # http://localhost:3000
```

### Demo accounts (after `npm run setup`)

| Role        | Email                          | Password        |
|-------------|--------------------------------|-----------------|
| Admin       | admin@city-sync.org            | admin-citysync  |
| Issuer      | issuer@demo.city-sync.org      | demo1234        |
| Redeemer    | redeemer@demo.city-sync.org    | demo1234        |
| Participant | participant@demo.city-sync.org | demo1234        |

### The full loop to try

1. Sign in as the **participant** → browse opportunities → claim one (you'll accept the
   Riverside Food Bank waiver — note the document hash) → submit completion.
2. Sign in as the **issuer** → verify the completion → credits mint.
3. Back as the **participant** → Redeem Credits → request a transit pass → get a 6-char code.
4. Sign in as the **redeemer** → enter the code → credits burn.
5. Sign in as **admin** → Ledger & Anchors → Create anchor → see the Merkle root.
6. Visit `/transparency` (public, no login) → stats, chain integrity, anchors.
7. Visit `/transparency/log` → per-event verification: every event re-hashed and
   chain-linked live, in plain English, with expandable proof detail.
8. Check the **MyCity Feed** (`/feed`) — orgs post updates; participants heart them.

### Sandbox mode

`SANDBOX_MODE=true` (default): organizations are auto-approved at signup so nothing blocks
exploration. Set `SANDBOX_MODE=false` to restore admin review. Auto-approvals are still
recorded on the ledger as `ORG_APPROVED { sandbox: true }` — the history stays honest.

## Deploying to Vercel

1. Create a free database at [turso.tech](https://turso.tech).
2. In Vercel project settings, set:
   - `DATABASE_URL` = `libsql://<your-db>.turso.io`
   - `DATABASE_AUTH_TOKEN` = your Turso token
   - `CITY_DB_BERKELEY_URL` and `CITY_DB_MEXICO_CITY_URL` = separate Turso databases
   - matching `CITY_DB_<CITY>_AUTH_TOKEN` values
   - `AUTH_SECRET` = `openssl rand -hex 32`
   - `ANCHOR_MODE` = `stub`
3. Run migrate + seed once against the Turso URL from your machine:
   `DATABASE_URL=libsql://… DATABASE_AUTH_TOKEN=… npm run setup`
4. Deploy. No code changes — the libSQL client speaks both `file:` and `libsql://`.

## Iterative path to chain integration

| Step | Module | What changes |
|------|--------|--------------|
| now  | Everything off-chain | `ANCHOR_MODE=stub`, Merkle roots public on `/transparency` |
| 1    | Anchoring | Implement `BaseAnchorAdapter` — roots land on Base for cents |
| 2    | Waivers | On-chain `IssuerWaiverRegistry`: same hashes, embedded smart-account signatures |
| 3    | Identity | `IssuerRegistry` mirrors org approvals |
| 4    | Credits | `CityToken` mint/burn as async mirror, then authoritative |
| 5    | Governance | Last — after the city rules settle |

## Verifying the ledger

- `/transparency` re-verifies the full hash chain on every load.
- `src/lib/ledger/ledger.ts → verifyChain()` recomputes every event hash.
- Each anchor's Merkle root covers events `fromSeq–toSeq`; with a database export, any third
  party can recompute the root and compare.
