# Issuer public profile

## Current experience

An issuer opens its public profile from the profile image in the MyCity Feed. The profile replaces the Feed’s center and left columns while retaining the Feed’s right rail. The expanded route is `#/coordinator/feed/profile`, so it can be refreshed or shared inside an authenticated workspace.

The expanded view uses the same organization banner, logo, introduction, public opportunities, and contact information that Civic Participants see. Its banner has one action: **Back to MyCity Feed**. The former standalone **Edit Public Profile** screen is retired.

Owners edit the profile in context:

- Select the profile image to edit the banner style, palette, logo, cover image, and cover description.
- Use the edit icon after the public activity count to edit the tagline, mission, and location.
- Use the edit icon on **About Us** to edit the organization description, cause areas, support information, and welcome message.
- Use the right-rail edit icons to update the public volunteer contact and social links.

The page presents **Open Roles** first, followed by **Open to the Public Activities**. Each collection scrolls horizontally and supplies a clear empty state when nothing is available. The former “Find your way in / Ways to get involved” heading has been removed so these sections follow the organization story directly.

`#/volunteer/org-profile/<organization-id>` remains the Civic Participant route. Discovery cards and organization links lead there. Civic Participants see the same public content without issuer edit controls and can signal interest, share a MyPassport, save an organization, or open a public activity through the existing flows.

## Data and visibility

Mission, location, contact, support, welcome, and organization description remain on the existing recruitment organization object. Appearance, social links, cause areas, and the featured role remain additive profile metadata. Open public roles and available public activities determine what appears on the page; member-only activities, drafts, archived or completed activities, applicant records, program decisions, and private passport data stay hidden.

Profile image uploads accept PNG, JPEG, or WebP files under 500 KB. The prototype stores those images in browser storage. URL and contact validation continues to use the existing profile model safeguards.

## Verification

Automated profile, Feed, navigation, and model tests cover inline editing, organization scoping, public visibility, retired-editor removal, route behavior, and owner-versus-visitor controls. The expanded desktop layout and its edit dialogs were also checked in the local MyCity surface without browser console errors.
