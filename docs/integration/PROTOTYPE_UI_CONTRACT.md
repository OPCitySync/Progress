# Prototype frontend: visual source of truth

## Decision — September 26, 2026

The initial React/CSS integration did not reproduce the approved prototype. The user explicitly chose to use the actual prototype frontend and reconnect workflows in stages, while retaining the connected platform separately. This supersedes the visual-integration approach in `COORDINATION_INTEGRATION.md`.

The source of truth is `experiments/volunteer-coordination`. Use its actual markup, styling, illustrations, navigation and interactions. Do not recreate the design by appending overrides to `src/app/aesthetic-lab/prototype.module.css` or importing that stylesheet into the new UI.

## Local entrypoints

- **New UI:** http://127.0.0.1:4320/coordination#/coordinator/home
- **Volunteer UI:** http://127.0.0.1:4320/coordination#/volunteer/home
- **Connected platform reference:** http://127.0.0.1:4320/aesthetic-lab/issuer
- **Original standalone prototype:** http://127.0.0.1:4318/#/coordinator/home

`npm run preview:coordination` enables the actual prototype UI and makes the local root URL open it. No database setup or migration is needed for this frontend. Existing platform routes, services and authentication remain available separately.

This is the original **demo frontend**, not a completed backend integration. It uses browser-local sample state; its personas are not authenticated platform identities. Operations such as invitations, Passport sharing and verification remain simulations. Browser storage at ports 4318 and 4320 is separate. The UI retains the prototype's sample-data labels and notices. Nothing in this change migrates or alters platform databases.

## Isolation and source ownership

`src/app/coordination/[[...asset]]/route.ts` returns a full HTML document and its allowlisted assets. It never renders through the React root layout, Tailwind, or the prior integration styles. This is not an iframe or a running-server proxy: it reads the checked-in prototype source, and does not require port 4318 to be running.

`src/lib/coordination-prototype.ts` owns the small hosting adapter:

- All ten stylesheets and the SVG assets are served byte-for-byte unchanged.
- JavaScript modules are unchanged except for mounting feed asset URLs and copied links under `/coordination`.
- HTML changes only mount asset URLs and declare the demo data mode in metadata.
- Only an explicit runtime manifest can be served; documents, tests, server code and arbitrary paths are excluded.
- The local preview flag must enable the route. It returns 404 otherwise, and on Vercel.
- A response content policy blocks network connections and form submissions from this demo document. Backend reconnection must intentionally replace this boundary; do not silently expose demo controls as live operations.

## Reconnection rule

Keep the approved view and layout code as the presentation contract. Add explicit adapters between existing platform services and the UI's data/actions. Connect one complete workflow at a time, including authentication, organization authorization, errors, empty states and persisted results. Remove or relabel its demo behavior only when that workflow is actually connected.

For a future React port, translate the original markup and class names directly into isolated components. Do not derive a new theme from the legacy platform's CSS. Retain desktop/mobile comparisons against this source as an acceptance check.

## Verification

```sh
node --import tsx scripts/verify-coordination-frontend.ts
node --test --test-reporter=dot experiments/volunteer-coordination/*.test.mjs
npm run typecheck
npm run preview:coordination:build
```

The frontend check verifies source equality, the runtime import graph, mounted URLs, private-file exclusion, and the explicit local-demo gate.

Browser verification compared eight Home regions against the original: header, main navigation bar, organization context, secondary navigation, page heading, hero, Action Queue and Calendar. Their measured widths, heights, horizontal positions, background colors, font families/sizes, padding and radii matched at 1280px and 319px widths. These are layout/style comparisons, not a pixel-diff screenshot test.

Additional smoke checks: root redirect, Planning/program drill-down, volunteer switching, feed image loading, Passport navigation. The standalone prototype's 101 model tests pass. No live deployment is part of this change.
