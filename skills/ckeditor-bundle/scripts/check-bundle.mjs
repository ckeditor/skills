// Loads the editor bundle as Cloud Services does: as a classic script, with the shared configuration and the test data.
// Then it compares the editor output with the test data.
//
// Usage:
//   node scripts/check-bundle.mjs           Checks the test data: test-data/document.html, or .json for a multi-root editor.
//   node scripts/check-bundle.mjs --write   Makes the test data from the files in test-data/samples/.
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

// For a multi-root editor, the samples and the test data are JSON with one entry for each root.
const isMultiRoot = false;
const testDataFile = isMultiRoot ? 'test-data/document.json' : 'test-data/document.html';

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

		await writeFile( new URL( testDataFile, root ), output );
		console.log( `Wrote ${ testDataFile }. Compare it with the samples.` );
	} else {
		// Without the plugins that Cloud Services removes, as Cloud Services runs them.
		const rawTestData = ( await readFile( new URL( testDataFile, root ), 'utf8' ) ).trimEnd();

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

// The samples, joined into one document. For a multi-root editor, each sample is a JSON file with the content of each
// root, and the content of each root is joined.
async function readSamples() {
	const folder = new URL( 'test-data/samples/', root );
	const extension = isMultiRoot ? '.json' : '.html';
	const files = ( await readdir( folder ) ).filter( name => name.endsWith( extension ) ).sort();
	const samples = await Promise.all( files.map( name => readFile( new URL( name, folder ), 'utf8' ) ) );

	if ( !isMultiRoot ) {
		return samples.map( sample => sample.trim() ).join( '' );
	}

	const roots = {};

	for ( const sample of samples ) {
		for ( const [ rootName, html ] of Object.entries( JSON.parse( sample ) ) ) {
			roots[ rootName ] = ( roots[ rootName ] ?? '' ) + html.trim();
		}
	}

	return JSON.stringify( roots );
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
