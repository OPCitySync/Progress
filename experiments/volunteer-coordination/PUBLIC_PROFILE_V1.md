# Issuer Public Profile in the coordination prototype

## Platform sources reviewed

The issuer design on `branch1/CSV1.0` supplies the structure:

- `src/app/aesthetic-lab/issuer/profile/page.tsx`: branded preview, organization-information card, website sharing, and profile-completion suggestions.
- `IssuerProfileInformationCard.tsx` in that directory: editable mission, cause areas, location, email, phone, and website.
- `WebsiteSharingCard.tsx`: public link and website volunteer-button code.
- `src/lib/profile/organization-appearance.ts`: Original, Folded Ribbon, Confluence, and Civic Mosaic styles; City/Sync, Forest, Terracotta, and Amethyst palettes.
- `src/components/profile/OrgProfileBody.tsx`: visitor-facing identity, about, contact, applications, and opportunities.

The current main checkout's `src/components/profile/ProfileForm.tsx` was also reviewed for tagline, image, contact, and social editing. This implementation adapts the issuer lab's immediate-save behavior, rather than introducing a second publish/draft lifecycle for organization profiles.

## Prototype behavior

Coordinator sidebar → Public Profile (`#/coordinator/profile`). Select one of the three fictional organizations to manage its page.

The profile editor includes:

- Branded preview and a volunteer-facing preview action.
- The platform's four named banner patterns and four palettes, rendered locally in CSS.
- Optional logo and cover upload, decoded and limited to PNG/JPEG/WebP under 500 KB each; cover descriptions are required. Images stay in local browser storage. Cancel discards the appearance draft.
- Mission, tagline, cause areas, location, public email, phone, website, volunteer contact, social links, about, access/support, and welcome editing.
- A featured first-step role selected from the organization's currently open pathways. Closed, expired, or unavailable pathways disappear automatically.
- Copyable local profile link and website-button HTML. There is no hosted embed or remote publication.
- Suggestions based on mission/causes, location/contact, and available participation routes.

`#/volunteer/org-profile/<organization-id>` now renders the matching public-facing profile. Discovery cards and feed organization links already lead to this route. Public role and activity buttons use the existing application and signup flows. Member-only activities, draft programs, archived activities, and completed activities do not enter this page's activity listing. It does not expose program decisions, applicant records, or passport records.

Mission, location, contact, support, welcome, and description remain on the existing recruitment organization object. Profile-specific appearance and links are additive metadata. Cause edits update the primary discovery category and all cause tags become searchable/filterable. No duplicate mission copy needs synchronization. All editing is organization-scoped in the demo; real authentication and authorization remain outside this static prototype.

Counts describe open volunteer roles and public activities. The page does not invent verified impact or a verified-organization badge from sample roster data.

## Verification

81 model tests pass, including eight profile regressions for additive migration, canonical field updates, organization scope, cause categorization, unsafe URL/contact rejection, appearance validation, featured-role availability, and public activity visibility.

Browser checks on the isolated `localhost:4318` origin covered saving a mission, appearance palette/style changes, a featured pathway, volunteer preview, navigation into the role application page, copying the website-button HTML, and edit controls being absent in volunteer view. Desktop 1280px and mobile 390px layouts had no horizontal overflow; mobile appearance controls remained within the dialog. No browser console errors were observed. File decoding and upload persistence were not exercised through the browser file chooser during this pass.

The user-facing preview remains at `127.0.0.1:4318`; its sample content was not replaced with the browser-test edits. No main application source or production data was changed.
