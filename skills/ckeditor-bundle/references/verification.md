# Verifying the bundle

Verify the result in this order. Each step needs the previous one.

1. **The application.** Build it, and run its type check and tests. The editor of the application must start as before, with the same plugins, the same toolbar, and the same output of `getData()`. If a browser MCP (for example, Playwright or Chrome DevTools) is available, open the page and read the console.
2. **The bundle build.** Run the bundle script, for example `npm run build:bundle`. It must write one JavaScript file without top-level `import` or `export` statements.
3. **The shared module.** Load it in Node.js, for example with `node -e "import( './src/editor/config.js' )"`. It must load without errors.
4. **The check of the bundle.** Run the script below. It loads the bundle as Cloud Services does and compares the editor output with the test data.

## The check script

The script needs a headless browser. It uses Playwright. If the project does not have Playwright or Puppeteer, ask the user before you add one as a development dependency, because it downloads a browser. If the user does not want it, do the same steps with a browser MCP, or give the user the steps.

Add the script to the project, for example as `scripts/check-bundle.mjs`, and add a script to `package.json`, for example `"check:bundle": "node scripts/check-bundle.mjs"`. Change the paths and the names of the exports for the project. Remove the multi-root part for a single-root editor, or the single-root part for a multi-root editor. Keep the list of the plugins that Cloud Services removes, unless the `GET /editors/{bundle_version}/config` request for an uploaded bundle shows another list.

```js
// Loads the editor bundle as Cloud Services does: as a classic script, with the shared configuration and the test data.
// Then it compares the editor output with the test data.
//
// Usage:
//   node scripts/check-bundle.mjs           Checks test-data/document.html.
//   node scripts/check-bundle.mjs --write   Makes test-data/document.html from the files in test-data/samples/.
//
// If the editor uses premium features, set a license key for self-hosted installations in the
// CKEDITOR_CHECK_LICENSE_KEY environment variable. The check runs the npm build, so a key for the CDN does not work.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

import { editorConfig, pluginsRemovedOnServer } from '../src/editor/config.js';

// The plugins that Cloud Services removes itself. They need a connection to a server, so the check cannot run them
// either. The list depends on the version of Cloud Services, for example of an on-premises installation. The
// `GET /editors/{bundle_version}/config` request shows the full list for an uploaded bundle.
const pluginsRemovedByCloudServices = [
	'Autosave',
	'PresenceList',
	'RealTimeCollaborativeComments',
	'RealTimeCollaborativeEditing',
	'RealTimeCollaborativeRevisionHistory',
	'RealTimeCollaborativeTrackChanges',
	'RevisionHistory'
];

// The comment and suggestion markers in the format that the editor writes. Cloud Services accepts them in `test_data`,
// but this check has no comment and suggestion data, so it removes the markers first.
const MARKER_ELEMENTS = /<(comment|suggestion)-(start|end)\b[^>]*><\/\1-\2>/g;
const MARKER_ATTRIBUTES = / data-(comment|suggestion)-(start|end)-(before|after)="[^"]*"/g;

// For a multi-root editor, the test data is JSON with one entry for each root.
const isMultiRoot = false;

const root = new URL( '../', import.meta.url );
const bundle = await readFile( new URL( 'dist-bundle/editor.bundle.js', root ), 'utf8' );
const pageErrors = [];
const browser = await chromium.launch();

try {
	const page = await browser.newPage();

	// The errors of the page, for example a license error that comes after the editor starts.
	page.on( 'pageerror', error => pageErrors.push( error.message ) );

	// A page with a real origin, because some plugins use browser storage. All other requests fail, because
	// Cloud Services blocks the network requests of the editor too.
	await page.route( '**/*', route => {
		if ( route.request().url() !== 'https://bundle-check.test/' ) {
			return route.abort();
		}

		return route.fulfill( {
			contentType: 'text/html',
			body: '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>'
		} );
	} );

	// `page.route()` does not stop WebSocket connections. Playwright 1.48 and later can close them too.
	await page.routeWebSocket?.( /.*/, webSocket => webSocket.close() );
	await page.goto( 'https://bundle-check.test/' );
	await page.addScriptTag( { content: bundle } );

	const isEditorClass = await page.evaluate( () => typeof window.CKEditorCS?.create === 'function' );

	if ( !isEditorClass ) {
		// A bundle that stops while it loads, for example with `process is not defined`, does not set the global either.
		throw new Error( [ 'The bundle does not set the CKEditorCS global to the editor class.', ...pageErrors ].join( ' ' ) );
	}

	if ( process.argv.includes( '--write' ) ) {
		// With all plugins of the application, as the browser runs them. The plugins that need the network or the
		// application server can fail here, so the errors of the page are only warnings. The markers are removed, so
		// take test data with markers from the application.
		const output = await getOutput( page, removeMarkers( await readSamples() ), pluginsRemovedByCloudServices, {
			allowPageErrors: true
		} );

		await writeFile( new URL( 'test-data/document.html', root ), output );
		console.log( 'Wrote test-data/document.html. Compare it with the samples.' );
	} else {
		// Without the plugins that Cloud Services removes, as Cloud Services runs them.
		const rawTestData = ( await readFile( new URL( 'test-data/document.html', root ), 'utf8' ) ).trimEnd();

		// Cloud Services compares multi-root test data as a string. Thus formatted JSON fails the upload.
		if ( isMultiRoot && JSON.stringify( JSON.parse( rawTestData ) ) !== rawTestData ) {
			throw new Error( 'The test data is not the output of JSON.stringify(), so the upload fails. Make it with JSON.stringify().' );
		}

		const testData = removeMarkers( rawTestData );
		const output = await getOutput( page, testData, [ ...pluginsRemovedByCloudServices, ...pluginsRemovedOnServer ] );

		if ( output === testData ) {
			console.log( 'The editor does not change the test data.' );
		} else {
			let index = 0;

			while ( testData[ index ] === output[ index ] ) {
				index++;
			}

			const start = Math.max( 0, index - 40 );

			console.error( `The editor changes the test data at character ${ index }:` );
			console.error( `  test data: ${ testData.slice( start, index + 80 ) }` );
			console.error( `  output:    ${ output.slice( start, index + 80 ) }` );
			process.exitCode = 1;
		}
	}
} finally {
	await browser.close();
}

// The samples, joined into one document.
async function readSamples() {
	const folder = new URL( 'test-data/samples/', root );
	const files = ( await readdir( folder ) ).filter( name => name.endsWith( '.html' ) ).sort();
	const samples = await Promise.all( files.map( name => readFile( new URL( name, folder ), 'utf8' ) ) );

	return samples.map( sample => sample.trim() ).join( '' );
}

// Removes the comment and suggestion markers from the HTML, or from each root of multi-root JSON.
function removeMarkers( data ) {
	const removeFromHtml = html => html.replace( MARKER_ELEMENTS, '' ).replace( MARKER_ATTRIBUTES, '' );

	if ( !isMultiRoot ) {
		return removeFromHtml( data );
	}

	return JSON.stringify( Object.fromEntries( Object.entries( JSON.parse( data ) ).map( ( [ rootName, html ] ) => {
		return [ rootName, removeFromHtml( html ) ];
	} ) ) );
}

// Starts the editor as Cloud Services does: `CKEditorCS.create()` with an element (or an object of root elements) as
// the first argument, the configuration with the data, and `getData( { trim: 'none' } )` for the output. Newer versions
// of CKEditor 5 mark this form of `create()` as deprecated, but Cloud Services uses it.
async function getOutput( page, data, removePlugins, { allowPageErrors = false } = {} ) {
	pageErrors.length = 0;

	const result = await page.evaluate( async options => {
		const config = {
			...options.config,
			licenseKey: options.licenseKey,
			removePlugins: options.removePlugins
		};
		let editor;
		let output;

		try {
			if ( options.isMultiRoot ) {
				const roots = {};

				for ( const [ rootName, rootData ] of Object.entries( JSON.parse( options.data ) ) ) {
					roots[ rootName ] = document.body.appendChild( document.createElement( 'div' ) );
					roots[ rootName ].innerHTML = rootData;
				}

				editor = await window.CKEditorCS.create( roots, config );
				output = JSON.stringify( Object.fromEntries( Object.keys( roots ).map( rootName => {
					return [ rootName, editor.getData( { rootName, trim: 'none' } ) ];
				} ) ) );
			} else {
				const element = document.body.appendChild( document.createElement( 'div' ) );

				editor = await window.CKEditorCS.create( element, { ...config, initialData: options.data } );
				output = editor.getData( { trim: 'none' } );
			}

			// Some errors, for example license errors, come shortly after the editor starts. They make the editor read-only.
			await new Promise( resolve => setTimeout( resolve, 1500 ) );

			if ( editor.isReadOnly ) {
				return { error: 'The editor is read-only. Read the errors of the page, for example a license error.' };
			}

			return { output };
		} catch ( error ) {
			return { error: String( error?.message ?? error ) };
		} finally {
			await editor?.destroy();
			document.body.replaceChildren();
		}
	}, {
		// The configuration travels as data, so functions and DOM elements in it stop the check, as they stop the upload.
		config: editorConfig,
		data,
		isMultiRoot,
		licenseKey: process.env.CKEDITOR_CHECK_LICENSE_KEY || 'GPL',
		removePlugins: [ ...( editorConfig.removePlugins ?? [] ), ...removePlugins ]
	} );

	if ( result.error || ( pageErrors.length && !allowPageErrors ) ) {
		throw new Error( `The editor did not start: ${ [ result.error, ...pageErrors ].filter( Boolean ).join( ' ' ) }` );
	}

	if ( pageErrors.length ) {
		console.warn( `Errors of the page: ${ pageErrors.join( ' ' ) }` );
	}

	return result.output;
}
```

Notes about the script:

- It starts the editor in the same way as Cloud Services: `CKEditorCS.create()` with an element (or an object of root elements) and the configuration. If the installed CKEditor 5 version does not accept this call, read the docs of the version and change the call.
- `--write` uses all plugins except the ones that need a server, with the shared configuration only. It cannot find a content option that is only in the runtime configuration, because the bundle does not get it either. Use it only when the editor of the application cannot start without a server. Take the test data from the application in all other cases (see below).
- The check removes the comment and suggestion markers before it compares, because it has no data of the comments. The upload sends the test data with the markers, and Cloud Services accepts them. The `--write` mode also removes the markers, so take test data with markers from the application.
- The license key is only for the check. Do not put it in the shared configuration. It must be a key for self-hosted installations. Cloud Services uses its own key.
- The check stops all network requests of the page, as Cloud Services does. With Playwright 1.48 or later, it also closes WebSocket connections. A plugin that needs the network shows its error in the check.
- For multi-root samples, use JSON files and join the roots in the same way.

When the check fails:

- The check without `--write` also removes the plugins that Cloud Services must not run. If the output is different from test data of the full editor, a removed plugin changes the data. Read the "Confirm each decision" section of `plugin-classification.md`. If the output is different from test data of the application, a content option is missing in the shared configuration.
- If the check stops with `plugincollection-required`, a plugin of the bundle requires a removed plugin. If `requiredBy` is an official plugin, add it to `pluginsRemovedByCloudServices`, because Cloud Services removes it too (see `troubleshooting.md`). If it is a custom plugin, read the class 2 and class 3 sections of `plugin-classification.md`.

## Take the output from the application

The test data is best when it comes from the editor of the application, with its full runtime configuration. Then the check compares the application with the bundle, and it finds every content option that the shared configuration misses.

Open the page of the application with the editor, for example the development server, with a browser MCP or with Playwright. Get the editor instance from its editable element, give it the samples, and read the output:

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

Do this on a development setup. `setData()` starts the save logic of the application, for example the autosave callback. Do not do it in a real-time collaboration session that other users have open, because the new content goes to all of them.

## What the check does not test

- The second editor that Cloud Services builds from the operations of the first one. In rare cases, a problem shows only in the upload.
- The DOM and the network rules of the server. The page of the check has no access to the application, and it stops all network requests.
- The real list of plugins that Cloud Services removes, and the rules of its version.
- The plugins that Cloud Services removes because they require a removed plugin. Cloud Services removes them without an error, but the check stops with `plugincollection-required` (see `plugin-classification.md`).
- A plugin that changes the content only when the editor loads it, for example a post-fixer that changes straight quotes to typographic quotes. The test data already has the result, so the check and the upload pass also without the plugin. To find this problem, load the samples in the bundle, and compare the output with the test data from the application.

The upload is the final check. If the user has the credentials of a Cloud Services environment, offer an upload with the test data. A failed upload stores nothing, and a successful upload stores the bundle version for good.
