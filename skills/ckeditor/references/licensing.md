# Licensing (free and premium)

> Look up current key types, limits, and per-feature setup in the live docs and
> the Customer Portal. This file carries the durable concepts only.

## Free / open-source (GPL)

- Set `licenseKey: 'GPL'`.
- Use **only** the `ckeditor5` package and its free features.
- A **"Powered by CKEditor"** logo appears in the editor. It can be removed only
  with a commercial license.

## Commercial keys & activation

- A commercial license key removes the logo and/or unlocks premium features.
- Get keys from the **Customer Portal**: <https://portal.ckeditor.com/>.
- **Match the key to the distribution channel** — a key may be scoped to
  self-hosted vs cloud/CDN use. A channel mismatch shows up as a license error in
  the console.
- Development-domain / localhost allowances and key types vary — check the
  current docs: `…/getting-started/licensing/license-key-and-activation`.

## Free trial & Customer Portal

Premium features need a commercial (or trial) license. To get one:

1. Start a **free trial — no credit card required** — at
   <https://portal.ckeditor.com/>.
2. Obtain the **license key** there. Where applicable, also obtain **Cloud
   Services / CKBox credentials** from the portal.
3. Set the key as `licenseKey` and (for premium) add the
   `ckeditor5-premium-features` package + CSS.

> How an integrator **stores** the key/secrets is their decision — out of scope
> for this skill. We only help **obtain and wire** it.

## Premium feature families

The main families that `ckeditor5-premium-features` + a valid key unlock — this
is **not a complete list**; see the docs for the full, current set and
per-feature setup:

- **Real-time collaboration** — comments, track changes, revision history.
- **CKEditor AI.**
- **Import / export** — Word, PDF.
- **Productivity** — pagination, templates, document outline, and more.
- **CKBox** — file/image management (uses Cloud Services credentials).

**Is a given feature premium?** Check its feature guide — the page states whether
it needs a commercial license — or which package it is imported from: features
imported from `ckeditor5` are free; those imported from `ckeditor5-premium-features`
are premium and need a commercial key.

## Adding premium features

To take a working free editor to premium:

1. `npm install ckeditor5-premium-features` at the **exact same version** as
   `ckeditor5`.
2. Import the premium plugin(s) and the premium CSS.
3. Add the plugin(s) to `plugins` and their buttons to the `toolbar` (the menu
   bar, if enabled, picks them up automatically).
4. Replace `licenseKey: 'GPL'` with the **commercial/trial key** from the portal
   (plus any Cloud Services / CKBox credentials the feature needs).
5. **Re-verify** (build + render + clean console) — see the verify step in
   `SKILL.md`.

## Cloud vs self-hosted / billing

Some premium services (collaboration, CKBox) can run **cloud** (CKEditor-hosted,
often usage-based, e.g. "editor loads") or **self-hosted**. The choice affects
credentials and the license channel. Route to the current docs for limits and
pricing rather than quoting numbers that change.
