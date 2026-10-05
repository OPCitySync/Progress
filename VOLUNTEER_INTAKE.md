# Volunteers-page onboarding alternative

This implementation keeps the experimental Program Area welcome available, while putting an alternative intake process on `/aesthetic-lab/issuer/volunteers`.

## Organization experience

- Onboarding Sessions is one information-blue card with full-width session rows. There are no program-area sections on this page.
- Add Session has three steps: title/location; description/notes; capacity/duration/program assignment. Capacity choices are 2–5 or Flexible (internally 10). Duration is 30–120 minutes in 30-minute steps. Specific Programs supports multiple selections.
- Creating a session does not publish a date. Publish Onboarding uses the same calendar/time-picker component as Home. Weekly recurrence keeps the existing one-at-a-time publication behavior.
- Create/Manage Application supports up to 12 questions: short answer, long answer, choose-one, and yes/no. Questions may be required. Preview shows the participant form. A checkbox controls whether application approval is required before signup.
- Application versions are immutable. An existing submission retains the questions it answered; changing a form does not revoke an existing approval.
- Onboarding Approval has Applications and After Onboarding review views. Reviewed decisions remain accessible and can be reconsidered.
- Both reviews require profile-review confirmation. An application approval permits reservation only; it is not roster membership.
- After verified attendance, or recorded check-in to an ended/closed session, the organization may approve All Programs/Specific Programs, request missing paperwork, or choose Not approved.
- Staff can attest receipt of individual, version-specific paper waivers and session documents. Approval is blocked until the required paperwork is complete. Digital signatures remain available through the existing participant waiver interface.
- Not approved is explicit and organization-local, not a shadow ban. It prevents new signups/assignments at this organization and removes the person from its active roster display. It does not cancel existing commitments, erase history, undo attendance, or reverse credits. The impact requires an additional confirmation.
- Staff status continues to take precedence over volunteering at the same organization.

## Participant experience

Discovery and organization profiles show Apply for onboarding sessions requiring applications. The in-app form saves answers and displays a pending state. An organization decision generates an in-app notification. Approved applicants may then reserve a published date. Attendance is followed by a separate roster/program-access decision and notification. Internal reviewer notes are never included in participant messages.

## Existing membership and coexistence

Existing participation before this alternative was configured is preserved. Explicit roster invitations and existing Program Area approvals still work; an explicit Volunteers-page admission decision takes priority. New intake applicants/reservations do not silently populate the full roster. Regular volunteer signup and assignment enforce admission scope on the server, not just in the UI.

## Storage and privacy

Four additive tables: `onboarding_intakes`, `onboarding_application_forms`, `onboarding_applications`, and `volunteer_admission_decisions`. The last table is the current organization-local decision per volunteer; historical decisions are appended to the control ledger.

New audit types are `ONBOARDING_APPLICATION_FORM_SAVED`, `ONBOARDING_APPLICATION_SUBMITTED`, `ONBOARDING_APPLICATION_REVIEWED`, and `VOLUNTEER_ADMISSION_REVIEWED`. Answers and internal notes stay in permission-controlled application tables, not ledger payloads. These four audit types are organization-private: no public city outbox delivery or migration backfill. Public verification views also exclude them. Existing public attendance/credit event behavior is unchanged.

All organization mutations check role permissions; service operations validate organization ownership and program/document scope. Modal errors retain entries; successful saves close the modal and refresh the page. Modals use portals, keyboard focus containment, Escape/outside dismissal, and pending-submit protection.

## Verification and rollout

- `npm run verify:volunteer-intake` creates a disposable database copy and checks gates, ownership, capacity, duration, paperwork, scope, decline/reconsideration, form versions, roster behavior, and privacy.
- `npm run verify:program-workspace` checks the existing Program Area alternative.
- Browser checks use disposable accounts and an isolated server; no real applicants receive test notifications.
- Verification exception: the legacy outbox-check command was run once before its isolation wrapper was added. It appended local control-ledger record #133, `Outbox integration check` (actor `outbox-checker`), and mirrored it to the local Berkeley ledger. No volunteer, reservation, or credit balance was changed. The record is retained rather than rewriting ledger history. The command now automatically creates disposable databases and also tests the private-event boundary.
- Local tables were added non-destructively. No Turso migration, commit, push, or deployment is part of this change. Run the normal database migration for the target environment before deploying these routes.
- Source checkpoint before this alternative: `/private/tmp/citysync-before-volunteer-intake-20260907.tar.gz`. It excludes ignored databases and environment files.

The question builder does not accept file attachments or conditional question branching. Existing document upload, waiver-signing, attendance verification, and scheduling services remain separate and reusable.
