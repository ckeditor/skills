# Gotchas, "don'ts," and troubleshooting

> The core setup rules live in `SKILL.md` ("Critical rules"). This file adds the
> two gotchas that need more than a one-liner, the stale patterns to actively
> avoid, and a symptom→cause→fix table.

## Two gotchas that need more than a one-liner

### CKEditor inside third-party dialogs/modals

Dialog systems (Radix, Bootstrap, MUI, Headless UI, …) **trap and manage focus**,
which fights CKEditor's UI — toolbars, dropdowns, and balloons are rendered in a
**body-level layer** outside the dialog DOM. Fixes: exclude CKEditor's UI from
the dialog's focus trap; watch for related z-index/stacking and scroll issues.
The docs cover this only lightly (a few notes in the styles guide) — when you
find a working fix, report it via `skill-feedback.md`.

### Some HTML content is not preserved

CKEditor keeps only content its **loaded features** understand — e.g. without the
table feature, tables are dropped on load/paste. Fix order:

1. **Load the dedicated feature** for that content (the right answer most of the
   time).
2. Backup: **General HTML Support (GHS)** to retain arbitrary markup
   (<https://ckeditor.com/docs/ckeditor5/latest/features/html/general-html-support.html>),
   or **HTML embed** for raw HTML blocks
   (<https://ckeditor.com/docs/ckeditor5/latest/features/html/html-embed.html>).

## Don'ts — stale patterns LLMs were trained on

These were valid in older CKEditor 5 versions and are now wrong. Models will
suggest them confidently — **actively steer away.**

- **Don't** use **predefined builds**, the **old Online Builder ZIPs**, or **DLL
  builds**. Use the single-package model (or the current CDN/ZIP).
- **Don't** deep-import from **`@ckeditor/ckeditor5-*/src/...`**, and don't mix
  legacy scoped packages with the `ckeditor5` package.
- **Don't** hand-configure **webpack raw-loaders / PostCSS** for CKEditor styles
  and icons — the modern packages bundle as-is.
- **Don't** hand-write **TypeScript declarations / `.d.ts` shims** — types ship
  with the packages.
- **Don't** omit **`licenseKey`** — it's required on current versions.

## Troubleshooting (symptom → likely cause → fix)

CKEditor errors carry a **code** (e.g. `ckeditor-duplicated-modules`) with a
fuller explanation on the **error-codes page**:
<https://ckeditor.com/docs/ckeditor5/latest/support/error-codes.html>. To
live-debug in a real browser, drive it with the **Playwright MCP** or the
**Chrome DevTools MCP** — inspect the editor instance, DOM, and console while
reproducing the issue.

| Symptom | Likely cause | Fix |
|---|---|---|
| `ckeditor-duplicated-modules` (hard crash) | Two copies / version mismatch / legacy `@ckeditor/*` alongside `ckeditor5` | Dedupe; pin `ckeditor5` + `ckeditor5-premium-features` to the **same** version; remove legacy scoped packages; clear lockfile dupes. |
| License error in console / editor won't start | Missing/invalid `licenseKey`, or key scoped to the wrong channel | Set `'GPL'` or the commercial key; match self-hosted vs cloud/CDN; check trial validity in the portal. |
| Editor renders **unstyled** / content "looks broken" on the page | CSS not imported, or `.ck-content` missing on the output container | Import `ckeditor5/ckeditor5.css` (+ premium CSS); add `.ck-content` to any element showing saved output. |
| `window is not defined` / hydration error | Editor imported/created during SSR | Load client-side only (Next `dynamic(ssr:false)`, Nuxt `<ClientOnly>`, Angular SSR guard). |
| Toolbar button missing or does nothing | Plugin not loaded (or a dependency missing) | Add the plugin to `plugins`; check feature dependencies in the docs. |
| Premium feature inert / not unlocking | Missing `ckeditor5-premium-features` import **or** missing/invalid commercial key | Add the import + the key; confirm versions match. |
| Toolbar/dropdown/balloon hidden or unclickable inside a modal | Dialog focus trap + body-level UI layer | Exclude CKEditor UI from the focus trap; fix stacking/scroll (see the dialog gotcha above). |
| Pasted/loaded HTML gets stripped | Feature for that content isn't loaded | Load the feature; fall back to GHS / HTML embed (see the HTML-preservation gotcha above). |
| Framework component errors on `editor` prop | Passed an instance/namespace instead of the class | Pass the editor **class**. |

For any error **code** not listed, look it up on the error-codes page. When you
solve something the docs don't explain, report it (`skill-feedback.md`).
