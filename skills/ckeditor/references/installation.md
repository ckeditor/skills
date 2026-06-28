# Installation methods

> Look up exact version numbers, current feature lists, and config keys in the
> live docs (Kapa MCP / `llms-full.txt` / <https://ckeditor.com/docs/ckeditor5/latest/>).
> This file carries the **durable** choices and shapes only.

## The single-package model (current)

CKEditor 5 is distributed as **two npm packages**:

- **`ckeditor5`** — the open-source editor and all free features.
- **`ckeditor5-premium-features`** — the commercial features.

Rules that don't change between versions:

- **Install both at the exact same version.** A mismatch (or any leftover old
  `@ckeditor/ckeditor5-*` scoped package) causes the `ckeditor-duplicated-modules`
  crash.
- **Import everything from these two packages** — never deep-import from
  `@ckeditor/ckeditor5-*/src/...`.
- **CSS ships with the packages**: `ckeditor5/ckeditor5.css` and (if used)
  `ckeditor5-premium-features/ckeditor5-premium-features.css`. No webpack
  raw-loader / PostCSS plumbing needed — the modern packages bundle as-is.
- **TypeScript types ship with the packages.** Don't hand-write `.d.ts`.

## Fork ①: choosing a method

### npm / bundler (default when a build step exists)

For Vite, webpack, Next.js, Nuxt, Angular CLI, etc.

```bash
npm install ckeditor5
# Premium, only if needed — SAME version as ckeditor5:
npm install ckeditor5-premium-features
```

```js
import { ClassicEditor, Essentials, Paragraph, Bold, Italic } from 'ckeditor5';
import 'ckeditor5/ckeditor5.css';
// Premium:
// import { FormatPainter } from 'ckeditor5-premium-features';
// import 'ckeditor5-premium-features/ckeditor5-premium-features.css';
```

Match the project's package manager (npm / pnpm / yarn) to its lockfile.

> **Vite** is the recommended bundler for new vanilla/SPA projects. Look up the
> current docs for any framework-specific build notes — don't add custom webpack
> loaders for CKEditor.

### CDN / cloud (no build step, or CKEditor-hosted assets)

Best for plain HTML pages or projects without a bundler. Two shapes:

- **Plain HTML** — load the editor + CSS from `cdn.ckeditor.com` via `<link>` and
  `<script>` tags (the UMD bundle exposes a global). Use the **latest** version
  number from the docs.

  ```html
  <link rel="stylesheet" href="https://cdn.ckeditor.com/ckeditor5/<VERSION>/ckeditor5.css">
  <script src="https://cdn.ckeditor.com/ckeditor5/<VERSION>/ckeditor5.umd.js"></script>
  <!-- Premium adds the matching ckeditor5-premium-features CSS + umd.js URLs. -->
  ```

- **Framework + cloud** — the official wrappers expose a `useCKEditorCloud` /
  `loadCKEditorCloud` helper that loads the cloud bundle for you (pass `version`,
  and `premium: true` for premium). Prefer this over hand-writing script tags in
  a framework app.

Look up the current version string and exact helper signature in the docs.

> **License-key channel matters:** a cloud/CDN distribution may need a key issued
> for cloud use. See `licensing.md`.

### ZIP / self-hosted (locked-down or offline)

When no package manager / CDN access is allowed. Download the versioned ZIP from
`cdn.ckeditor.com/ckeditor5/<VERSION>/zip/…` (and the premium ZIP, same version),
serve the static files yourself, and load the ESM bundle (`ckeditor5/ckeditor5.js`)
+ the CSS. The docs' "Installing from a ZIP" guide has the current file list.

## The CKEditor Builder (visual configurator)

If the user prefers a guided, visual path: the online **CKEditor Builder** lets
them pick editor type, features, and framework and **copy generated integration
code**. Hand off to it, then help wire the generated result into the project.

Limitation to flag: **multi-root is not available in the Builder** — configure it
by hand (see `configuration.md`).

## Versions

Install the **latest** release. For the LTS edition or a pinned older version —
and which doc sources cover them — see **Version routing** in
`documentation-access.md`.
