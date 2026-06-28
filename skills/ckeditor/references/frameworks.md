# Framework integration

> Per-framework wiring is version-specific and voluminous. This skill keeps it
> **minimal**: the durable baseline + the one universal gotcha, then points to
> the official integration docs. Don't restate them — route to them.

## Baseline: CKEditor runs in any JS setup

CKEditor 5 is a **plain JavaScript library**. It runs anywhere JavaScript runs.

**No official wrapper ≠ unsupported.** For Svelte, Solid, Astro, Ember, Web
Components, plain HTML, or any framework without an official wrapper, **integrate
the vanilla editor directly**: create a container element, call
`Editor.create( config )` in a client-side lifecycle hook (v48+: the config is
the only argument — point it at the element, see `references/configuration.md`),
and `editor.destroy()` on teardown. That's the whole contract.

## Use the official wrapper when one exists

Official wrappers (detect the framework, then route to its doc):

- **React** — `@ckeditor/ckeditor5-react`
- **Vue** (3+) — `@ckeditor/ckeditor5-vue`
- **Angular** — `@ckeditor/ckeditor5-angular`
- **Next.js** and **Nuxt** — meta-framework guides built on React/Vue.

Find the current guide via `llms-full.txt` or the docs
(`…/getting-started/integrations/<framework>`). Follow it rather than improvising.

**Pass the editor _class_** to the wrapper component (e.g. `editor={ClassicEditor}`),
**not** an instance and not a namespace object — a very common mistake.

## SSR / client-only rendering (the one cross-cutting gotcha)

The editor needs **browser APIs** (`window`, `document`). In any server-rendered
setup it must load **client-side only**, or you get `window is not defined` /
hydration errors:

- **Next.js** — `dynamic(() => import('…'), { ssr: false })`; App Router
  components need `'use client'`.
- **Nuxt** — wrap the editor in `<ClientOnly>`.
- **Angular Universal / SSR** — guard creation so it runs only in the browser
  (e.g. `isPlatformBrowser`).

For any other SSR framework, apply the same principle: defer editor creation to
a browser-only lifecycle.

## Framework-specific issues → defer to the docs

React StrictMode double-mount, Vue `v-model` / component registration, Angular
`formControlName` / `ViewEncapsulation`, and data-binding timing are real but
**framework- and version-specific**. Don't bake fixes in here — point to the
official integration doc for the current guidance.

## Example integration repos

Working, real-world examples (frameworks, multi-root, and premium
collaboration/AI setups):

- **<https://github.com/ckeditor/ckeditor5-demos>** — assorted integration demos.
- **<https://github.com/ckeditor/ckeditor5-collaboration-samples>** — premium
  real-time collaboration, comments, track changes, revision history, AI.

Use these as references when a setup is non-trivial or the user wants a known-good
starting point.
