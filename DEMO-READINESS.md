# Demo acceptance fixes

## Scope completed

- AUD-03: cart paths accept only same-origin `/shop/` or `/en/shop/` URLs;
  invalid schemes, protocol-relative paths, backslashes and control characters
  are rejected. Stored image paths are restricted to `/images/`. This does not
  establish backend order validation or prove membership of arbitrary IDs.
- AUD-04: compatible package updates and refreshed lockfile. Astro 7.4.5,
  astro/check 0.9.12, Playwright 1.64.1 and Sharp 0.35.5; npm audit reports zero
  known vulnerabilities at verification time. TypeScript remains 5.9.3.
- AUD-05: GitHub Pages restored earlier; verify the current deployment after push.
- AUD-06: failed catalog loads no longer become permanently successful fallback
  state. Initial cards remain usable; a visible error with retry is provided.
  Subsequent interactions and the browser online event can fetch the full index.
- AUD-07: non-finite, unsafe, fractional and non-positive page parameters normalize
  to page 1; out-of-range valid integers clamp to the last page.
- AUD-13: decorative hero stamp is hidden on mobile; verified by mobile E2E.
- AUD-14: first-screen entrance animation no longer delays visible hero content.

## Verification

- Astro check: 0 errors, warnings or hints.
- Full local browser suite: 80 passed, 6 device-specific skips, 0 failures.
- Clean `npm ci` in the primary source workspace: successful; npm audit: 0.
- Local mobile Lighthouse: homepage performance 98, LCP 2.34 s, CLS 0.0011,
  TBT 0 ms; earlier audit baseline was 84 and LCP 4.42 s.
- Catalog: performance 99, LCP 1.71 s, CLS 0.0105, TBT 0 ms.

These are local laboratory runs, not production field INP/CrUX measurements.
Other items in the independent audit, including checkout, payment functionality,
SKU/master data, translated copy and crawlable catalog pagination, are outside
this demonstration-readiness change set.
