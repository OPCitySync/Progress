# Coordination prototype → connected platform

**Superseded visual approach:** The user rejected this first styling pass. The actual prototype frontend is now the default local entrypoint, with staged backend reconnection. See [the current UI contract](PROTOTYPE_UI_CONTRACT.md). This document remains as the record of the first integration and its database incident.

This is an incremental integration on `codex/prototype-platform-integration`, based on platform branch `branch1/CSV1.0` at `63b3e9b`. It is not a replacement database or a live release.

## Source preservation

Commit `1bf40f9` captures the previously untracked standalone prototype plus the four uncommitted platform refinements from the platform worktree. The prototype remains runnable independently in `experiments/volunteer-coordination` on port 4318. Unrelated planning documents were not included in this change.

Local, ignored backups are in `migration-backups/prototype-integration-2026-09-26`: a verified Git bundle, prototype archive, platform working-file archive, working patch, and manifest. Keep these until the integration is accepted. They are local backups, not an off-device disaster recovery copy.

## What this increment implements

- The prototype's brown/amber primary navigation, cream surfaces, green hero panels, and quieter card styling on the connected application.
- Issuer navigation: Home, Workspace, Volunteers, Public Profile. Organization context becomes a compact horizontal row. Existing configurable quick actions remain in a disclosure, including scheduling and appearance editing.
- Real issuer Home: backend-derived Action Queue and Calendar. Calendar creation, acknowledgements, review links, scheduling, and verification retain their existing actions.
- Volunteer navigation: Home, Opportunities, Passport. Conversations and the authenticated account/identity menu sit at the right of the header. Escape closes the account menu and restores focus.
- Passport has Profile, History, and Resume tabs. Profile uses existing organization membership, eligibility, identity confirmation, waiver, and document records. History includes existing event statuses. Resume includes only verified contributions and retains the existing public/private switch and print/export.
- Older profile links redirect to Passport; existing history/resume URLs still work.
- Connected MyCity feed, opportunity discovery, program tabs, roster, public profile, and program planning retain existing services, permissions, and mutations. Programs is the initial Workspace tab; documents remain available.
- A local preview launcher with dedicated application and city databases, stub email and anchoring, and local storage. Application, migration, and city connections honor preview mode before configured database URLs. Preview mode is rejected on Vercel.

This does not translate the prototype's localStorage model into the production database. No schema replacement is required for this presentation increment.

## Run and review

```sh
npm install
npm run preview:coordination:setup
npm run preview:coordination
```

Open http://127.0.0.1:4320/login. Data is stored in `.integration-preview/`, which is ignored by Git. Setup is repeatable; the existing demo seed skips populated accounts.

Demo login: `issuer@demo.city-sync.org` / `demo1234`. This account initially opens as a person; choose **Switch to Riverside Food Bank** in the profile dropdown. Switch back to Civic Participant to explore the volunteer view. A separate account is `participant@demo.city-sync.org` / `demo1234`.

Demo data created during browser verification: the Community Pantry program and a Preview coordination check calendar note. Fresh setup will create the standard seed only, not those browser-created records.

Uploads still use the application's existing local upload directories. Do not put sensitive documents into the preview. The launcher is local only; do not configure its development secret or demo accounts in a deployment.

```sh
npm run typecheck
npm run preview:coordination:build
node --test --test-reporter=dot experiments/volunteer-coordination/*.test.mjs
node --import tsx scripts/verify-preview-isolation.ts
node --import tsx scripts/verify-volunteer-intake.ts .integration-preview/application.db
node --import tsx scripts/verify-program-workspace.ts .integration-preview/application.db
```

The latter two checks clone the named source into disposable test databases. Run them normally as shown, without inheriting `CITYSYNC_PREVIEW_DATABASE_DIR` from a server shell.

## Capability map and remaining integration

| Prototype capability | Connected platform now | Next implementation and release evidence |
| --- | --- | --- |
| Home, navigation, feed, queue, calendar | Shared design integrated; server data/actions preserved | Review real-user empty, busy, error, and permission states |
| Organization discovery and applications | Existing intake, form versions, admissions, roster and attendance services | Port the prototype's streamlined application screens without changing admission gates; complete applicant-to-active-volunteer browser flow |
| Program coordination | Existing programs, roles/applications, onboarding, shift planning and verification | Add scoped initiative outcomes, linked task dependencies, review states and progress; verify authorization and dependency transitions |
| Combined Planning view | Existing program-level planner remains; prototype planner preserved separately | Add cross-program and one-time/recurring activity filtering, program drill-down and a documented task/shift/recurrence mapping |
| Volunteer assignment | Existing direct assignment and recurring plans | Decide and implement the prototype's invitation/acceptance states before labeling assignments as accepted commitments |
| Passport | Real records, all-event history, verified resume, existing public/private sharing | Selective expiring grants, revocation, evidence corrections and provenance need backend support; do not imply these controls exist yet |
| Public Profile | Existing organization editor and public links with updated authenticated presentation | Finish design parity for public visitor and embedded views, including application entry points |
| Entire production application | Existing auth, account settings, admin/redeemer and service code retained | Further style migration is needed for legacy dialogs/forms, authentication and non-volunteer roles |

Keep this map updated per subsequent increment. Do not delete old routes, services, ledger code, or prototype examples merely because they are no longer in primary navigation.

## Validation recorded

- TypeScript and optimized Next build passed for the integrated application.
- 101 standalone prototype tests passed.
- Existing volunteer-intake checks passed: form versions, admissions, attendance/paperwork gates, privacy, tenant ownership and roster preservation.
- Existing program-workspace checks passed: policies, requirement versions, approval, shift reuse, assignment, staff precedence and audit records.
- Preview isolation regression passed: conflicting configured application/city URLs, newly created cities, absolute-directory requirement and Vercel rejection.
- Browser: demo login and identity switching; issuer Home; calendar note creation confirmed in preview SQLite; Public Profile; program creation and opening Shift Planning; Passport tabs/private resume; mobile at 390px. Program tab layout, Passport heading contrast, and issuer Home grid overflow were corrected during review. Issuer Home, Passport and Opportunities measured 390px document width at a 390px mobile viewport. Escape-menu dismissal passed.

No production deployment, remote push, main-branch merge or live data migration was performed. Installation reported existing dependency advisories; triage them against the deployment before release rather than running an unreviewed force-upgrade.

## Local database incident during setup

The first preview setup failed because `scripts/migrate.ts` used its own database client instead of the preview-aware application client. Its default connection ran the platform's idempotent schema checks, compatibility updates and backfills against the existing root `local.db` before outbox flushing queried the empty preview database and failed. Root `local.db` was modified at approximately 15:49 local time on September 26, 2026. The remote/live database was not involved; root city database modification times remained unchanged.

The launcher now explicitly sets `DATABASE_URL` and the migration runner also uses the same preview URL guard as the application. A subsequent isolated migration/seed succeeded. A post-incident snapshot is preserved as `migration-backups/prototype-integration-2026-09-26/local-after-migration.db`; it is not a pre-migration backup. Without a pre-run database snapshot, the exact local row changes cannot be reconstructed or safely rolled back automatically. Do not claim that the old local database was untouched.

## Merge and release gate

Use small reviewable commits on this branch. Before a live merge: finish or explicitly scope the capability map, resolve remaining integration regressions, review required dependency updates, back up the actual live database/uploads, use a separate Vercel preview project/database and environment, and rehearse any additive schema changes. The repository's Vercel build command runs schema migration; do not point an experimental deployment at the production database.

Rollback of this presentation increment is a normal Git revert of its integration commit(s). Source rollback does not reverse database migrations, including the local incident above. Preserve data backups separately. Retire obsolete UI only after connected workflows and old links have been accepted.
