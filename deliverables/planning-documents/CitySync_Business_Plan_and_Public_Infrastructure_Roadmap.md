# City/Sync — Business Plan and Public Infrastructure Roadmap

Prepared September 17, 2026 · Strategic planning version 1.0

City/Sync should build a business that makes participation free and dependable, earns revenue from the institutions able to fund shared infrastructure, and gradually makes that infrastructure usable beyond the original company. The Volunteer Management Application is the first product through which to prove this model. The long-term opportunity is a common way for public-purpose organizations to coordinate work, recognize qualified claims, explain decisions, and honor commitments across institutional boundaries.

The recommended sequence is **a useful application → a funded local network → repeatable network operations → an independently implementable protocol → broader public administration**. Each expansion should follow evidence that the preceding stage works. A blockchain deployment, foundation launch, or large user count is not a substitute for that evidence.

This plan incorporates the September 17 instruction that residents and public-purpose organizations use City/Sync for free. It supersedes earlier suggestions to charge nonprofits for ordinary subscriptions, reporting, gateways, or participation. Government commissioners and private companies are the intended recurring payers. Philanthropy can finance evaluation, access, and open infrastructure without becoming the sole source of operating revenue.

The time ranges, prices, budgets, and performance thresholds below are planning assumptions to test. They are not existing contracts, forecasts, market quotations, or statements that the experiment has succeeded. Legal items identify work for qualified counsel in the launch jurisdiction; they do not constitute a determination that the current credit design is lawful.

**1. The business and the public purpose.** City/Sync helps people and institutions make commitments they can understand, fulfill, verify, and correct. Its public purpose is to increase useful civic capacity: the ability of a community to organize people, knowledge, resources, and responsibility toward shared needs.

The underlying hypothesis is that dependable processes reduce uncertainty. A participant can understand what they agreed to, see whether their contribution was recognized, and obtain a remedy when something goes wrong. An organization can rely on a qualified record without repeating every check. Those improvements may make people more willing to participate and institutions more capable of working together. The hypothesis is testable; broader trust in government remains a possible downstream effect.

The business sells the operation of that coordination system. Governments can commission a local network that serves their community. Private companies can sponsor access or purchase commercial integrations, distribution arrangements, and managed infrastructure. Public-purpose organizations receive a useful operating tool; the payer receives a reliably operated program, accountable reporting, and agreed service levels.

The eventual dPAN—decentralized Public Administration Network—is a network of qualified people and institutions performing bounded public functions under explicit authority and public rules. It grows through lawful delegation and demonstrated competence. Connecting a nonprofit to software does not itself delegate governmental authority.

The commercial objective is a company with repeatable contracts, credible margins, and retained founder equity. The infrastructure objective is a protocol that participants can understand, implement, and continue using if City/Sync changes ownership or ceases operating. These objectives can reinforce one another when portability increases buyer confidence and the company earns its revenue through execution. An open protocol does not inherently impose a ceiling on company value; the economics depend on paid demand, service differentiation, delivery costs, competition, and ownership.

**2. Where development actually stands.** The project has progressed beyond a concept. It has a substantial application and the beginnings of the ledger architecture. It has not yet demonstrated product-market fit, a sustainable civic-credit program, or independent federation.

The main `Progress` checkout was at `aabaed6` during this review. The newer application work is in `/Users/nathansuits/dev/Progress-aesthetic-lab`, on `branch1/CSV1.0` at `63b3e9b`. The development task reports a Vercel production deployment of that newer work. This plan checked the local source and task history; it did not audit the live production environment or rerun database-mutating verification scripts.

| Area | Evidence available today | Implication for the plan |
|---|---|---|
| Volunteer application | Participant and organization workspaces, programs, shifts, intake, roster and staffing features, completion verification, and reporting code | Finish and validate the operating loop instead of rebuilding the application |
| Civic credits | City-specific wallets, issuance/redemption journal entries, and idempotent credit operations | Test and strengthen economic controls before treating balances as dependable promises |
| Institutional storage | Organization records share a core database; cities have separate databases for credits, events, and anchors | Preserve logical organization boundaries now; extract independent nodes when needed |
| Synchronization | A transactional outbox delivers core events to city ledgers with retry and ordering logic | Useful foundation; still short of a protocol between independently governed operators |
| Record integrity | Hash chains, Merkle roots, and verification functions exist | Integrity under one operator is weaker than externally witnessed history |
| External anchoring | The Base adapter remains an unimplemented integration point; local stub anchoring exists | Do not claim public-chain anchoring is operating |
| Privacy | The newer branch excludes designated private onboarding events from city synchronization and includes private-file routes | Positive progress; complete a system-wide data and disclosure review |
| Enrollment and authority | Recent changes broaden discovery and auto-approval | Separate permission to appear in discovery from authority to issue recognized claims or credits |
| Identity | Shared platform accounts and city-specific records | Introduce contextual identifiers before records cross independently operated systems |
| Protocol | Detailed target architecture exists in documents | Signed organizational envelopes, separate acceptance receipts, conformance, and operator portability remain implementation work |
| Deployment | Tasks report separate local, staging, and production data environments | Formalize releases, migration ownership, backup restoration, and incident response |
| Business validation | No signed payer contracts, audited results, or verified revenue established by this review | Treat these as unknown, rather than filling a pitch with assumed traction |

The immediate development milestone is **pilot readiness**. “Deployed” establishes that software can be reached. Pilot readiness establishes that people can rely on it, staff can support it, and promised benefits can be delivered.

Older roadmap claims need updating. A hash does not establish that volunteer work happened. A portable background-check record does not automatically satisfy a second institution's screening requirements. An anchored report does not automatically satisfy a regulator. These capabilities require agreed acceptance rules and responsible reviewers.

**3. The free-access commitment.** Residents, volunteers, nonprofits, community organizations, and public institutions should have free access to the core participation service. Government departments using the ordinary application are also participants. A government becomes a paying customer when it commissions broader operations or a managed deployment for a network.

Free core access should include discovery, opportunities, ordinary scheduling and intake, participation records, verification workflows, credit balances and redemption where available, basic organizational reports, standard connections, exports, correction requests, and account recovery. Required security, accessibility, and recourse belong in that core. Publishing a conforming claim should not require purchasing permission from City/Sync.

| Actor | What they receive | Payment expectation |
|---|---|---|
| Resident or volunteer | Participation, records, recognition, available benefits, and recourse | Free |
| Nonprofit or public-purpose organization | Core application, ordinary onboarding, reporting, and participation in a funded network | Free |
| Redeemer | Tools to define, reserve, fulfill, and report bounded benefit commitments | No required participation fee; contribution is governed by its agreement |
| Government commissioner | Network operations, program administration, security commitments, consolidated reporting, integration, and support | Pays under a service contract |
| Private sponsor | A defined community program, accountable use of funds, and appropriate aggregate reporting | Funds deployment and/or benefit capacity |
| Commercial platform or integrator | Managed APIs, connectors, commercial support, deployment tools, or embedded application services | Pays for the commercial service; the open specification remains available |

This is a payer-supported public service. The payer funds the shared capabilities and operating capacity that make free participation possible. A nonprofit needing a costly bespoke integration should have that work funded by the network commissioner or sponsor; an integration charge should not become a disguised participation fee.

Free access still needs an operating budget. Launch supported networks where funding and staff can sustain them. Publish which areas are supported, keep the specification and reference tools available, and use a continuity plan if funding ends. Do not promise unlimited, permanently funded hosting everywhere before there is a way to provide it.

**4. The first market and the reason to choose it.** Begin with one compact civic network in one U.S. jurisdiction. Berkeley or the surrounding region is a candidate because it already appears in the product, but that is not evidence of a government partnership. Choose the location based on a committed coordinator, reachable organizations, useful redemption capacity, a budget owner, and the team's ability to provide support.

The initial customer profile is a city, county, or regional public program with recurring community participation needs and multiple partner organizations. The budget owner should already be responsible for delivering a program or maintaining community capacity. A general enthusiasm for innovation is insufficient purchasing intent.

The first operating cohort should be deliberately small: roughly three to five issuer organizations, three to five complementary redeemers, and 100–250 invited participants, adjusted downward if capacity is limited. One organization can serve as both issuer and redeemer. A local coordinator must have protected working time for recruitment, training, disputes, and partner renewal.

The initial government offer is straightforward: **“Fund one coordinated local program, give participating organizations the tools for free, and receive evidence of what improved and what it cost.”** Begin with voluntary, bounded community activities that participating organizations are already equipped to supervise. Expansion into health eligibility, statutory benefits, or consequential licensing requires a separate authorization and assurance program.

City/Sync faces several existing alternatives. Spreadsheets and existing volunteer systems can already meet some organizations' needs. Tempo already connects volunteering to recognition opportunities and sells delivery support to commissioners; that establishes a relevant precedent rather than validation of City/Sync's particular design. X-Road provides secure institutional exchange. Tyler and ServiceNow sell government data and workflow infrastructure. City/Sync's proposed advantage is the combination of free organizational participation, reliable local recognition, reusable qualified records, and portable network operations. Each part must prove its value against those alternatives. [Tempo's model](https://wearetempo.org/time-credits), [Tempo commissioner services](https://wearetempo.org/commissioners), [X-Road architecture](https://docs.x-road.global/Architecture/arc-g_x-road_arhitecture.html), [Tyler Enterprise Data Platform](https://www.tylertech.com/products/data-insights/enterprise-data-platform), [ServiceNow Public Sector Digital Services](https://www.servicenow.com/docs/r/government-industry/bun-public-sector-landing-page.html).

Use a bottom-up market estimate after discovery. Count reachable government or regional commissioners with an identified budget and a suitable program, then multiply by a tested contract value. For illustration, 100 qualified commissioners at $150,000 annually represent a $15 million annual opportunity within that defined list. That is arithmetic for a hypothetical reachable segment, not a researched total addressable market. A city and its county should not be counted twice for the same proposed contract.

**5. What must be built.** Keep one coherent product while drawing clearer boundaries inside it. The current shared database can remain during the pilot if organization authorization, privacy, export, and credit integrity are reliable. A database per organization is useful when custody, independent operation, or a contracting requirement calls for it; database count alone is not the measure of decentralization.

| Layer | Build or finish next | What it enables later |
|---|---|---|
| Participant and organization application | Reliable intake, scheduling, reminders, completion, explanations, correction, and support | A reference client that other clients can complement |
| Program operations | Partner agreements, fulfillment controls, complaints, issuance budgets, benefit reservations, and reconciliation | Repeatable locally governed programs |
| Institutional records | Scoped organization boundaries, explicit authority, policy versions, source history, evidence controls, and exports | Independent organization nodes and credible custody |
| Protocol | A small set of signed claims, receipts, error outcomes, and correction rules | Multiple implementations that interpret the same record consistently |
| City coordination | Policy-based acceptance, credit state, shared commitments, reporting, and local administration | A managed city or regional network |
| Verification | Independent verifier, signed checkpoints, permitted proof bundles, and optional public anchoring | Record integrity that can be checked beyond the operator |
| Commercial operations | Commissioner reporting, contract entitlements, deployment management, cost tracking, and support tooling | Revenue that funds free access |

In the next engineering cycle, establish a supported dependency baseline, patch known security issues, and review privileged authentication and recovery. The inspected application declares Next.js 14.2.18; the framework has issued later security updates. That warrants a dependency review before a funded public pilot, without assuming a particular vulnerability is exploitable in this deployment. [Next.js security update](https://nextjs.org/blog/security-update-2025-12-11).

Then verify the full loop: an organization publishes an opportunity, a participant accepts its terms, completion is reviewed by an authorized person, the accepted result is recorded, the promised recognition appears once, and any redemption is fulfilled or remedied. Include failed delivery, duplicate requests, cancellation, correction, and recovery. The loop should reconcile across the core database and city credit database after a partial failure.

Separate public visibility from institutional recognition. An organization may be discoverable while awaiting verification of its authority to attest work or issue credits. Public enrollment should not silently create the authority to make consequential claims.

Protect the record of what was promised. Reserve an approved issuance budget when the participant commits; issue credits after authorized verification. Reserve benefit inventory when a redemption is booked. Make balances reproducible from a complete journal that supports reversals and corrections. A balanced credit-accounting model may help, but an internally balanced ledger does not prove that a benefit provider can deliver.

Keep public transparency narrow. Publish aggregate outcomes and privacy-reviewed integrity proofs. Private evidence, internal notes, case data, and identity mappings remain in authorized systems. Data deletion and retention need explicit treatment; append-only audit history cannot justify indefinite retention of sensitive payloads.

The first protocol release should cover only the operating loop already tested: contribution claims, authority references, applicable policy, acceptance or rejection receipts, and correction/revocation status. Preserve two separate records: the organization signs its source claim; the accepting authority signs its own decision and assigns any city sequence. Verification should remain possible after exporting those records.

Use established standards for the generic work. Define APIs and schemas clearly, use established authentication and signing mechanisms, and select a credential profile from existing standards when there is a real relying institution. W3C Verifiable Credentials supplies an issuer–holder–verifier model; NIST digital-identity guidance supports choosing assurance levels appropriate to the interaction. Neither requires every volunteer to hold a cryptocurrency wallet or every record to expose a universal identifier. [W3C Verifiable Credentials 2.0](https://www.w3.org/TR/vc-data-model-2.0/), [NIST SP 800-63-4](https://pages.nist.gov/800-63-4/sp800-63.html).

X-Road should remain an integration option. It can carry City/Sync messages where an operator already has an X-Road ecosystem. Supporting X-Road means building and testing against its interfaces; a generic HTTPS gateway is not automatically X-Road compatible. Defer the adapter until a real partner needs it. [X-Road message transport](https://docs.x-road.global/Protocols/pr-messtransp_x-road_message_transport_protocol.html).

The City Ledger should record the shared state a program actually needs. Credit issuance and redemption need a consistent authoritative journal within their program. A private exchange between two agencies may need only their signed request, response, and receipts. Avoid making every institutional interaction depend on a universal city database.

Independent witnesses can later retain and compare signed checkpoints to detect rewriting or divergent histories. Their role concerns record integrity; verifying that work happened remains a separate responsibility. A public blockchain can anchor those checkpoints when external verification adds value. Dedicated City/Sync or city chains remain conditional research until a measured requirement exceeds what signed records, independent custody, and anchoring can provide.

**6. Make the civic-credit program dependable before making it large.** The scarce resource is useful, deliverable access. Credits should be issued against a program whose benefits, constraints, and remedies participants can understand.

Secure founding redeemer commitments before expanding recruitment. Each commitment names the offering, quantity, available times, restrictions, fulfillment period, notice required to withdraw, and any funded reimbursement. The system enforces that ceiling. Organizations should know their maximum burden even if the network remains small.

An illustrative pilot could reserve a fixed number of museum admissions for specified periods. The institution knows its exposure; the participant can see availability before committing to earn credits; the program knows what it must replace if reservations are canceled. This is stronger than promising access to an indefinitely expanding catalog.

Track three separate measures: physical service capacity, whether participants can use and want it, and the credits it may absorb at posted prices. Raising the credit price of an unchanged offering must not create permission to issue more credits. Include outstanding balances and already-promised rewards when assessing new commitments, and test the effect of losing the largest provider.

The program needs an identified party responsible for failed fulfillment. Use replacement capacity or a funded remedy where promised; explain limits before participation. Do not imply that a credit is cash-backed, an unconditional entitlement, or redeemable forever unless a contract and resources support that claim. Silent expiration and inaccessible inventory should not become methods of balancing the program.

Redeemers may participate for public mission, bounded use of spare capacity, reciprocal access to civic help, or explicit financial support. Measure the marginal costs, displaced paid demand, administration, and renewal intention. A redemption burns credits; it does not pay the redeemer's staff or increase the supply of services by itself.

Automate routine decisions gradually. Start with a published policy and human review of exceptions. Run proposed supply-and-demand adjustments in observation mode before allowing them to alter future allocations. Existing commitments stay protected. Authority, policy changes, disputed evidence, and remedies still need accountable people.

Keep three accounts conceptually and operationally distinct: City/Sync's business revenue; the program's benefit and access-support funding; and civic-credit balances. Use appropriate accounting and contractual separation for money held on another party's behalf. Prefer a commissioner or qualified fiscal operator to disburse benefit funds initially. Minting credits never funds payroll, operating costs, or redemption reimbursements.

**7. The phased roadmap.** Time begins when the company allocates resources to this plan. These ranges are sequencing guides. Advance when the evidence gate is satisfied, even if a calendar milestone moves.

| Phase | Product and infrastructure | Institutional and commercial work | Evidence required to advance |
|---|---|---|---|
| 0: Commit to one pilot, weeks 0–6 | Identify the authoritative release; map critical workflows; close urgent access, privacy, and recovery gaps; instrument baseline measures | Confirm entity/IP status; interview buyers and users; choose one jurisdiction; secure a budget owner and conditional partner commitments | A defined problem, named operator, credible funding path, scoped legal review, and a supportable pilot design |
| 1: Operate a controlled program, months 2–8 | Finish the loop, enforce budgets and reservations, test recovery and exports, implement correction and participant explanations | Execute payer and partner agreements; train the founding cohort; collect baseline and follow-up evidence | Dependable fulfillment, acceptable participant experience, manageable support cost, and a concrete renewal decision |
| 2: Prove repeatability, months 8–15 | Standardize configuration and deployment; add commissioner reporting; formalize the first signed claim and receipt APIs | Replicate in a second comparable network; convert pilots to recurring contracts; publish findings with limitations | Two paying commissioners or equivalent private-funded network contracts, comparable outcomes, and declining implementation effort |
| 3: Become infrastructure, months 15–27 | Release protocol profile and conformance tests; demonstrate an external client and an independent organization operator; test one reporting/credential use beyond volunteering | Establish local governance agreements; recruit a delivery partner; sell a bounded government extension | A receiving institution accepts the record, a real operator can replace City/Sync for a component, and the new workflow has a paying sponsor |
| 4: Establish a federation, months 27–42 | Support multiple operators, key transitions, independent verification, and a tested X-Road adapter where demanded | Move common standards toward independent stewardship; create regional delivery and procurement channels | Multiple independent implementations, funded maintenance, working portability, and repeatable positive network economics |
| 5: Extend public functions, month 42 onward | Add domain-specific policies, records, and recourse; consider stronger shared execution only for demonstrated needs | Qualify new public functions and jurisdictions with their lawful authorities | Each domain has its own authorization, outcome evidence, security review, budget, and accountable operator |

Phase 0 belongs primarily to the founder, technical lead, and local program lead, with counsel handling the legal design. Phase 1 needs daily program ownership alongside engineering. Phase 2 requires disciplined customer delivery. Phase 3 introduces protocol engineering and outside implementers. The company should not staff all five phases at once.

The first extension beyond volunteering should be a report that an existing commissioner actually uses: for example, a funded community program's delivery report that traces its totals to accepted contributions, corrections, and the relevant rules. That tests whether City/Sync reduces repeated administrative work without immediately assuming authority over sensitive eligibility decisions.

A second client must have a real purpose. An independently built reporting tool consuming City/Sync records is more convincing evidence of a protocol than a second interface built by the same team around the same internal database.

**8. Go to market through a funded local network.** The first sale should be founder-led and narrow. Recruit the payer, operating partner, issuers, and redeemers as one coordinated launch. Free organizational signups create useful interest, but the launch depends on institutional commitments and a budget.

Run discovery with approximately 12–15 potential commissioning decision-makers, 10–15 organization coordinators, 6–10 benefit providers, and a small diverse group of participants. Some interviews can be within the same network. Learn what fails today, who bears its cost, who can authorize a purchase, what evidence would justify renewal, and what would prevent adoption. Record price reactions against a defined scope rather than asking whether the idea sounds useful.

Find four roles at the government buyer: a program champion, a budget owner, an IT/security reviewer, and a procurement/legal contact. They may overlap. A positive meeting with the champion should produce a next step involving someone who can commit resources.

Create one repeatable six-month pilot offer. Include a scope of work, named local coordinator, participant cohort, partner commitments, measurement plan, support hours, privacy and accessibility approach, renewal criteria, and transition plan. Keep benefit funding visible as a separate line. Where a private sponsor funds the pilot, establish who will fund the following year before launch.

An illustrative $100,000 pilot budget could allocate $60,000 to City/Sync's deployment and operating services, $25,000 to committed benefits or replacement capacity, $5,000 to access support, and $10,000 to evaluation. These are design inputs, not validated prices. Only the contracted City/Sync service portion is presumed company revenue; the accounting for any other funds depends on the arrangement. Product research and engineering beyond the pilot scope require separate company funding.

Sell the operational result in buyer language: more useful participation, less coordination effort, reliable recognition, and reports the commissioner can use. Introduce the protocol as the reason records can remain portable and multiple providers can participate. A protocol-first sales pitch asks the customer to buy infrastructure before its local value is visible.

Create a lightweight procurement package: vendor details, insurance evidence, service scope, security overview, data-flow and retention description, accessibility evidence, standard agreement, implementation schedule, pricing, export provisions, and a plain-language explanation of credit responsibilities. Confirm the applicable purchasing route with the buyer. A pilot may still require competition; federal award conditions can add requirements. Avoid assuming a universal exemption or dividing purchases to avoid thresholds. Federal award materials direct recipients to documented procurement procedures and applicable competition rules. [Federal grant procurement guidance](https://apply07.grants.gov/grantsws/rest/opportunity/att/download/338735).

Plan for a potentially lengthy purchasing cycle. Use three-, six-, and twelve-month sales-cycle scenarios in the cash plan until actual data replaces them. Start with a manageable departmental or regional program and establish the budget calendar. A private sponsor can bridge a pilot, but sponsorship does not waive a government's authority, data, or procurement obligations.

Once the first contract renews, expand within the same jurisdiction and then to a comparable nearby network. Use local volunteer centers, regional government associations, and established technology integrators as delivery or referral partners after the operating playbook works. Corporate sponsorship is a funding channel; a separate employer volunteer-management product remains outside the initial scope.

Mass Coordination Events can later demonstrate shared capacity and recruit participants. Introduce them after routine operations are dependable; a large event adds safety, staffing, and fulfillment obligations that can overwhelm an early program. Measure completed public work and follow-through, alongside attendance.

**9. Revenue, packaging, and pricing.** The following prices are hypotheses for discovery. Every government price includes free core access for participating residents and organizations within the agreed program. No revenue line depends on selling resident data or charging to exercise a correction or export right.

| Offer | Intended payer | Initial price hypothesis | What earns the fee |
|---|---|---:|---|
| Six-month launch and operating pilot | Government or private sponsor | $40,000–$80,000 in City/Sync service fees | Deployment, onboarding, program support, reporting, and evaluation support |
| Annual local network operation | City, county, or regional commissioner | $90,000–$180,000 annually | Managed service, agreed support capacity, program administration tools, and consolidated reporting |
| Complex regional deployment | Regional/state commissioner | $200,000–$400,000+ annually, after repeatability | Multiple programs, integration, greater operating scope, and stronger service commitments |
| Defined implementation or connector | Government or private company | $15,000–$75,000 project scope | Clearly bounded integration and deployment work |
| Commercial embedded client/API service | Private platform or integrator | $30,000–$150,000 annual minimum plus agreed scale tiers | Managed infrastructure, maintenance, commercial support, and deployment tooling |
| Sponsored local access | Private company | Scoped budget | Free participation, benefit support, and aggregate evidence of funded outcomes |

Separate one-time implementation from recurring service fees. Separate program-benefit funding from both. Price network operations by meaningful scope: programs, integrations, service levels, support load, and infrastructure commitments. Avoid fees on each volunteer action or each earned credit. If activity exceeds the funded envelope, renegotiate with the payer and manage new enrollment; do not send unexpected bills to residents or organizations.

A private platform may use the open protocol independently. It pays City/Sync when it chooses the managed service, commercial client license, or integration support. That preserves credible openness while leaving valuable work for the business.

Sponsorship should buy a defined contribution to public outcomes. It should not purchase verifier authority, privileged access to personal activity, public-policy control, or preferential treatment in public decisions. Aggregate reporting should avoid exposing small groups or allowing participants to be reidentified.

These prices will fail if the program produces too little value or requires constant bespoke work. Test willingness to pay early. If small cities cannot fund a network alone, aggregate commissioning at county or regional level or seek shared private sponsorship. Preserve the free-access commitment while changing the funding boundary.

**10. Financial model and capital requirements.** The economic unit is a funded network, not a registered user. Each network must cover its attributable hosting, support, local delivery, partner management, reporting, and contractual obligations while contributing to shared product development.

Track network contribution as recurring service revenue minus direct delivery costs. Track software infrastructure margin separately from local program-delivery margin. A service that needs a local coordinator remains a service business in part, even when its software scales cheaply. Paid implementation can finance onboarding; it should not conceal a recurring contract that loses money indefinitely.

An illustrative first twelve-month company budget is:

| Cost | Planning allowance |
|---|---:|
| Core team, approximately three to four full-time equivalents including employment burden | $510,000 |
| Specialist engineering, security, accessibility, and evaluation support | $90,000 |
| Legal, accounting, insurance, and corporate administration | $60,000 |
| Hosting, tooling, backups, monitoring, and communications | $30,000 |
| Customer discovery, partner development, travel, and materials | $30,000 |
| Contingency and transition reserve | $80,000 |
| **Total company operating envelope** | **$800,000** |

The allocation is illustrative and must be rebuilt around actual people, geography, contracts, and in-kind support. It excludes separately funded benefit pools and taxes on profits. Avoid double-counting evaluation or support costs paid directly by a pilot sponsor. A narrower founder-led plan can cost less, with correspondingly smaller scope and slower delivery.

At this spending level, eighteen months without revenue would require approximately $1.2 million. Fundraising should be based on unrestricted cash needs through the next renewal/replication milestone, plus a procurement-delay buffer, minus conservatively timed contracted receipts. Pipeline discussions, unawarded grants, and restricted benefit funds are not runway.

The following scenarios show what recurring viability could require. They are alternative operating scales, not year-one/year-two/year-three forecasts. Annualized recurring revenue assumes all contracts are active for a full year; recognized revenue during a growth year would differ.

| Assumption | Early paid network | Repeatable regional business | Larger platform |
|---|---:|---:|---:|
| Government network contracts | 6 × $100,000 | 20 × $150,000 | 60 × $180,000 |
| Private recurring contracts | 2 × $50,000 | 5 × $80,000 | 10 × $120,000 |
| Annualized recurring service revenue | $700,000 | $3,400,000 | $12,000,000 |
| Assumed gross margin after direct delivery | 55% | 65% | 70% |
| Gross profit | $385,000 | $2,210,000 | $8,400,000 |
| Shared product, sales, and administration expense | $900,000 | $2,000,000 | $5,500,000 |
| Operating result before tax, financing, and exceptional items | **−$515,000** | **$210,000** | **$2,900,000** |

Implementation revenue, grants, and pass-through benefit funding are excluded. Direct delivery labor belongs in gross-margin costs; shared labor belongs in operating expenses, with no double counting. Assumed margin improvement depends on standard deployment, shared support, and competent delivery partners. It should never be presumed from software usage alone.

The middle scenario is fragile: a ten-percentage-point gross-margin shortfall reduces annual gross profit by $340,000 and turns its $210,000 operating result into a $130,000 loss. That makes support hours and integration complexity core business metrics. At $150,000 per network and a 65% contribution margin, one network contributes $97,500 toward shared overhead. Covering $2 million of shared overhead would require roughly 21 equivalent networks before considering private-contract contribution.

Maintain a monthly cash forecast, an annual operating plan, and a contract-level margin view. Track signed bookings, revenue earned, invoices collected, restricted funds, renewal dates, and customer concentration separately. Aim for at least 60% network contribution margin after the first standardized deployments, and test whether acquisition costs can be recovered within roughly 18–24 months of gross profit. These are proposed operating targets, not current performance. Review financing or scope reductions while at least nine months of unrestricted runway remains; a public-sector sale can outlast the available cash.

The most credible early capital mix is paid pilots, milestone-based public-infrastructure grants, and patient equity sufficient to reach renewals. Use grants for clearly bounded common goods such as the verifier, protocol specification, accessibility work, and independent evaluation. Confirm each funder's eligibility and IP terms before budgeting an award. Ethereum ecosystem funding may fit public verification work, but the business should remain viable without permanent gas subsidies or a speculative token sale.

Founder financial value comes from retained equity in a durable service business. A large financing round can increase the company's chance of scaling while reducing founder ownership and adding investor preferences. Evaluate funding offers against a capitalization and exit-waterfall model with counsel; headline acquisition value is not personal proceeds. Do not assume an early sale to a particular buyer will maximize either impact or wealth.

**11. Incorporation and the legal work.** First establish what already exists: entity, owners, prior contracts, contributor rights, grant conditions, trademarks, and any IP assigned elsewhere. This review did not verify those facts. If City/Sync is already incorporated, use that entity as the starting point and evaluate changes deliberately.

If institutional investment and founder equity remain goals, a U.S. stock corporation is a reasonable operating vehicle. A Delaware public benefit corporation is a candidate because its statutory framework expressly balances shareholder interests, affected stakeholders, and the stated public benefit. Choose the jurisdiction and tax treatment with counsel based on actual operations and financing. PBC status does not create tax exemption or an unchangeable mission lock. [Delaware public benefit corporation law](https://delcode.delaware.gov/title8/c001/sc15/).

Write the public purpose specifically enough to guide decisions: increasing public capacity through accessible, interoperable, accountable civic infrastructure. Support it with enforceable service commitments, licenses, governance procedures, and reporting. Free access and portability should appear in the documents that govern the service, rather than existing only in marketing.

Complete the ordinary company foundations early: founder ownership and vesting, IP and invention assignments, contributor and contractor agreements, appropriate employment arrangements, tax identification, banking, accounting, capitalization records, required state registrations, insurance, and a compliance calendar. Obtain trademark clearance before significant distribution spending. Review tax elections connected with founder equity promptly with counsel; do not copy deadlines or forms from an old startup checklist.

A nonprofit can charge for mission-related services and can be a durable operator. Its ownership and earnings structure differs from a founder-owned company: section 501(c)(3) prohibits private inurement. Use a nonprofit when that structure serves the stewardship mission, not as a presumed path to founder acquisition proceeds. [IRS exemption requirements](https://www.irs.gov/charities-non-profits/charitable-organizations/exemption-requirements-501c3-organizations).

For the first pilot, commission a focused legal design memo with a clear outcome: the approved program configuration, the unresolved issues, and the conditions that would require another review. The memo should cover the following workstreams.

| Workstream | Required decision or deliverable | Trigger |
|---|---|---|
| Volunteer status and rewards | Determine whether the specific credit and benefit arrangement preserves lawful volunteer status; consider public and nonprofit hosts separately, state law, minors, and displacement of paid work | Before promising redeemable credits for service |
| Tax and public-benefit consequences | Assess receipt/redemption treatment, reporting obligations, and possible effects on means-tested benefits; draft accurate participant information | Before launching incentives with economic value |
| Credit/payment classification | Assess money transmission, prepaid access, stored value, consumer protection, expiration, and unclaimed-property issues where applicable | Before finalizing issuance, redemption, transfer, or cash-conversion rules |
| Government authority | Identify who can authorize program spending, benefit contributions, delegation, data sharing, and dispute resolution | Before the relevant government contract or recognition claim |
| Participant and institutional contracts | Define supervision, safety, verification, benefit commitments, cancellation, remedies, and allocation of responsibility | Before live enrollment |
| Privacy and records | Define data roles, purpose, access, retention, disclosures, incident notice, and public-records handling | Before collecting real participant information |
| Accessibility and equal access | Establish an accessible product and alternative participation/support pathways | From pilot design onward |
| Company and network continuity | Specify export, key transition, end-of-contract support, outstanding commitments, and operator replacement | In initial contracts |

Volunteer status is a central design question. DOL guidance treats nonprofit volunteering as service provided without contemplation of pay, while public-agency rules contain particular provisions for expenses, reasonable benefits, and nominal fees. A credit's name or nontransferability does not settle that question. Private sponsors should fund public-purpose activities; their involvement must not quietly turn the network into unpaid labor for their ordinary commercial operations. [DOL nonprofit guidance](https://www.dol.gov/agencies/whd/fact-sheets/14a-flsa-non-profits), [DOL public-agency volunteer analysis](https://www.dol.gov/sites/dolgov/files/WHD/legacy/files/2007_09_17_03NA_FLSA.pdf).

Noncash value also needs tax analysis. IRS guidance explains that barter may generate taxable income even when cash is absent. FinCEN's prepaid-access guidance illustrates why an arrangement's functions and limits matter. Neither source determines City/Sync's classification. Counsel should review the actual earning, redemption, funding, and transfer design before the team represents it as exempt. [IRS barter guidance](https://www.irs.gov/taxtopics/tc420), [FinCEN prepaid-access guidance](https://www.fincen.gov/resources/statutes-regulations/guidance/frequently-asked-questions-regarding-prepaid-access).

Design accessibility into the initial product. DOJ's current guidance specifies WCAG 2.1 Level AA for covered state/local government web and mobile services and, following the 2026 extension, compliance dates of April 26, 2027 for entities with populations of 50,000 or more and April 26, 2028 for smaller entities and special district governments. Applicability to the particular service and entity still requires review. [DOJ current accessibility guidance](https://www.ada.gov/resources/2024-03-08-web-rule/).

Scope security obligations to the data and customer. Prepare a security program, incident response, tested recovery, access reviews, and appropriate contractual evidence. A customer-specific demand for health, justice, or other regulated data should trigger its own assessment. A cloud provider's certifications or the use of X-Road do not confer compliance on the entire City/Sync service.

If the credit arrangement cannot be launched safely within the pilot budget and legal scope, continue testing the free coordination application and verified participation records while redesigning incentives. That preserves the useful experiment without promising benefits whose obligations remain unresolved.

**12. Protocol ownership, openness, and stewardship.** Publish the emerging protocol early enough that partners can review it, while labeling it as experimental until interoperability is demonstrated. Avoid both premature claims of being a standard and years of calling an undocumented private API a public protocol.

The open components should include the core schemas, semantic definitions, canonicalization/signing profiles, receipt lifecycle, export formats, conformance tests, and a usable reference gateway/verifier. Select appropriate licenses and patent commitments after an IP review. The company can retain commercial products for managed operations, implementation tooling, enterprise integrations, advanced commissioner workflows, and optional embedded clients. Free access to an application and an open-source license are separate commitments and should be described accurately.

An independent implementer should be able to exchange a valid claim and verify a receipt without a City/Sync commercial subscription. The company should earn payment for operating a dependable service. Compatibility tests should be openly available; paid audits or operator assessments can fund work, but certification must not become a purchased substitute for public authority.

Initially, the company can maintain the specification through public proposals, versioning, recorded decisions, and a small advisory group. Establish local program authority separately: participants control their choices and presentations; organizations control qualified source attestations; authorized public bodies control public policy; operators administer the service; appeal bodies resolve matters within their remit.

Move the common protocol into an independent foundation or comparable stewardship body when there are outside implementers, multiple commissioning networks, funding for maintenance, and a concrete need for neutrality. A sensible trigger is at least two genuinely independent operators and two or more public commissioners willing to support shared stewardship. Those are proposed governance triggers, not statutory requirements.

Give that body a real maintenance budget funded by contracts, commercial-member contributions, and eligible grants. Structure related-party transactions and any IP transfer transparently, with independent review. A fiscal sponsor can support a qualifying public-interest workstream before a separate foundation is justified, subject to its control and charitable obligations.

Retain meaningful exit rights throughout: documented exports, history verification, key-transition procedures, standard interfaces, and a funded handoff process. Those protections are especially valuable if the application company is acquired. A PBC label alone cannot preserve them.

**13. Measure whether people and institutions are better off.** Establish baseline measures before the pilot. Keep the evaluation focused on the process City/Sync changes rather than attributing changes in general civic trust to a small software trial.

Measure four linked propositions: the application reduces avoidable work; reliable recognition changes participation; institutions can reuse qualified records; and a payer considers the resulting outcomes worth renewing. Each proposition can succeed or fail independently. Strong signups do not establish that credits caused retention, and increased hours do not establish that the underlying public work was useful.

| Question | Measure | Suggested decision standard |
|---|---|---|
| Does coordination improve? | Staff minutes per completed contribution and per report, compared with baseline | Seek a material improvement; initially test a 20% reduction target where measurement is comparable |
| Do people understand the process? | Ability to explain the commitment, status, recognition, and correction route | Improve from baseline; investigate meaningful differences by participant group |
| Does recognition work reliably? | Successful fulfillment of confirmed reservations; failed attempts and unavailable desired offerings | Target at least 95% confirmed fulfillment, with a documented remedy for failures; also measure unmet demand |
| Does participation persist? | Repeat participation among eligible cohorts, with reasons for leaving | Improvement over a defensible comparison; report uncertainty and selection effects |
| Are organizations gaining capacity? | Weekly use, coordinator burden, completed prioritized work, and partner renewal | Most founding partners choose to continue without a new organizational fee |
| Does portability help? | A second institution accepts a qualified record for a real purpose | Demonstrated reduction in repeated checking; no assumption of universal recognition |
| Is the service dependable? | Reconciliation exceptions, loss/restore results, access failures, and unresolved disputes | No unexplained credit changes or unresolved critical defects; defined recovery and remedy |
| Will someone sustain it? | Signed renewal, collected revenue, delivery cost, and funded benefit capacity | A commissioner renews on known economics rather than goodwill alone |

Set final targets with the partners after collecting baseline data. A small pilot will often be better at demonstrating feasibility and identifying failure modes than estimating a precise causal effect. Use a phased rollout or comparison cohort where feasible and fair, and ask an independent evaluator to review the design. Separate the effect of a better application from the effect of credits where the design permits it. Preserve rewards already promised to participants.

Collect only the information needed for evaluation, report aggregate results, and budget for accessible participation. Check whether those with less spare time, disabilities, caregiving duties, or transport constraints are being excluded. Civic-credit participation must not become a condition for statutory rights or essential benefits. Any future contribution-linked voting mechanism needs separate democratic and legal scrutiny; it is outside this plan's launch scope.

**14. Team, operating rhythm, and distribution.** The first team needs four capabilities, which can initially be covered by fewer than four full-time people: founder-led partnerships and product decisions; technical ownership of the application and records; local program operations; and research/design/support. Use fractional counsel, accounting, security, and accessibility expertise where appropriate.

The first program operator is as important as another feature developer. Someone must recruit redeemers, help coordinators publish usable opportunities, resolve mismatched expectations, and obtain renewals. Either employ that person or contract for a clearly funded role in a local partner. Do not model unpaid coordination labor as a permanent source of margin.

Use a weekly operating review covering participant issues, partner fulfillment, software reliability, sales, and cash. Use a monthly network review with the commissioner and local partners. At each phase gate, review the evidence and remove features or expansion plans that no longer have a demonstrated purpose. Budget governance around decisions that matter; automate routine calculations and reporting.

Expand through repeatable deployment packages, shared support, local delivery partners, and commercial integrations. A regional integrator can handle procurement and legacy connections while City/Sync supplies the protocol, application, training, and managed service. Agreements should define support responsibility, data handling, compatibility, margins, and exit.

Nextdoor is a plausible distribution partner for resident discovery; its existing public-agency product provides a reason to explore that relationship. Government software vendors and integrators may fit institutional workflows more closely. These are prospect categories, not confirmed buyer interest. [Nextdoor public-agency offering](https://about.nextdoor.com/public-agency).

Pursue a distribution or embedded-client pilot before an exclusive acquisition relationship. Keep several possible routes open: independent operation, commercial licensing, regional operators, and acquisition of the application business. Buyer discussions become stronger when the company has renewed contracts, clean IP, repeatable delivery, measured outcomes, and interoperable technology. Value should come from the business and its capabilities, with appropriate rights governing any transfer of customer data.

**15. The largest risks and the decisions they imply.** A good roadmap makes room for results that challenge the original thesis.

| Risk | Signal | Response |
|---|---|---|
| People like the product but no payer buys | Repeated free pilots and no identified budget owner | Stop geographic expansion; narrow the offer or secure a regional/private commissioner |
| Credits increase expectations faster than useful capacity | Failed reservations, inaccessible catalog, provider withdrawal | Hold new issuance commitments; secure capacity and remedy existing commitments |
| Rewards create employment, tax, or benefit problems | Legal design review or participant cases identify material consequences | Change the mechanism and disclosures before expansion; continue safe coordination work |
| Integration becomes a consulting trap | Every launch needs unique code and founder intervention | Standardize the offer and interfaces; accept bespoke work only with a reusable product rationale |
| Free access outruns funding | Support and hosting costs rise without contracts | Grow within funded networks; improve self-service and commissioner scope before expanding coverage |
| A sponsor distorts the public mission | Requests for participant profiling or control over public decisions | Enforce the program charter, data terms, and governance boundaries |
| Portability remains theoretical | No outside system can consume or verify records | Fund an independent implementation and operator-handoff exercise |
| Cryptographic claims exceed actual guarantees | Marketing equates signatures with truth or roots with data availability | State precisely what is verified; retain evidence, oversight, and recovery obligations |
| An incumbent replicates the features | Customer chooses an existing provider | Compete on tested delivery and outcomes; pursue integration or licensing where advantageous |
| Participation improves while public value does not | More activity but little useful work or uneven access | Revise eligible programs and evaluation; avoid scaling a metric detached from purpose |

The company should be willing to retain the coordination and reporting business even if credits prove useful only in some programs. Equally, if a generic secure-exchange tool already solves a customer's need, City/Sync should integrate it rather than expanding the protocol without a purpose.

**16. The next ninety days.** This is the concrete first work program. Tasks can proceed in parallel where their dependencies allow, but the credit launch depends on the legal and fulfillment gates.

| Period | Owner | Deliverable | Completion evidence |
|---|---|---|---|
| Days 1–15 | Founder and counsel | Entity/IP inventory, free-access charter, single-jurisdiction pilot brief, and scoped legal engagement | Current ownership is documented; legal questions and the intended program configuration are explicit |
| Days 1–30 | Founder and program lead | Buyer/user discovery and a ranked pilot-partner shortlist | Named budget owner, problem, procurement route, coordinator, and renewal criteria for the leading prospect |
| Days 1–30 | Technical lead | Release baseline and pilot-readiness gap list | Critical workflow, authority, privacy, dependency, credit, and recovery gaps have owners and acceptance checks |
| Days 15–45 | Program lead and founder | Conditional issuer/redeemer agreements and priced commissioning proposal | Complementary capacity is committed within limits; someone is responsible for funding and delivery |
| Days 15–60 | Technical lead | Hardened participation-to-redemption loop and export/recovery package | End-to-end, failure/retry, permission, reconciliation, and restore checks pass for the pilot scope |
| Days 30–60 | Counsel, commissioner, and program lead | Approved credit configuration and signed contract package | Authority, participant terms, benefit obligations, data responsibilities, and remedies are settled |
| Days 45–75 | Program lead and evaluator | Small-cohort rehearsal and baseline report | Staff can run the process and participants understand the promises before broad recruitment |
| Days 60–90 | Founder and local operator | Funded controlled launch, or a documented no-launch decision | Funding, staff, capacity, legal design, and reliability support the promises being made |

At day 90, success is a supportable program with a payer and an evidence plan. If that gate is not met, preserve the functioning application, refine the offer, and address the missing condition. A new chain, another city launch, or a larger marketing campaign will not resolve the absence of a budget owner or dependable benefits.

**17. Decisions still requiring founder or partner facts.** Before treating this as an approved operating budget, confirm existing incorporation and equity, current cash and team availability, any signed grants or contracts, the first geography, actual partner commitments, and the applicable reward design. This plan assumes a U.S. initial launch, a small team, no verified recurring revenue, and no requirement to deploy a dedicated blockchain. It treats the Mexico City product domain as a separate future legal and operating context, rather than extending U.S. conclusions to it.

The immediate commitment is to prove that free participation can be supported by someone who values the shared outcome enough to pay for its operation. The first renewal tests that business. The first qualified record reused by another institution tests the interoperability thesis. The first independently operated implementation tests whether City/Sync is becoming public infrastructure.

**Source and evidence notes.** Project facts were drawn from the source checkouts and the following accessible conversations and documents. Previous assistant proposals are treated as design history, not as evidence of deployed functionality, contractual commitments, or validated economics. The document uses a selective review of relevant tasks rather than claiming to have read every historical conversation.

- “Open folder on localhost”: recent application work, deployment reports, discovery behavior, and environment separation.
- “Document public-sector economy”: redemption capacity, bounded partner commitments, issuance controls, and accountable automation.
- “Build Arbitrum L3 Orbit Chain”: independent witnesses, integrity limits, current ledger gaps, and conditional chain adoption.
- “City/Sync Architecture Discussion”: local custody, infrastructure funding, and the history of chain/settlement proposals.
- “City/Sync MCE Coordination”: local coordination roles and the use of visible collective projects.
- “Voice Chat Follow Up”: recurring-staffing work and the active application checkout.
- [City/Sync Whitepaper](/Users/nathansuits/dev/Progress/deliverables/whitepaper/CitySync_Whitepaper.md): institutional thesis, evaluation framework, governance, and architecture target.
- [Backend Architecture](/Users/nathansuits/dev/Progress/CitySync_Backend_Architecture.md): organizational source records, city acceptance, privacy, export, and phased federation.
- [Earlier feature roadmap](/Users/nathansuits/dev/Progress/FEATURE-ROADMAP.md): prior scope decisions; status claims checked against newer code where relevant.
- [Current application package](/Users/nathansuits/dev/Progress-aesthetic-lab/package.json), [city synchronization](/Users/nathansuits/dev/Progress-aesthetic-lab/src/lib/ledger/city-outbox.ts), [credit operations](/Users/nathansuits/dev/Progress-aesthetic-lab/src/lib/services/city-wallets.ts), and [anchoring adapter](/Users/nathansuits/dev/Progress-aesthetic-lab/src/lib/protocol/anchor.ts): direct implementation evidence.

External references are linked beside the claims they support. Price, adoption, staffing, and margin assumptions originate in this planning model and require validation with actual buyers and operators. No company formation, code changes, production deployment, partner contact, or legal filing was performed as part of preparing this plan.
