# Changelog

## 2026-10-31

- Fixed missing styles on the user administration page. The route component used
  `.admin-*` classes but did not import `admin.css`, so Vite omitted the
  stylesheet from its lazy-loaded production chunks. Importing the stylesheet
  from `admin-users.tsx` makes it load with that route in development and in
  production builds.
- Fixed the unstyled approved-account home and shared authentication loading
  and error states. `App.tsx` renders those states but previously did not load
  `auth.css` until a lazy authentication page was opened, so a direct visit to
  `/` had no matching styles.
- Established the new site name, shared brand tokens sampled from the provided
  emblem, self-hosted Inter, favicon/app icons, and emblem assets without
  changing page layouts. The privacy and terms pages only had their site-name
  references changed; their legal wording still needs human review.
- Redesigned the public access and legal layouts and added a responsive
  authenticated shell with a collapsible sidebar, user menu, and mobile
  navigation drawer. Authentication and route guards were preserved.
- Refined the login and signup brand panel with a larger centered emblem and
  balanced spacing. Activity deadlines now use separate Brazilian-local date
  and explicit 24-hour hour/minute selectors, preserving the selected local
  time when saved or edited.
- Redesigned member campaign browsing, activity submission, submission list
  and detail, and ranking layouts to use the shared brand system responsively.
  Existing role guards and submission workflows remain unchanged.
- Redesigned reviewer assessment, submission detail, CSV export, user
  administration, and admin campaign/activity management screens with the
  shared brand tokens and responsive layouts. Authorization and data workflows
  remain unchanged.
- Completed B17 responsive route smoke checks at 360, 768, and 1280 CSS pixels,
  verified public-page keyboard focus indicators, darkened small supporting
  text to meet WCAG AA contrast, and documented authenticated-browser QA limits
  in the README.
