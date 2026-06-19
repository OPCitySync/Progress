# City/Sync — Volunteer Feature Roadmap

*Prepared June 2026 · maps common volunteer-management features against what City/Sync has already built, sets a priority order, and proposes out-of-the-box expansion options that exploit City/Sync's distinctive architecture.*

---

## 1. Where City/Sync stands today

City/Sync is already past the "list and sign up" stage that most volunteer tools start from. Built today:

- **Opportunities & claims** — issuers publish opportunities; participants claim, submit completion, and get verified.
- **Liability waivers** — hash-first: the ledger records `sha256(document)` and each acceptance against that hash.
- **Recognition economy** — verified work mints **non-transferable civic credits**; redeemer organizations accept credits for goods/services, burning them on redemption.
- **Public discovery** — a fixed-template public profile per organization, a searchable `/orgs` directory, and a featured recurring **onboarding task** as the entry point for newcomers.
- **Impact + transparency** — per-org impact stats plus an append-only, hash-chained ledger with Merkle anchoring (currently local/stub, with a clean path to Base).
- **Community layer** — a MyCity feed, roster messaging, and admin oversight.

**The moat.** Most products in this market compete on scheduling and reporting. City/Sync's differentiators are the **credit economy**, the **redeemer marketplace**, and a **verifiable ledger**. The roadmap below fills the conventional gaps *and* — more importantly — proposes features that only City/Sync's architecture makes possible.

---

## 1b. Build decisions — locked (June 2026)

**Committed to build now:**

- **All of Phase 1** — shift scheduling, automated reminders, on-site check-in & hours, admin reporting/exports.
- **Phase 2 #5** (screening & credentials) and **#6** (skills matching & alerts).
- **Ledger-verified service résumé** — implement ASAP. (This *is* the roadmap's "portable civic identity," `CitySync-Roadmap.md` §8.2.)
- **Neighborhood leaderboards + city impact dashboard**, surfaced inside the **MyCity Feed**.

**Deferred / out of scope:**

- **Mobile app** — built *after* the web app is complete; Phase 2 #8 moves into that effort.
- **Phase 2 #7** (badges/streaks recognition) — not wanted (the credit economy is the recognition layer).
- **Phase 3 #11** (multi-site / chapters) and **#12** (on-chain anchoring) — yes, but later. (Map to roadmap §8 "cities" and §7 chain migration.)
- **Phase 3 #9** (corporate/CSR) and **#10** (integrations) — not pursuing.

**Already in the City/Sync model (context, not new build):**

- **Issuance cap** — organizations hold a capped credit budget per 3-month epoch and already set per-task/shift values. The "dynamic credit incentives" idea is therefore mostly covered; any future work is just *boosting within the cap*, not new pricing.
- **Civic challenges** already exist as **MCE — Mass Coordination Events** (1–2 per epoch). Leaderboards/challenges should hang off MCE, not a new construct.
- **Community voice** already exists: **$VOTE** is minted 1:1 with each $CITY credit earned and used for community voting / participatory budgeting.
- **Verifiable impact report** is delivered *by* Phase 3 #12 (on-chain anchoring) — not a separate feature.

---

## 2. Capability map

| Feature area | Market-standard expectation | City/Sync status | Priority |
|---|---|---|---|
| Opportunity listing & sign-up | Browse, claim, one-time & recurring | **Built** | — |
| Waivers / e-sign | Collect, store, track acceptance | **Built** (hashed) | — |
| Recognition / rewards | Badges, points, leaderboards | **Built+** (credit economy) | Enhance |
| Public discovery profiles | Branded org pages, directory | **Built** | — |
| Onboarding / orientation | Track required orientation | **Partial** (featured task) | Enhance |
| Impact stats | Hours, ROI dashboards | **Partial** (public stats) | Phase 1 |
| Shift scheduling | Templates, recurring, capacity, calendar | **Gap** | **Phase 1** |
| Automated reminders | Email/SMS/push, no-show reduction | **Gap** | **Phase 1** |
| On-site check-in / hours | QR / geo check-in, time logs | **Gap** | **Phase 1** |
| Admin reporting / exports | CSV, grant & CSR reports | **Gap** | **Phase 1** |
| Background checks / credentials | Screening, certifications, training | **Gap** | Phase 2 |
| Skills matching & alerts | Match by skill/interest/availability | **Gap** | Phase 2 |
| Mobile experience | Volunteer + coordinator apps | **Gap** (responsive web only) | Phase 2 |
| Integrations | Calendar, CRM, SSO, Zapier | **Gap** | Phase 3 |
| Corporate / group volunteering | Team events, VTO, employer match | **Gap** | Phase 3 |
| Multi-site / chapters | Branches, role-based permissions | **Gap** | Phase 3 |
| On-chain anchoring | Public proof of record | **Partial** (stub adapter) | Phase 3 |

---

## 3. Prioritized roadmap

### Phase 1 — Now: close the table-stakes gaps

These are the features a coordinator or volunteer will expect on day one and currently can't find.

1. **Shift-based scheduling.** Turn an opportunity into one or more dated shifts with capacity, reusable templates for recurring programs, a calendar view, waitlists, and double-booking prevention. This is the single biggest functional gap.
2. **Automated reminders.** Email first (you already have the data model for rosters), then SMS. Confirmation on sign-up, reminder before a shift, nudge after a no-show.
3. **On-site check-in & hours.** A QR code per shift (optionally geofenced) so volunteers check in, and verified hours flow into the same completion → credit-mint path you already have.
4. **Admin reporting & exports.** Per-program and per-volunteer reports, CSV export, and a grant/CSR-ready summary. The ledger already holds the source data — this is a read/export layer.

### Phase 2 — Next: depth, trust, and retention

5. **Screening & credentials.** Background-check status, certification/training records, and age/role eligibility gating on claims (you already gate on waivers — extend the same gate).
6. **Skills & interest matching + alerts.** Volunteer profiles capture skills/interests/availability; opportunities surface matches and citizens get alerts when matching roles open.
7. **Recognition depth.** Badges, milestones, and streaks layered on top of credits (see §4 for the differentiated version).
8. **Mobile / PWA.** Make the volunteer experience installable and check-in-friendly without a native app build.

### Phase 3 — Later: ecosystem and scale

9. **Corporate & group volunteering.** Team sign-ups, employer volunteer-time-off tracking, and corporate matching.
10. **Integrations.** Calendar sync (Google/Outlook), CRM/donor systems, SSO, and Zapier.
11. **Multi-site / chapter management.** Branches and granular role-based permissions for larger organizations.
12. **On-chain anchoring milestones.** Flip the anchor adapter to Base so the impact record becomes publicly verifiable (unlocks several §4 ideas).

---

## 4. Out-of-the-box expansion options

These are alternative or additive takes on the sections above. Each is chosen because it leans on something City/Sync uniquely has — the credit economy, the redeemer marketplace, or the verifiable ledger — to expand **organizational interest** (why an org wants to be on the platform) and **community impact**.

### On scheduling → *Dynamic credit incentives*
Instead of flat credit values, let hard-to-fill shifts (off-peak, low sign-up, urgent) automatically earn **bonus credits** — surge pricing for civic good. Volunteers get routed to where need is greatest, and organizations gain a lever to fill the shifts that normally go empty. A lightweight version: issuers set a "boost" on a shift; an advanced version computes it from remaining slots and time-to-start.

### On recognition → *A ledger-verified service résumé*
Because every verified contribution is on a tamper-evident ledger, give each volunteer a **shareable, verifiable service record** — a public link (and later an on-chain, soul-bound credential) proving lifetime hours and roles. This is genuinely valuable to students needing service hours, job seekers, and immigration/citizenship applicants, and it gives organizations a reason to recruit: "volunteer here and earn a record that counts." This is your gamification *and* your retention story in one.

### On reporting → *The verifiable impact report for funders*
Self-reported volunteer numbers are the norm — and funders discount them. City/Sync can generate **grant- and CSR-ready impact reports backed by the ledger**, where every hour and credit is independently auditable against the public record. Pitch to organizations: *"Win grants faster because your impact is provable, not claimed."* This turns your transparency layer from a nice-to-have into a fundraising tool, which is the strongest possible reason for an org to join.

### On screening → *Portable, reusable verification across the network*
Record a volunteer's completed background check, orientation, or training **once** (as a hash, with consent) and let it be **reused across every organization** in the network. New volunteers stop re-onboarding at each org; organizations get pre-vetted volunteers instantly. This is a network effect no single-org tool can offer and a direct driver of cross-org discovery.

### On corporate/CSR → *Local businesses as sponsors, not just redeemers*
Let redeemer businesses **sponsor opportunities** — fund a credit pool, add a bonus reward, or "adopt" a recurring shift — in exchange for visibility on the opportunity and profile. Redeemers become recruiters, the credit marketplace gains liquidity, and small businesses get authentic local-good marketing. Extend to **employer credit-matching** (companies match employees' civic credits like a 401k), funding redeemer offerings and pulling corporate volunteers in.

### On discovery → *Civic challenges and cause-following*
Let citizens **follow causes** (food security, environment) and get notified when matching opportunities open, and run **multi-org "civic challenges"** (e.g., an Earth Week campaign) where credits stack across participating organizations and a shared leaderboard drives momentum. Challenges give organizations a reason to co-market and bring new citizens into the platform around a moment.

### On community → *Neighborhood leaderboards & a city impact dashboard*
Aggregate impact **by neighborhood**, not just by organization, for friendly inter-area competition and civic pride — and surface a **citywide impact dashboard** for local-government partners. This positions City/Sync as civic infrastructure a municipality wants to back (and your seed already includes a transit authority as a redeemer — city services as redemption is a natural wedge).

### On the credit itself → *Civic credits as a community voice*
Because credits are soul-bound and non-speculative, they can represent **earned standing**, not just spending power: a small **participatory-budgeting or community-vote** weight for residents who've contributed. This is a non-financial use of the token that deepens civic engagement and gives organizations and cities a novel reason to participate.

---

## 5. Recommended near-term sequence

1. **Shifts + reminders + check-in** (Phase 1, items 1–3) — these unblock the everyday workflow and make the existing credit loop feel complete.
2. **Verifiable impact report** (§4) — low-to-medium build on top of the ledger you already have, and the strongest single hook for organizational sign-ups.
3. **Admin exports** (Phase 1, item 4) — pairs naturally with the impact report.
4. Then choose a differentiator to lead with — **service résumé** (volunteer-side growth) or **business sponsorship** (marketplace growth) — depending on whether the next goal is more volunteers or more organizations.

The throughline: build the conventional scheduling/reporting layer so City/Sync is *credible*, but lead the marketing with the ledger-and-credit features above, because those are the things no other volunteer-management product can copy.
