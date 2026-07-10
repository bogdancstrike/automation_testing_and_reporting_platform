# Platform Logo Integration

## Goal

Use the supplied `qtp-logo.svg` as the canonical Quality Testing Platform logo across the application without changing the artwork.

## Scope

- Add one canonical copy at `frontend/public/qtp-logo.svg`.
- Replace the generated sidebar `Q` badge with the logo.
- Add the logo beside the Developer Guide title.
- Use the logo as the browser favicon.
- Preserve the current expanded, collapsed, desktop, mobile, light, and dark layouts.

## Design

The public asset path is shared by static HTML and React, avoiding duplicate copies or inline SVG markup. The sidebar renders the logo at a stable 34 by 34 pixel size and retains the existing text treatment when labels are visible. The Developer Guide renders a smaller mark beside its existing title. Both placements use `object-fit: contain` so the square artwork is never cropped or distorted.

The document head references `/qtp-logo.svg` with `rel="icon"` and `type="image/svg+xml"`. All visible logo images use meaningful alternative text where the image communicates identity; the sidebar image may use an empty alternative because adjacent text provides the accessible name.

## Verification

- Run the frontend production build.
- Check the expanded and collapsed desktop sidebar.
- Check the mobile navigation.
- Check the Developer Guide in light and dark themes.
- Confirm the favicon asset is requested successfully.

## Non-goals

- Redesigning the supplied artwork.
- Reworking the platform color tokens around the logo palette.
- Changing product naming or other page content.
