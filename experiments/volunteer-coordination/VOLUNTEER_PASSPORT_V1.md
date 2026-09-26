# Volunteer Passport V1

## The product decision

Build a volunteer-owned evidence portfolio connected to specific organization decisions. A passport should reduce repeated explanation and training where organizations agree on equivalence. It should never imply that a person is universally cleared, automatically admitted to an organization, or committed to work.

The prototype now implements that model inside the existing coordination experience, with a volunteer **My passport** page, a coordinator **Passports** inbox, and accepted evidence feeding the existing preparation and signup checks.

## What the research supports

Source: **Volunteer Passporting Research**, Research Works Limited for the UK Department for Digital, Culture, Media and Sport, April 2021; supplied as `Research_Report_on_Volunteer_Passports.pdf`. Page references below use the numbers printed on the report's pages.

This is qualitative research with 58 respondents and a literature review, not an impact trial or a representative measure of sector-wide demand. The report explicitly identifies limited evaluations of existing schemes (pp. 10–11, 57). It supports design hypotheses; it does not establish a particular efficiency gain. Its discussion of UK DBS and identity-check portability is historical context, not a current rule for a Berkeley-based platform.

| Finding | V1 decision |
| --- | --- |
| Portability and recognition are related but distinct goals (pp. 11–16, 56–57). | Separate keeping a record, confirming its source, and accepting it for local preparation. |
| Portability depends on trusted organizations, agreed standards, and responsibility for verification (pp. 20–23). | Record issuer, named reviewer, evidence checked, course version, dates, and receiving-organization decision. Demonstrate one narrow partner agreement. |
| Training and risk vary by organization and sector; local induction remains relevant (pp. 39–40, 45–48, 58). | Reuse an agreed training requirement only. Membership, welcome, agreements, driving and other checks remain local. |
| Volunteers differ in motivation; complicated frameworks and mandatory training can discourage participation (pp. 40–41, 49–52). | Optional profile and portfolio; plain-language skills; no completion score, rank, reward currency, or passport prerequisite for all work. |
| Manual timekeeping can burden organizations (p. 41). | Hours are optional for individual completed contributions. A scheduled shift or check-in never becomes confirmed service automatically. |
| Volunteer control, interoperability, and accessibility matter (pp. 27–28, 51–52, 62–63). | Explicit section/record selection, recipient and end date, preview, revocation, data export, and a selected printable summary. |
| Risk processes and volunteer rights sit behind the visible passport (p. 64). | Specific evidence can be disputed or its issuer confirmation withdrawn, with reasons and history. No universal warning flag about a person. |

## Information to include in V1

| Information | Who supplies it | Treatment |
| --- | --- | --- |
| Display name and stable internal volunteer ID | Existing account | Name accompanies a share; internal ID links records without duplicate people. This is not verified identity. |
| Email | Existing account | Separate opt-in section in the passport share. Existing roster contact details are not erased by revoking a passport share. |
| City/area, languages, brief introduction | Volunteer | Optional profile; no precise address or date of birth. |
| Practical skills and lived experience | Volunteer | Explicitly self-described, separate from confirmed learning. |
| Availability and preferred ways of volunteering | Existing coordination profile | Reuse current preferences; separately selectable for passport sharing. Never creates a booking. The existing organization's preference-sharing workflow still applies. |
| Training title, issuing organization, completion date, expiry if supplied, standard/version, learning summary | Volunteer initially; issuer confirms | Clearly self-reported until the issuing organization confirms. Missing expiry is shown as unspecified, not proof of lifelong validity. |
| Completed contribution title, organization, date, summary, optional hours | Volunteer initially; supervising organization confirms | Record useful experience without mandatory timesheets. Scheduled commitments and attendance are not completion evidence. |
| Confirmation provenance: person, organization, date, evidence checked | Issuing organization | Confirmation is specific to a record. A receiving organization cannot impersonate another issuer. |
| Sharing recipient, purpose, explicit field/record selection, creation/end dates, revocation | Volunteer | No default active shares or prechecked fields. Newly added records remain private. Selected profile fields stay current while shared. |
| Receiving decision: requirement, reviewer, reason, date, selected record and sharing permission | Receiving organization | A narrow, explainable acceptance or follow-up request; no global “verified volunteer” flag. |
| Corrections, withdrawal reasons and activity history | Owner and relevant organization | Preserve provenance, suspend disputed evidence, and review a corrected replacement afresh. |

## What works in this prototype

1. Existing saved workspaces gain passports additively. Roster, feed, commitments, local preparation and user edits are preserved. Newly added people get an empty passport.
2. Volunteers can edit optional profile fields and add completed training or service as self-reported records.
3. Volunteers choose Berkeley Neighbors or Berkeley Tool Library, specify a purpose and end date, and select each section and record. The recipient preview and printed summary use the same filtered projection as the coordinator view.
4. Berkeley Neighbors has a working reviewer inbox. Its coordinator can confirm its own shared records using an evidence note, request follow-up, accept eligible training for food packing, and withdraw its own confirmation. The Tool Library is a second recipient for testing different selected views; its operational reviewer workspace is not implemented.
5. Acceptance requires a current attested training record from a named trusted issuer matching the exact `food-packing/1` standard. This **fictional prototype agreement** includes Berkeley Neighbors and East Bay Volunteer Learning. It is not an actual accredited qualification or agreement with real organizations.
6. Accepted evidence satisfies only the food preparation requirement. The stored local-completion flag stays unchanged, so source and acceptance are not conflated. Signup and invitation acceptance check evidence through the scheduled activity date.
7. Expiry, withdrawal, a correction request, follow-up, or ending/replacing a share invalidates dependent acceptance. Existing commitments are preserved and get a readiness-review alert; future confirmation is blocked until preparation is valid again. Independently completed local preparation remains valid under the prototype's existing rules.
8. Volunteers see review decisions, reasons and recent passport activity. A corrected record is added as a replacement and needs new sharing and review; V1 does not silently rewrite confirmed history.
9. Volunteers can download their full passport as a versioned JSON document, or preview and print the information selected for one recipient. Print is a basic assisted/non-digital handoff, not a full delegated-account service. Copies clearly state their date and that they cannot be recalled.

All of this runs in the standalone prototype. It does not change the main platform's database, routes, authentication, deployment, or development worktree.

## Deliberately outside V1

- Raw identity documents, full background-check reports, criminal history, medical details, precise home addresses and beneficiary information.
- Universal identity/background-check clearance, cross-jurisdiction check portability, or a generic green badge authorizing every activity. Identity/check-provider integrations need their own verified provenance, purpose, access and policy design.
- Public passport URLs, scannable bearer-token QR codes, search-engine indexing or posting passports in MyCity Feed.
- Credits, rewards, rankings, reputation scores, automated suitability judgments or automatic assignments.
- A national shared volunteer pool or mandatory enrollment in one. Existing relationships and volunteer choice remain primary.
- Cryptographic credential issuance, provider connections, certificate uploads, standards-compliant credential exchange or import. JSON export is a documented application schema, not a claim of established interoperability.

## Try the complete journey

Open `http://127.0.0.1:4318/#/coordinator/passport` and choose **Explore Elena's sample passport** when the inbox is empty. Alternatively, choose Volunteer → Elena Brooks → My passport.

1. Elena starts with a clearly labeled fictional course confirmation and no shares.
2. Choose **Share my passport**, select only her training record, enter a purpose, and save.
3. Preview the shared view. Email, skills and availability should be absent unless selected.
4. Switch to Coordinator. Review the issuer, dates and standard, choose **Accept for food packing**, and record why.
5. Open People → Elena. Food preparation reads **Passport accepted**, but membership remains **Joining**.
6. Approve membership separately; as Elena, book Tuesday community kitchen. Acceptance of passport evidence itself creates no commitment.
7. Return to My passport and end access. The coordinator can no longer open that shared passport. Her existing commitment remains visible with a preparation review alert. Local welcome/agreement and membership remain unchanged.
8. Try adding another completed record, sharing it with only one recipient, downloading your data, and preparing a printable summary.

Use fictional data only. All personas and organizations use one browser-local dataset. Switching personas simulates ownership and reviewer roles; it is not authentication or secure multi-tenant access control. No external messages, actual legal signatures or provider verification occur.

## Production boundary and pilot learning

Before connecting this to real platform data, move these transitions and recipient projections to authenticated server APIs; derive actor/organization identity from sessions, enforce tenant-scoped permissions, and keep issuer attestation separate from receiving acceptance. Add concurrency control, append-only review history, provider verification where needed, expiry/withdrawal event handling, retention and account-deletion rules, and a consented assisted-entry workflow. Browser-local history is illustrative, not a tamper-proof audit log. A permission ending should prevent future access; retention of a minimal decision record and handling of preexisting copies require an explicit real-world policy.

Start with a small group of willing organizations and one or two genuinely agreed training equivalents. Measure repeated onboarding steps avoided, time to readiness, coordinator review time, rejected equivalences and reasons, expired evidence discovered before work, volunteer understanding of sharing, and success for people using assisted access. Compare against the existing onboarding workflow. Expand only when the evidence shows less repeated work without unclear responsibility or exclusion; the report does not establish those outcomes in advance.

## Implementation map

- `passport-model.js`: additive migration, records, grants, filtered recipient projection, provenance, acceptance and readiness rules, export.
- `passport-view.js` and `passport.css`: owner portfolio, receiving review, share selection/preview, record forms, printable view, responsive styling.
- `model.js` and `app.js`: integration with people, local preparation, activity-date checks, route/persona switching, storage and readiness alerts.
- `passport.test.mjs`: privacy projection, role boundaries, migration, evidence validity, sharing lifecycle, local confirmation, correction, export and actual signup integration.

The schema groups data into `profiles`, `records`, `grants`, `decisions`, and `audit` under `state.passports.version = 1`. Export declares `schema = citysync.volunteer-passport` and `schemaVersion = 1`. Existing `citysync-volunteer-studio-v1` storage is reused so no reset is necessary.
