# Verifying the bundle

Verify the result in this order. Each step needs the previous one.

1. **The application.** Build it, and run its type check and tests. The application's editor must start as before, with the same plugins, the same toolbar, and the same output of `getData()`. If a browser MCP (for example, Playwright or Chrome DevTools) is available, open the page and read the console.
2. **The bundle build.** Run the bundle script, for example `npm run build:bundle`. It must write one JavaScript file without top-level `import` or `export` statements.
3. **The shared module.** Load it in Node.js, for example with `node -e "import( './src/editor/config.js' )"`. It must load without errors.
4. **The check of the bundle.** Run the check script. It loads the bundle as Cloud Services does and compares the editor output with the test data.

## The check script

The script needs a headless browser. It uses Playwright. If the project does not have Playwright or Puppeteer, ask the user before you add one as a development dependency, because it downloads a browser. If the user does not want it, do the same steps with a browser MCP, or give the user the steps.

Copy `scripts/check-bundle.mjs` of this skill to the project, for example to `scripts/check-bundle.mjs`. Add a script to `package.json`, for example `"check:bundle": "node scripts/check-bundle.mjs"`. Then change the script for the project:

- Change the paths and the names of the exports.
- For a multi-root editor, set `isMultiRoot` to `true`. Then each sample is a JSON file with one entry for each root. Remove the part of the script that the editor does not use.
- Keep the list of plugins that Cloud Services removes, unless the `GET /editors/{bundle_version}/config` request for an uploaded bundle shows another list.
- The script starts the editor in the same way as Cloud Services. If the installed CKEditor 5 version does not accept this `CKEditorCS.create()` call, read the docs of the version and change the call.

The comments in the script explain the `--write` mode, the license key, and the markers of comments and suggestions. `troubleshooting.md` has the errors of the check.

## Take the output from the application

Open the application's page with the editor, for example the development server, with a browser MCP or with Playwright. Get the editor instance from its editable element, give it the samples, and read the output:

```js
// Takes the editor output for the samples from the running application.
await page.goto( 'http://localhost:5173/' );
await page.waitForSelector( '.ck-editor__editable' );

const output = await page.evaluate( samples => {
	const editor = document.querySelector( '.ck-editor__editable' ).ckeditorInstance;

	editor.setData( samples );

	return editor.getData( { trim: 'none' } );
}, samples );
```

For a multi-root editor, give `setData()` an object with one entry for each root, and read `JSON.stringify( editor.getFullData( { trim: 'none' } ) )`. You can also run the same calls in the developer tools of the browser, as the test data guide of Cloud Services shows.

Do this on a development setup. `setData()` starts the application's save logic, for example the autosave callback. Do not do it in a real-time collaboration session that other users have open, because the new content goes to all of them.

## What the check does not test

- The second editor that Cloud Services builds from the operations of the first one. In rare cases, a problem shows only in the upload.
- A plugin that changes the content only when the editor loads it, for example a post-fixer that changes straight quotes to typographic quotes. The test data already has the result, so the check and the upload pass also without the plugin. To find this problem, load the samples in the bundle, and compare the output with the test data from the application.

The upload is the final check. Offer an upload with the test data when the user has the credentials of a Cloud Services environment. A failed upload stores nothing, and a successful upload stores the bundle version for good. Read `upload.md` for the upload script and for the rules of an upload.
