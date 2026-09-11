# Program workspace: first implementation

This iteration keeps the existing Program → Program Details structure, rails, card colors, and scheduling controls. It is an additive workflow experiment, not the planned database architecture redesign.

## Where the work lives

- **Program Overview:** work areas with a purpose, next step, status, and linked volunteer positions; custom measures with units, reporting periods, optional targets, and dated progress entries. Existing participation history and verified impact remain below these tools.
- **Onboarding:** choose shared organization onboarding, program-specific onboarding, or no onboarding. Configure a welcome, required document receipts, digital/paper waiver handling, and optional orientation attendance. Share the invitation page, then review the candidate's profile and approve them before adding them to the roster.
- **Volunteer Position Catalog:** create a reusable description of the work without publishing a date. Existing template management remains available. Scheduling a new shift directly still saves the reusable position automatically.
- **Scheduling:** the existing weekly/shift views, recurring plans, staff/volunteer separation, capacity safeguards, and printable schedule stay together.
- **Recognition:** use verified participation to send a private personal/team thank-you or create a printable appreciation letter. The letter can be saved as a PDF through the browser print dialog.

Onboarding is optional. A newly configured welcome does not remove existing roster members. Program-specific approval does not grant approval to other program-specific welcomes. Staff authority continues to override volunteer eligibility in the same organization.

Custom measures are manually recorded totals, not a general-purpose formula/dashboard builder. Corrections are additional entries; a negative adjustment requires a note. The program map uses simple work-area cards rather than an unrestricted diagram editor.

## Save behavior

New forms close only after successful saves. Errors stay inside the open form so the user can correct them. The reused program, onboarding, document, waiver, and publishing dialogs use the same success-only save handling and render above the page through portals.

## Data and deployment

The existing application database gains seven tables: program workspace settings, applicants, document receipts, work areas, metrics, metric entries, and recognition records. Candidate approvals also create explicit roster memberships. New domain actions have corresponding append-only audit events; private appreciation messages and free-form work-area notes are not copied into audit payloads.

Waiver receipt checks refer to specific waiver-version IDs. Document receipts refer to the document's update timestamp, so a changed document needs a new acknowledgement before a pending candidate is considered ready.

The additive DDL is included in `scripts/migrate.ts`. Before deploying this code to another environment, run the normal migration against that environment's application database. A Git push alone does not apply database changes. This development iteration did not migrate Turso or deploy anything.

## Verification

Run:

```sh
npm run typecheck
npm run verify:program-workspace
npm run build
```

The regression command uses SQLite's backup operation to copy `local.db` to a disposable temporary directory, sets `DATABASE_URL` to that copy, removes the remote auth token, and exercises policy inheritance, requirement versions, roster approval, shift-first reuse, assignment, staff precedence, and audit recording. An alternate local database path can be passed after `--`. It requires the `sqlite3` CLI and never intentionally writes fixtures into the source database.

For browser write-tests, run a separate server using copies of both the application and city databases. Check work-area creation, measurement validation, onboarding configuration, profile approval, appreciation, publishing, and popup close behavior there. Do not sign real legal documents or send messages to real recipients as test fixtures.

## Reverting this experiment

A pre-iteration source checkpoint was saved at `/private/tmp/citysync-before-program-workspace-20260906.tar.gz`, including the earlier uncommitted work. Compare against that checkpoint and revert only this iteration's source changes; do not reset the whole branch. Database records and audit entries must not be deleted as part of a UI rollback. Additive tables can remain unused after the UI is reverted.
