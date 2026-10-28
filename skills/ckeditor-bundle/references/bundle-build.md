# The bundle build

## The requirements of the bundle file

Read the current requirements and the size limit of the upload request in the "Building the editor bundle" section of the main editor bundle guide (see `documentation-access.md`). These rules of the file do not change:

- **One file that runs as a classic script.** Cloud Services adds the file to a page like a `<script>` element without `type="module"`. Use a UMD or IIFE build.
- **The `CKEditorCS` global is the editor class itself.** Many bundlers set the global to an object with a `default` property. Each bundler has an option to use the default export instead.
- **All code is in the file.** The bundle must not load other files, for example the chunks of dynamic imports.
- **No `process` global.** The page of Cloud Services has no `process` global. Replace `process.env.NODE_ENV` with `"production"` in the build.
- **A production build.** Minify the code.
- **No styles are necessary.** If the plugins import CSS files, the build must not fail. Other files in the output folder, for example a CSS file or the license text of the minifier, are not a problem. The upload sends only the JavaScript file.

## The entry file

The bundle has its own entry file. It imports the editor class from the shared module and exports only this class as the default export:

```js
// The entry file of the editor bundle. Cloud Services uses its default export as the `CKEditorCS` global.
import { AppEditor } from './editor.js';

export default AppEditor;
```

Do not export other values. With other exports, some bundlers set the global to an object with all exports.

## Choose the bundler

Use a separate configuration for the bundle, next to the application's configuration. Do not change the application's build.

- **Vite.** Use the library mode with the `umd` format, the `CKEditorCS` name, and the option that uses the default export. Read the Vite guide of Cloud Services and the Vite docs of the installed major version, because the names of the build options change between major versions.
- **webpack.** Use `output.library` with the `CKEditorCS` name, the `umd` type, and the default export. Turn off the split of dynamic imports into chunks. Read the webpack guide of Cloud Services and the webpack docs of the installed version.
- **Other bundlers that can build a library**, for example Rollup, Rspack, or esbuild. Use the same settings as for Vite, with the option names from the docs of the bundler.
- **Build tools that cannot build a library**, for example the build of Next.js or of Angular CLI. Add Vite as a development dependency only for the bundle build, and use the Vite setup. If the project already has another bundler that can build a library, use it.

Then:

1. Add a script to `package.json`, for example `build:bundle`. The script builds the bundle with the bundle configuration, and nothing else.
2. Write the bundle to a separate folder, for example `dist-bundle/editor.bundle.js`. Add the folder to `.gitignore`. If the project's linter examines the project files, add the folder to its ignore list too. ESLint 9 does not read `.gitignore`.
3. If the project uses TypeScript, the bundle build can compile the editor files. Keep the project's type check as it is.

## A monorepo

Put the shared module in the package that owns the editor. Put the bundle configuration and the `build:bundle` script in the same package. Make the paths in the bundle configuration relative to the configuration file, so that the build works from every folder, for example from the root of the repository.

## Projects without npm packages

An application can load CKEditor 5 from the CDN or from a ZIP file. The bundle build needs the npm packages:

1. Add `ckeditor5`, and `ckeditor5-premium-features` if the editor uses premium features, as development dependencies. Use the exact version that the application loads. Do not use a version range.
2. Write the editor definition as a module that gets the CKEditor exports as an argument. For example, `createEditorClass( { ClassicEditor, Bold, … } )` returns the editor class, and the custom plugins are made in the same way. The application gives the exports of the CDN, and the bundle entry gives the exports of the npm packages.
3. In the bundle entry, import by name only the exports that the editor uses. A namespace import (`import * as`) of the npm package puts all features of CKEditor 5 in the bundle. This list is a second copy of the plugin list, so make the build fail when an export is missing, for example with a check of each name.
4. Tell the user that the CDN version and the npm version must change together. A difference changes the editor on the server.
