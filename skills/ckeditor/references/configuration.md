# Editor configuration

> Look up the **exact** config keys, the full toolbar item list, and current
> feature names in the live docs. This file carries the durable concepts and the
> mistakes that don't change between versions.

## Editor type

The editor type is chosen in the core workflow (`SKILL.md`) — it determines the
editor class (`ClassicEditor`, `InlineEditor`, `BalloonEditor`, `DecoupledEditor`,
or a multi-root editor). See the
[editor types guide](https://ckeditor.com/docs/ckeditor5/latest/getting-started/setup/editor-types.html)
for the exact setup of each.

Two of them need extra manual wiring beyond `create()`:

- **Decoupled** — you place the toolbar and the editable **separately** in the DOM.
- **Multi-root** — one editor instance driving multiple editable regions; also
  **not** available in the CKEditor Builder.

## Root configuration (v48+)

**`Editor.create()` takes a single config object — the config is always the only
argument.** Passing the source element or a data string as the first argument is
the old, **deprecated** form that pre-v48 models will reach for. Don't.

- **Don't:** `ClassicEditor.create( document.querySelector( '#editor' ), config )`.
- **Do:** put everything — element *and* data — inside the config. The exact key
  depends on the editor type:
  - **Classic:** `{ attachTo: element, … }`.
  - **Inline / balloon / decoupled** (single root): `{ root: { element, initialData, placeholder, label } }`.
  - **Multi-root:** `{ roots: { <name>: { element, initialData, … } } }`.
- **Initial content goes in the config too** — `config.root.initialData` (single
  root) or `config.roots.<name>.initialData` (multi-root), never a first argument.
- The former top-level options moved under the root: `initialData`,
  `placeholder`, `label` → `config.root.*`.

Look up the exact per-type keys in the
[root types guide](https://ckeditor.com/docs/ckeditor5/latest/getting-started/setup/root-types.html)
and the
[v48 migration guide](https://ckeditor.com/docs/ckeditor5/latest/updating/guides/update-to-48.html#root-configuration-migration-and-deprecated-top-level-options).

## Features: plugins, toolbar, and menu bar

**Loading a plugin is what enables a feature** — this is the single most common
configuration mistake. The `toolbar` config only controls *which buttons show*;
the feature itself is enabled by adding its **plugin** to `plugins`. So surfacing
a toolbar feature is two steps: (1) add the plugin to `plugins`; (2) add its
button name to `toolbar`. Removing a plugin can cascade — features depend on
other plugins (for example lists, images, tables pull in helpers).

`Essentials` (undo/redo, typing, enter, clipboard, etc.) and `Paragraph` are the
near-universal baseline. Look up exact plugin and button names in the docs.

The [toolbar guide](https://ckeditor.com/docs/ckeditor5/latest/getting-started/setup/toolbar.html)
has crucial setup detail — item grouping, line wrapping, nested/grouped
dropdowns, separators, and the full item list. **Tip:**
`Array.from( editor.ui.componentFactory.names() )` returns every toolbar
component available in the current build (useful to discover what you can add).

### Menu bar

The menu bar behaves **differently from the toolbar**: it is filled with items
from the loaded official plugins **automatically** — you don't list each button.
You only turn it on:

- **Classic editor:** set `menuBar.isVisible: true` in the config.
- **Other editor types:** inject `editor.ui.view.menuBarView.element` into the
  DOM yourself.

See the [menu bar guide](https://ckeditor.com/docs/ckeditor5/latest/getting-started/setup/menubar.html)
for details. Recommend the menu bar in **richer setups** (for example Word-like
applications), where the many available buttons would not all fit in the main
toolbar.

## CSS & styling content (`.ck-content`)

Two things must happen or the editor/content "looks broken":

1. **Import the editor CSS** — `ckeditor5/ckeditor5.css` (and the premium CSS if
   used). With CDN, load the matching stylesheet.
2. **Add the `.ck-content` class** to any element that renders **saved editor
   output outside the editor** (a blog page, a preview, an email). CKEditor's
   content styles are scoped to `.ck-content`; without that class, published
   content won't match what was authored.

Styles guide: <https://ckeditor.com/docs/ckeditor5/latest/getting-started/setup/css.html>.
Customizing the editor's look is done with CSS variables / overrides — see the
docs; don't fork the bundled CSS.

## Data, lifecycle & persistence

- **Accessing data differs by integration.** In vanilla JS you call
  `editor.getData()` / `editor.setData(html)` on the instance and manage the
  lifecycle yourself (`create()` / `editor.destroy()`). In the **official
  framework wrappers you usually don't call `create()`** — the component does,
  and it exposes its own binding: React's `data` prop + `onChange`, Vue's
  `v-model`, Angular's `[(ngModel)]` / `[data]`. For reading or writing data in a
  framework, use that binding rather than calling `getData()` / `setData()`
  directly. Initial content can also be set through config
  (`config.root.initialData`).
- **Persistence is the integrator's call, and optional for a valid setup.** If the
  app has no save/load layer yet, an initialized, rendering editor is "done."
- When wiring save/load (form/textarea submit, autosave, an API), **default to
  storing HTML** — `getData()`'s default output. It's the most universal format
  (it can represent every editor feature) and needs the least processing.
- **With real-time collaboration, persistence is wired differently.** The
  document state is synchronized and stored through CKEditor Cloud Services / the
  collaboration server, so you don't read `getData()` on submit the usual way —
  follow the collaboration feature's own data/persistence model instead.

## Internationalization (i18n)

UI and content language are configured via the `language` config. The durable
mistake is **how translations are loaded**, and it differs by channel:

- **npm** — `import` the translation(s) and **register** them with the editor.
- **CDN** — translations are **auto-loaded** from the cloud; don't import them.

Language guide:
<https://ckeditor.com/docs/ckeditor5/latest/getting-started/setup/ui-language.html>.

## TypeScript

Types **ship with the packages** — no setup beyond installing. **Never hand-write
`.d.ts` shims** for CKEditor. The shipped `.d.ts` files also carry API docs as
JSDoc comments, so you can read API documentation straight from the declarations.

## Content Security Policy (CSP)

In CSP-restricted apps, the editor (and the cloud license check, for cloud/CDN
distributions) needs a minimal policy. Be aware it's required; look up the exact
directives in the docs:
<https://ckeditor.com/docs/ckeditor5/latest/getting-started/setup/csp.html>.

## Customizing icons (optional)

Icons can be customized in self-hosted setups. Mention it's possible and point to
<https://ckeditor.com/docs/ckeditor5/latest/getting-started/setup/customizing-icons.html>.
