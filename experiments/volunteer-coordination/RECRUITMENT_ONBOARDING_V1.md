# Discovery, applications and a supported start

## Recommended approach

Use a proportionate, two-sided pathway:

**Discover an organization → understand a role → apply or start a conversation → human review → volunteer accepts an offer → shared onboarding → activate the role → choose actual work.**

The application is an introduction. An offer is a choice. Membership, role preparation and scheduled commitments remain distinct. An open event continues to use direct signup without requiring an ongoing-role application.

There is no evidence here for one universally “best” form. This design combines current practitioner guidance with the prototype’s existing coordination and passport model. It should be tested with organizations and volunteers before becoming a production standard.

## Research and design decisions

Research reviewed September 23, 2026. These sources describe good practice; they are not a controlled comparison of application systems or a determination of California legal requirements.

| Guidance | Implementation choice |
| --- | --- |
| NCVO recommends a straightforward, accessible application process, alternative formats and a contact for questions. Interviews should focus on the role and how participation can work for the person. [Applications and interviews](https://www.ncvo.org.uk/help-and-guidance/involving-volunteers/recruiting-and-welcoming-volunteers/recruiting-volunteers/managing-volunteer-applications-and-interviews/) | A brief form with interests, availability, reply email, optional experience and at most one extra role question. No mandatory CV or passport. Save a private draft; coordinators can enter an assisted application only with the volunteer’s approval. |
| Volunteering Australia’s standards emphasize meaningful documented roles, information about the organization and selection process, equitable recruitment, and relevant induction/support. [National Standards](https://www.volunteeringaustralia.org/get-involved/resources/nationalstandards/) | Public organization profiles and role descriptions explain mission, tasks, time, experience, support, access options, preparation and the decision pathway. Every application has a named contact and visible next step. |
| Volunteer Canada treats screening as an ongoing, role-specific process that starts with role design and extends through orientation and support. A record check is only one possible part of it. [Screening guidance](https://volunteer.ca/screening/) | Organizations select relevant preparation and can describe an additional coordinator-owned check. The app does not impose a blanket background check, rank applicants, or claim automated clearance. |
| NCVO’s induction guidance emphasizes practical information, a named contact, introductions, expenses, support needs and buddying, followed by ongoing support. [Volunteer induction](https://www.ncvo.org.uk/help-and-guidance/involving-volunteers/recruiting-and-welcoming-volunteers/running-a-volunteer-induction/) | A shared welcome plan assigns steps to the volunteer or coordinator. Activation requires a recorded buddy introduction and an agreed first step, along with the role’s preparation. |

The calendar-day reply target, expiring offer reservation, explicit volunteer acceptance, and private draft behavior are product decisions intended to make responsibility and capacity visible. They are not claimed as prescriptions from the sources. Measure whether they help in a pilot.

## What is implemented

### Volunteer discovery

- A directory of three fictional organizations with mission, location, cause, practical support and named contacts.
- Search across organizations and open roles; filters for cause and in-person, remote or hybrid work; per-volunteer saved organizations.
- Organization profiles with current opportunities and an explanation of the pathway.
- Three entry modes: open-event signup, a short role application, or an introduction that starts a conversation.
- Organization names in MyCity Feed open their discovery profiles.
- A newcomer’s home page and the existing organization joining prompt lead into discovery.

### Organization recruitment

- A separate Recruitment workspace with an organization selector. Each sample organization has its own roles, submitted applications, preparation and recruited roster.
- A role builder covering impact, tasks, time/flexibility, experience, support, work mode, pathway, number of new-volunteer places, initial reply target, optional deadline, one optional question, and role-specific preparation.
- Draft → public preview → publish, with pause and close controls. Existing applications remain accessible after recruitment closes; already-issued offers can still be accepted within their deadline.
- Published roles retain their terms. For material changes, create a new role/recruitment round. An application saves the role description and requirements as they were when submitted.
- Editable mission, support and welcome information on the organization profile.

### Applications and decisions

- Private draft, submitted, reviewing, needs information, waitlisted, offered, onboarding, active, declined, withdrawn and offer-declined states.
- Existing application reuse prevents parallel active applications for the same person and position.
- Acknowledgment with an initial reply target; a visible notice if that target passes before the first human response.
- A conversation and timeline visible to the applicant and receiving organization. A volunteer’s reply to a follow-up question returns the next action to the reviewer.
- Review decisions need a reason or next step that the applicant can read. There is no hidden automated score.
- Offers reserve onboarding places until expiry. Expired offers do not consume capacity and cannot be accepted; a coordinator must renew them. Waitlisting never auto-confirms a volunteer.
- The volunteer explicitly accepts, declines or withdraws. None of these actions automatically creates a shift booking.
- Assisted entry for an existing sample person records that the volunteer requested help and approved the answers. It does not expose private passport skills or take over an existing private draft.

### Onboarding and roster activation

- Each step has an owner, status and completion note. Volunteer-owned acknowledgments cannot be completed by the coordinator through this flow; coordinator reviews cannot be self-approved.
- Local welcome, a demo participation-agreement acknowledgment, optional food packing preparation, driving qualification review, optional additional role check, and a buddy/first-step introduction.
- Preparation already completed at Berkeley Neighbors is reused. Current accepted passport evidence can satisfy its food-training step; revoked, disputed or expired evidence stops doing so. Passport sharing remains a separate voluntary action.
- Other organizations maintain their own local preparation. Their welcome/agreement never changes Berkeley Neighbors’ readiness flags.
- A coordinator activates the role only after volunteer acceptance and complete preparation. Activation adds an organization-specific roster relationship; Berkeley Neighbors also updates its existing People roster. Existing memberships and bookings are preserved.
- Berkeley positions can suggest an existing first activity. The volunteer still chooses whether to book it. Other sample organizations carry an agreed first step and recruited roster; full scheduling workspaces for them are not implemented.
- Active roles can revisit incomplete preparation through the same owner-specific steps. This is not a full offboarding or continuing-supervision system.

## Data and access boundaries

`state.recruitment.version = 1` contains organizations, positions, applications, memberships, organization-scoped preparation and per-person saved organization IDs. The migration is additive. It preserves the existing feed, people, passports and commitments.

Drafts remain private, including drafts withdrawn before submission. Reviewers cannot access another organization’s application through the recruitment projection or perform its state transitions. Application answers are separate from passport data and never posted to MyCity Feed. The browser persona/organization controls simulate these boundaries; they are not production authentication.

Application states and memberships deliberately do not rewrite one another. Accepting a Tool Library role does not add the volunteer to Berkeley Neighbors. Withdrawing an application does not remove an existing organization membership or cancel unrelated work. Leaving an active external organization is outside this V1 workflow.

## Try it locally

Open [Discover organizations](http://127.0.0.1:4318/#/volunteer/discover), select **Robin Ellis**, and choose a role at **Berkeley Tool Library** or **Berkeley Neighbors**.

1. Save a partially completed private draft; switch to Coordinator to verify it is not visible.
2. Return as Robin, finish the form, approve sharing and submit. Open **My applications** to see the next step and reply target.
3. Switch to Coordinator on the application, or choose the receiving organization in **Recruitment**. Ask a follow-up question and reply as Robin.
4. Offer a place with a deadline. Robin chooses whether to accept it.
5. Complete Robin’s preparation as Robin. As coordinator, record the buddy introduction and first step. Activation remains disabled until all steps are ready.
6. Activate the role and inspect the newly recruited roster. For Berkeley Neighbors, also inspect People and choose a first activity separately.
7. In Recruitment, create a draft role, inspect its preview and publish it. Find it through organization discovery. Try pause, close, and another organization’s review workspace.

The original garden event still uses its simpler signup flow. The **Try a journey** dialog also includes discovery and applications.

## Validation and production boundary

55 automated tests cover the combined prototype, including 20 recruitment tests for migration, private/withdrawn drafts, consent, applicant and organization scope, assisted entry, immutable application terms, follow-up, capacity reservation, offer expiry, ownership of onboarding steps, independent organization rosters, passport reuse and withdrawal.

Browser checks cover draft privacy, application submission, two-way follow-up, an expiring offer, acceptance, shared onboarding, blocked premature activation, buddy introduction, roster activation and creation/publication of a new role. Discovery search/filtering, a 390px phone layout and the mobile application dialog were also checked. No browser console errors were reported. Existing workflows remain independently tested.

All data and contacts are fictional. Messages stay in the browser. There is no actual legal signing, live credential/background checking, email delivery, secure file storage, or authenticated organization access. Calendar-day targets are displayed, not scheduled notifications. Application drafting uses an explicit save, not autosave.

Before platform integration: put projections and transitions behind authenticated, organization-scoped server APIs; enforce capacity with transactions; add durable event/audit records, notification delivery and retention/deletion rules; and build an accessible assisted-application process for people without accounts. Configure real local screening, safeguarding and agreement policies with the relevant organization. Avoid migrating a browser’s asserted confirmations into trusted production evidence.

Pilot measures should include time to first human response, incomplete/abandoned applications, steps repeated unnecessarily, coordinator review time, accepted offers that reach a supported first activity, clarity of the next step, and completion through assisted formats. Compare simple and more involved roles separately before adding more application fields or stages.
