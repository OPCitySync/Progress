# Volunteer coordination studio

A standalone frontend exploration of the proposed City/Sync volunteer workflows. It runs independently of the main Next.js app and the `Progress-aesthetic-lab` worktree.

## Run locally

Requires Node.js 20 or newer. No dependency installation is needed.

```sh
cd /Users/nathansuits/dev/Progress/experiments/volunteer-coordination
npm run dev
```

Open **http://127.0.0.1:4318**. The server binds only to the local computer. To choose another port, run `PORT=4319 npm run dev`.

This folder has its own package file, server, styles, model, and tests. It does not use or change the existing application's routes, database, environment variables, dependencies, migration scripts, or deployment configuration. No new branch, commit, or deployment was created.

## What to explore

Use **Issuer view / Volunteer view** inside the header avatar dropdown to see both sides of the same sample organization. In volunteer mode, the person selector lets you explore any sample volunteer. **Try a journey** offers six starting points.

1. **Newcomer → event participant.** Choose Robin, open the garden event, complete its two preparation steps, and confirm a place. Robin remains an event participant until requesting ongoing membership.
2. **Applicant → team member.** As coordinator, review Elena in People and approve membership. As Elena, inspect My organization: membership is approved while packing preparation remains outstanding.
3. **Invitation → agreement.** As Alex, accept the garden invitation. The organization's confirmed count changes only after acceptance.
4. **Cancellation → replacement.** As Alex, cancel Saturday packing. As coordinator, open Saturday distribution and offer Morgan a place. Switch to Morgan and accept. Membership and completed preparation survive the cancellation.
5. **Continuing work.** Open the welcome-guide project, update the handoff and its review status, and add a message. The activity retains that context.

## MyCity Feed

Open **Home** as a volunteer or **Home → MyCity Feed** as an issuer, or go directly to http://127.0.0.1:4318/#/coordinator/feed.

The feed adapts the platform’s `MyCityFeedContent`, `PostActions`, and organization composer to this prototype’s design. It includes:

- Shared organization updates, optional images, and the All / News / Organizations / Trending filters.
- Likes, per-person bookmarks, search, and links to individual posts.
- Coordinator publishing under Berkeley Neighbors, with a 1,000-character limit.
- Optional links to public activities, opening the existing coordination and signup flows. Member-only activities cannot be attached to city posts.
- Image preview/removal and required descriptions. PNG, JPEG, WebP, and GIF files up to 500 KB stay in local browser storage; failed storage saves retain the draft.
- City context, public activities, and the selected volunteer’s confirmed plans.

No local news service is connected; News shows an explanatory empty state, matching the platform’s current behavior. Seed posts and their organizations are fictional, and City Pulse counts describe this sample workspace. There are no public comments, matching the existing feed. A copied post link is local to the browser’s saved dataset, not a publicly hosted post.

Existing saved coordination data gains the feed automatically, without a reset. Feed posts, likes, and bookmarks persist alongside that data. Coordinators and individual volunteer personas have separate reaction/bookmark records.

Also implemented:

- Searchable People views, invitations, assisted entry for existing members, membership approval and pause/resume.
- CSV paste/upload with preview, duplicate detection, and invalid-row handling. Expected columns: `name,email,role`; role is optional.
- Role-specific preparation, completed-step reuse, and coordinator-only driving approval.
- Activity creation with One-Time Activity, Recurring Activity, and Program Task templates; separate visibility and enrollment choices.
- Self-signup, proposed assignments, decline, cancellation, waitlist offers, capacity checks at confirmation, and check-in.
- Volunteer availability/preferences without automatic bookings.
- Activity conversations, project handoffs, schedule views, and organization action lists.
- Responsive layouts, native modal focus handling, inline form errors, and reduced-motion support.

## Volunteer Passport V1

Read [the research-to-V1 decisions and full walkthrough](VOLUNTEER_PASSPORT_V1.md). Open **My passport** as a volunteer or **Passports** as a coordinator: http://127.0.0.1:4318/#/coordinator/passport.

The implementation includes optional skills/profile information, completed training and contributions, explicit issuer confirmation, selected and time-limited sharing, recipient previews, organization-specific acceptance, correction requests, confirmation withdrawal, JSON export and a printable selected summary. Existing browser data migrates without a reset.

Start with **Elena**: share her sample food-packing training, switch to Coordinator, review and accept it. People now shows packing readiness while membership stays separate. Ending access or changing the evidence removes dependent readiness and raises a review alert for existing commitments. Passport data is never added to MyCity Feed. All provider confirmations and partner agreements are fictional; the frontend simulates access rather than securing it.

## Organization discovery, applications and onboarding

Open [Discover organizations](http://127.0.0.1:4318/#/volunteer/discover) as a volunteer, or [Recruitment](http://127.0.0.1:4318/#/coordinator/recruitment) as a coordinator. The organization selector in Recruitment covers Berkeley Neighbors, Berkeley Tool Library and Friends of Strawberry Creek. Role offers, applications, onboarding and newly recruited rosters are scoped to the chosen organization; the original activity workspace still belongs to Berkeley Neighbors.

- Discover missions and roles through search, cause/work-mode filters and saved organizations. Organization names in MyCity Feed now open public profiles.
- Create a role draft, preview it, then publish, pause or close recruitment. Choose a short application or conversation-first pathway and preparation relevant to the role.
- Volunteers save private drafts, submit with consent, track next steps and reply targets, exchange questions, and accept or decline time-limited offers. Open events keep direct signup.
- Coordinators review applications, request information, waitlist, give feedback or reserve an onboarding place with an offer.
- Shared onboarding assigns each step to the volunteer or coordinator, reuses applicable accepted passport evidence, and requires a named buddy and agreed first step before roster activation. Membership and work bookings remain separate.
- Assisted application entry requires confirmation of the volunteer's approval. No unshared passport information is prefilled for the assisting coordinator.

Start as Robin. Apply to the Tool Library, switch to Coordinator on the application, ask a question, offer a place, then return as Robin to accept it. Complete both sides of the welcome plan and activate the role. The **Try a journey** menu provides a discovery entry point. Existing browser data migrates without a reset.

See [research, design decisions, full walkthrough and limitations](RECRUITMENT_ONBOARDING_V1.md). All organizations, contacts and checks are fictional; no external messages are sent.

## Data and limits

All people and activity details are fictional sample data. Dates deliberately illustrate September 2026. Use sample data when exploring.

Changes are saved in this browser's local storage under `citysync-volunteer-studio-v1`. Tabs on the same origin share changes; different browsers and different ports do not. The selected volunteer persists for the tab session. **Reset demo** restores the original sample organization, affecting only this prototype's data.

This is a frontend simulation, not a production service. There is no authentication, real organization permission enforcement, email/SMS delivery, actual legal signature, credential validation, external calendar integration, or production database connection. Persona switching is an exploration tool, not an authorization system. Conversation visibility is simplified in the demo.

Programs now provide a scoped brief, dependency-aware work plan, evidence/review workflow, people and schedule view, and shared resources/decisions. The three creation options are One-Time Activity, Recurring Activity, and Program Task. Recurring creation generates 1–12 weekly or fortnightly dates with independent commitments. See [Program coordination V1](PROGRAM_COORDINATION_V1.md) for the repository comparison, execution rules, migration behavior, and remaining extensions.

## Shift Planning

Open **Workspace → Planning**, alongside Programs, Activities, and Schedule: http://127.0.0.1:4318/#/coordinator/planning.

This adapts the platform's `ProgramRosterScheduler` to the prototype styling and invitation workflow. Search the volunteer rail on the left; on the right, choose Programs, One-Time Activities, or Recurring Activities. Open a program to see its tasks and activities, with a link back to its full brief. Choose a 1-, 2-, or 4-week window or all dates, and sort by date, title, or open places. Program sorting uses its earliest visible work date or total open places.

Drag a volunteer onto a work card, or select a volunteer and choose **Invite** (also available on phones and with a keyboard). Multi-role activities ask which role to invite them to. Confirmed, invited, and waitlisted people stay distinct; invitations never count as confirmed coverage. Existing preparation, membership, capacity, duplicate, and program-state checks still apply. Past dates cannot receive new invitations. Dependencies remain visible; staffing a task does not complete its prerequisites.

Remove a place or withdraw an invitation from its card, with an optional note. Each recurring occurrence keeps its own roster. **Add activity** uses the selected category and program; **Print plan** previews the current scope. All changes use the existing activities and commitments, persist locally, and appear in the existing volunteer workflows. Nothing is sent externally. Free-text availability is shown as context; automated time-overlap detection is not included.

Planning was browser-checked on the isolated `localhost` dataset: actual pointer drag to invite, duplicate prevention, withdrawal, program drill-down, multi-role choice with missing preparation, printable preview, and desktop/phone layouts. Eight additional model tests cover calendar boundaries and projections, invitation authority and capacity, readiness at acceptance, closed/past work, and occurrence-specific removal.

## Issuer Home: Action Queue and Calendar

Open **Home → Overview**: http://127.0.0.1:4318/#/coordinator/home. The four summary tiles and bottom “Small steps, shared progress” card are removed. The old weekend-coverage and attention panels are replaced by two connected work surfaces, styled in the prototype palette.

- **Action Queue:** adapts the platform's `ActionQueueCard` and issuer overview queries. It derives membership/application reviews, preparation concerns, submitted work, past-session attendance reviews, overdue tasks, dependencies, and staffing needs in the next seven days from current state. Recruitment items are scoped to Berkeley Neighbors. Review buttons open the actual work; Acknowledge stores a local snapshot without completing anything. History supports restoration. A changed staffing shortfall appears again. Collapse and show-all controls keep the queue compact.
- **Calendar:** adapts `IssuerSchedulePanel` with a month grid, week agenda, previous/next/Today navigation, and selected-day details. Existing one-time activities, recurring occurrences, and program-task due dates appear automatically. Day details link to activity management, its conversation, and its program in Planning. Scheduling from a selected day pre-fills that date.
- **Organization notes:** add or edit a title, date/time range, location, details, and color. Notes persist locally, including across month boundaries. They do not publish an opportunity, book a volunteer, appear in the volunteer feed, or send reminders.

The platform's hour-by-hour timeline is adapted into a day agenda because this prototype stores activity times and task effort as free text. Task due dates are labeled explicitly rather than invented as timed bookings. The calendar has no external-calendar synchronization or delivery service.

Browser checks used the isolated localhost dataset: acknowledge/restore/collapse, month navigation, week-to-day drill-down, note creation and persistence, selected-date scheduling, conversation and Planning routing, and 390px/320px layouts without horizontal overflow. Eight additional model tests cover migration, acknowledgement semantics, changed coverage, organization scoping, past-session review, date boundaries, multi-day notes, and validation/authority.

## Verification

```sh
npm test
```

The 101 dependency-free model tests cover public profile migration, organization-scoped editing, URL and image validation, public pathway visibility, program scope, dependencies and cycles, evidence/review transitions, independent recurring dates, outcome closure, draft visibility, and feed migration, publication scope, attachment validation, likes, bookmarks, filtering, passport privacy and migration, issuer provenance, sharing expiry/revocation, corrections, scoped acceptance, readiness alerts, export, and the original workflows: membership/readiness separation, public-event participation, invitation acceptance, cancellation and replacement, capacity rechecks, private self-signup, qualification approval, pauses, duplicates, preferences, CSV parsing, and project context.

Browser walkthroughs were performed against a separate local port and dataset: membership approval visible on both sides; newcomer preparation and signup; invitation acceptance; cancellation and replacement; project handoff and conversation; CSV preview/import; activity creation and proposed assignment. The MyCity extension was also browser-tested using the separate localhost origin: publication with an image, per-person saves, reactions, filtering, search, post permalinks, and navigation to a public activity. Desktop and narrow layouts were inspected. No browser console errors were reported during the verified walkthroughs.

Passport browser checks used the separate localhost origin: selective sharing, coordinator acceptance reflected in the roster, separate membership approval, actual activity signup, printable summary, access revocation with the commitment retained and flagged, contribution entry, a different recipient’s profile-only preview, and JSON export preview/copy. The embedded browser did not expose a download event for the initial automatic download, so export now provides a visible save link and a verified copy fallback. The passport was inspected at desktop and 390px phone width.

## Files

- `index.html`: standalone document.
- `styles.css`: responsive design.
- `app.js`: views, forms, routing, and browser persistence.
- `feed-model.js`: feed data, migration, filtering, and publication/reaction rules.
- `feed-view.js` / `feed.css`: city feed, post cards, composer, and responsive styles.
- `assets/`: locally authored sample feed illustrations.
- `feed.test.mjs`: feed behavior tests.
- `passport-model.js`: portfolio, sharing, verification provenance, decisions, expiry, export and readiness.
- `passport-view.js` / `passport.css`: owner and reviewer pages, forms, selected previews and print styling.
- `passport.test.mjs`: passport and coordination integration tests.
- `VOLUNTEER_PASSPORT_V1.md`: source-grounded V1 scope, fields, walkthrough and production boundary.
- `recruitment-model.js`: organization-scoped positions, applications, offers, preparation and roster transitions.
- `recruitment-view.js` / `recruitment.css`: discovery, organization profiles, role forms, review workspace and onboarding.
- `recruitment.test.mjs`: 20 recruitment and integration tests.
- `RECRUITMENT_ONBOARDING_V1.md`: research, process choices, walkthrough and production boundary.
- `model.js`: sample data and state transitions.
- `model.test.mjs`: workflow invariants.
- `server.mjs`: local static server with no runtime dependencies.

Edit these files and refresh the browser. There is no build step or hot reload.

## Public Profile

The issuer top menu includes Public Profile, adapted from the platform issuer lab. Edit organization information, customize the banner/logo, feature an open volunteer pathway, and preview the matching volunteer-facing page. See [Public Profile V1](PUBLIC_PROFILE_V1.md) for source references, behavior, and verification.

## Issuer navigation

Issuer navigation follows the platform's four-section `LabHeader` model, replacing the long issuer sidebar:

| Top section | Contextual pages |
| --- | --- |
| Home | Overview, MyCity Feed, Discover organizations |
| Workspace | Programs, Activities, Schedule |
| Volunteers | Roster, Recruitment & onboarding, Passports |
| Public Profile | Organization information, appearance, public preview and sharing |

Program and activity detail routes keep Workspace selected. Role and application detail routes keep Volunteers selected. Public organization discovery stays under Home. Existing route URLs and local data are preserved. Volunteer navigation remains its existing layout.

The issuer header uses the organization profile palette, an organization identity strip, contextual tabs, a volunteer-view switch, and keyboard skip-to-content. At narrow widths the four sections stay visible; the smallest breakpoint stacks icons above their labels. Secondary tabs can scroll independently. Main content now uses the full available width, bounded at 1440px.

Validation: the 85 model tests pass. Browser checks covered desktop 1280px, mobile 390px, narrow 320px, active sections on detail routes, keyboard skip behavior without changing the route, and issuer/volunteer view switching. No console errors were observed.


## Volunteer navigation

The volunteer experience now uses the same top-navigation design as the issuer workspace, with three major sections:

- **Home** (`#/volunteer/home`): MyCity Feed, with organization stories, likes, bookmarks, search, upcoming plans, and local organization links. The desktop layout includes a private personal shortcut card; on mobile it becomes a single stream. Existing `#/volunteer/feed/<post-id>` links still open individual posts.
- **Opportunities** (`#/volunteer/work`): Explore activities, Local organizations, Applications, Commitments, Programs, and My organization. Existing application, onboarding, invitation, booking, and task workflows retain their routes and state.
- **Passport**: Profile (`#/volunteer/passport`), History (`#/volunteer/history`), and Résumé (`#/volunteer/resume`). Profile contains optional personal details and sharing controls; History contains completed contributions, learning, provenance, and review decisions.

The résumé builder starts with only a name. Select profile sections and individual completed records, save the selection, then preview and use **Print / Save PDF** through the browser’s print dialog. Selections persist separately for each sample volunteer. Scheduled activities never become completed experience, status changes remain visible, and the builder creates no sharing permission. Changing a selection disables printing until it is saved. Full passport JSON exports include the private résumé selection.

All changes remain in this standalone prototype. No backend authentication, external publishing, or email delivery is connected. The original issuer menu is unchanged. Viewport checks cover desktop and phone widths; passport tests cover résumé ownership, selection, persistence, and changed evidence status.


### Header conversations and account menu

Both views place **Conversations** in the top right of the header, immediately left of the avatar dropdown. It opens the existing activity conversations page and is no longer a Workspace or Opportunities subtab. At smaller widths, its message icon retains an accessible label and tooltip.

The avatar menu contains the current person’s name and role, a profile link, and the Issuer / Volunteer view switch. Volunteers also have an availability and preferences shortcut. Existing initials are used as the avatar fallback. The menu supports keyboard activation, Escape, outside-click dismissal, and closing when focus leaves. Desktop and 320px phone layouts were checked; the 85 existing tests continue to pass.
