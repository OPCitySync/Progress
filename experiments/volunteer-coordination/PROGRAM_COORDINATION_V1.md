# Programs as scoped coordination workspaces

## Repository review and design

The issuer implementation reviewed is on `branch1/CSV1.0`, not the current `main` checkout:

- `src/lib/services/volunteer-programs.ts`: organization-owned programs with a name, description, defaults, and onboarding preference.
- `src/app/aesthetic-lab/issuer/programs/[id]/page.tsx`: program-scoped positions, applicants, recurring schedules, roster, and documents.
- `src/app/aesthetic-lab/issuer/ProgramWorkspace.tsx`: Roles & Applications, Onboarding, Shift Planning, and Verification.
- `src/lib/db/program-workspace-schema.ts` and `PROGRAM_WORKSPACE.md`: work areas, custom measures, document receipts, and shared/program-specific onboarding.

That work provides useful operating tools. This separate prototype puts a defined initiative above them: why the program exists, who benefits, scope boundaries, success criteria, an accountable lead, and a time period. The main app and development branch are unchanged. No production database is used.

## The three activity types

| Type | Agreement | Coordination |
| --- | --- | --- |
| One-Time Activity | One scheduled occasion | A dated roster, capacity, preparation, handoff, and a review of delivery |
| Recurring Activity | Repeated occasions | Concrete weekly or fortnightly occurrences, independent rosters and acceptance per date |
| Program Task | A bounded deliverable within an initiative | Owner, due date, acceptance criteria, reviewer, prerequisites, evidence, and handoff |

Location is independent: any type can be in person, remote, or hybrid. Internal `event`, `shift`, and `project` keys remain to preserve existing prototype integrations. Program Task requires a program. One-time and recurring activities may also be standalone organization activities.

Ongoing Placement and Standby are removed from creation and active discovery. Legacy records are archived without changing or deleting their commitments. A standby pool is never converted into a scheduled commitment. Coordinator Work & activities includes a historical-record disclosure. Organization membership, recruitment roles, and volunteer availability remain separate concepts.

## Issuer presentation

1. **Program portfolio:** purpose, accountable lead, program period, accepted work count, blockers, and reviews awaiting attention.
2. **Overview:** the program brief, scope exclusions, success criteria, attention list, and change history. A fully defined brief is required before activating a draft.
3. **Work plan:** work grouped into areas/milestones, ordered by dependency depth and date. Every item explains its owner, reviewer, acceptance criteria, prerequisites, next step, and any external blocker. Filter for blocked work or reviews; volunteers also have a commitments filter.
4. **People & schedule:** dated occurrences and task deadlines alongside the people actually committed or invited. Naming a responsible owner does not book that person. Existing recruitment and onboarding remain available through a link to that workspace.
5. **Resources & decisions:** shared text instructions/document references, progress observations, decisions, and risks. These are program context available to organization members, not a place for private applicant or beneficiary records.

## Execution rules

- Work proceeds through Not started → In progress → Ready for review → Complete.
- Starting, submitting, and accepting work require completed prerequisites and no external blocker.
- A confirmed contributor may start or submit work. The demo coordinator records review acceptance, requested changes, or reopening on behalf of the named reviewer. The reviewer name is descriptive; this is not a separate delegated login or permission system.
- Submission requires a result/evidence note. Acceptance requires a review note. Handoff updates cannot bypass acceptance.
- Dependencies must be inside the same program. Self-links and indirect cycles are rejected. Started work cannot acquire an unfinished prerequisite. A prerequisite cannot be reopened while a dependent item is already in progress, in review, or complete.
- Plans in review cannot be silently changed. Return the work to progress first. Prior review decisions remain in the history; reopening clears the current acceptance marker.
- A recurring builder creates 1–12 weekly or fortnightly dates atomically. Dates must fit within the program period. Each has its own roles, capacities, invitations, attendance, and review. There is no automatic booking across the series.
- Dependencies link concrete work items/occurrences. If only the first shift requires a setup task, link that shift; the model does not invent a series-wide rule.
- A draft is visible only in the coordinator view and cannot accept commitments. Members can read active program context; public newcomers can still access individual public activities without receiving the internal program workspace.
- Closing a program requires all work to be accepted and a written outcome review. Completing work is not evidence by itself that the public-purpose outcome was achieved.

## Suggested walkthrough

Open Volunteer programs → Community green spaces → Work plan. The planting activity is blocked by “Repair and test bed 4 irrigation.” Start the repair, submit the leak-test result, and record a review acceptance. Planting then becomes ready to start. Add a Recurring Activity to create the ongoing care dates, each with a separate roster.

Try editing the repair to depend on planting: the cycle is rejected. Try closing the program before all work is accepted: the form remains open with an explanation.

## What is still an extension

This is a local browser prototype for Berkeley Neighbors, with sample identities and no production authentication or persistence. Program membership/approval does not yet exist separately from organization membership. Recruitment is linked at organization level, not automatically scoped to an initiative. The branch's documents, waiver versioning, custom metric tables, and recognition features have not been ported.

Resources are text/reference records, not uploaded files or an access-controlled document store. Work areas are labels, not separately owned subprojects. There is no Gantt editor, critical-path estimate, cross-program dependency, calendar-conflict solver, series-wide edit/exception editor, automatic reminder, or automated measurement system. These should follow observed coordination needs rather than obscuring the initial work plan.

## Validation

`npm test` includes program regressions for migrations, three-type validation, cycles, cross-program references, blocked transitions, evidence and review, contributor permissions, reopening, recurrence, program scope dates, draft activation, and outcome closure. Browser tests use `localhost:4318`, separate from the user's `127.0.0.1:4318` local-storage origin.

Browser validation completed: prerequisite submission stayed blocked until review acceptance; recurring creation produced four empty rosters; premature program closure kept the form open with an error; a shared resource saved; a new scoped program was created and activated; Jules submitted a task and had no acceptance controls. Desktop (1280px) and mobile (390px) layouts were checked for horizontal overflow, and the mobile creation/review form controls remained within the dialog. All 73 model tests passed.
