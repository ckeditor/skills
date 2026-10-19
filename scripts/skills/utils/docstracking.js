/**
 * @license Copyright (c) 2026-2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import fs from 'node:fs/promises';
import upath from 'upath';
import { DOCS_TRACKING_TEMPLATES_DIRECTORY, SKILL_FILE } from '../../constants.js';
import { assert, quote } from '../../release/utils/assert.js';
import { findSkills } from '../../release/utils/skills.js';

/**
 * The snippets that every skill includes. The skill file has the summary of the tracking rules, because the agent
 * always reads this file. The summary points at the reference file with the full rules. The content of a snippet
 * comes from its template, with the tracking query of the skill in place of the placeholder.
 */
export const SNIPPETS = [
	{
		name: 'summary',
		file: SKILL_FILE,
		template: upath.join( DOCS_TRACKING_TEMPLATES_DIRECTORY, 'docs-tracking-summary.md' )
	},
	{
		name: 'rules',
		file: 'references/documentation-access.md',
		template: upath.join( DOCS_TRACKING_TEMPLATES_DIRECTORY, 'docs-tracking-rules.md' )
	}
];

const QUERY_PLACEHOLDER = '{{query}}';

// A docs URL runs until whitespace or until a character that ends a URL in markdown or in code. These characters
// are `<` and `>` of an autolink, `(` and `)` of an inline link, `[` and `]` of a link text, `|` of a table cell,
// a backtick of a code span, and a quote of a string. A punctuation mark at the end belongs to the sentence.
export const DOCS_URL_PATTERN = /https?:\/\/ckeditor\.com\/docs(?:[^\s<>()[\]|`'"]*[^\s<>()[\]|`'".,:;!?*])?/g;

// Any other URL. It stays as it is, also when it has tracking parameters, as the skills tag only the docs requests.
const OTHER_URL_PATTERN = /https?:\/\/[^\s<>()[\]|`'"]+/;

// A query with the tracking parameters outside a URL, for example in a rule that tells the agent what to add.
const TRACKING_QUERY_PATTERN = /\?utm_\w+=[\w-]*(?:&utm_\w+=[\w-]*)*/;

// At each position, the expression tries the alternatives in this order. Thus it matches a URL as a whole, with
// its query.
const URL_OR_TRACKING_QUERY_PATTERN = new RegExp(
	`(${ DOCS_URL_PATTERN.source })|(${ OTHER_URL_PATTERN.source })|${ TRACKING_QUERY_PATTERN.source }`,
	'g'
);

// A snippet: the start marker line, the content, and the end marker line with the same name.
const SNIPPET_PATTERN = /^<!-- docs-tracking:([\w-]+) -->\n[\s\S]*?^<!-- \/docs-tracking:\1 -->$/gm;

// A marker in any spelling, to find the markers that are not a part of a snippet.
const MARKER_PATTERN = /<!--\s*\/?\s*docs-tracking/g;

/**
 * Returns the tracking parameters of the documentation requests that a skill makes. With them, the docs access logs
 * can count the requests. See https://github.com/ckeditor/skills/issues/36 and
 * https://github.com/ckeditor/skills/issues/48.
 *
 * @param {string} skillName
 * @returns {Object.<string, string>}
 */
export function getTrackingParameters( skillName ) {
	return {
		utm_source: 'ckeditor-skill',
		utm_medium: 'ai-agent',
		utm_content: skillName
	};
}

/**
 * Returns the content of a markdown file of a skill with the current tracking rules and parameters.
 *
 * @param {string} content
 * @param {object} options
 * @param {string} options.skillName
 * @param {Map.<string, string>} options.templates The template of every snippet, by the snippet name.
 * @param {string} options.file Path to the file, used in the error messages.
 * @returns {string}
 */
export function applyDocsTracking( content, { skillName, templates, file } ) {
	const trackingQuery = new URLSearchParams( getTrackingParameters( skillName ) ).toString();

	return renderSnippets( content, { templates, trackingQuery, file } )
		.replace( URL_OR_TRACKING_QUERY_PATTERN, ( _, docsUrl, otherUrl ) => {
			if ( docsUrl ) {
				return tagUrl( docsUrl, trackingQuery );
			}

			if ( otherUrl ) {
				return otherUrl;
			}

			return '?' + trackingQuery;
		} );
}

/**
 * Returns the markdown files of the skills that do not have the current tracking rules and parameters, with their
 * updated content. Throws when a skill does not include a snippet in its file, so that every skill tells the agent
 * how to tag the docs requests.
 *
 * @param {object} options
 * @param {string} options.cwd Root of the repository.
 * @returns {Promise.<Array.<{ file: string, content: string }>>} The paths are relative to `cwd`.
 */
export async function findDocsTrackingUpdates( { cwd } ) {
	const templates = await loadTemplates( { cwd } );
	const updates = [];
	const missingSnippets = [];

	for ( const skill of await findSkills( { cwd } ) ) {
		const contents = new Map();

		for ( const file of await findMarkdownFiles( { cwd, directory: skill.directory } ) ) {
			const content = await fs.readFile( upath.join( cwd, file ), 'utf-8' );
			const updatedContent = applyDocsTracking( content, { skillName: skill.name, templates, file } );

			contents.set( file, content );

			if ( updatedContent !== content ) {
				updates.push( { file, content: updatedContent } );
			}
		}

		for ( const snippet of SNIPPETS ) {
			const file = upath.join( skill.directory, snippet.file );
			const lines = contents.get( file )?.split( '\n' ) ?? [];

			if ( !lines.includes( getStartMarker( snippet.name ) ) ) {
				missingSnippets.push( `* ${ file }: "${ snippet.name }"` );
			}
		}
	}

	assert(
		!missingSnippets.length,
		'Expected every skill to include the docs tracking snippets, but these are missing:\n' +
		missingSnippets.join( '\n' ) + '\n' +
		`Add the "${ getStartMarker( 'NAME' ) }" and "${ getEndMarker( 'NAME' ) }" lines to each file. ` +
		'Then run "pnpm skills:update-docs-tracking".'
	);

	return updates;
}

/**
 * Replaces the content of every snippet with its template.
 *
 * @param {string} content
 * @param {object} options
 * @param {Map.<string, string>} options.templates
 * @param {string} options.trackingQuery
 * @param {string} options.file Path to the file, used in the error messages.
 * @returns {string}
 */
function renderSnippets( content, { templates, trackingQuery, file } ) {
	let snippetCount = 0;

	const renderedContent = content.replace( SNIPPET_PATTERN, ( _, name ) => {
		assert(
			templates.has( name ),
			`The "${ file }" file includes an unknown "${ name }" docs tracking snippet. ` +
			`The known snippets are ${ quote( [ ...templates.keys() ] ) }.`
		);

		snippetCount++;

		return [
			getStartMarker( name ),
			templates.get( name ).trim().replaceAll( QUERY_PLACEHOLDER, trackingQuery ),
			getEndMarker( name )
		].join( '\n' );
	} );

	// Each snippet has two markers, so a different number of markers means that a marker has no pair or a typo.
	assert(
		( content.match( MARKER_PATTERN )?.length ?? 0 ) === snippetCount * 2,
		`The "${ file }" file has a docs tracking marker without a pair. A snippet starts with ` +
		`a "${ getStartMarker( 'NAME' ) }" line and ends with a "${ getEndMarker( 'NAME' ) }" line.`
	);

	return renderedContent;
}

/**
 * Returns the URL with the tracking query in place of its tracking parameters. The other query parameters stay,
 * and the query comes before the fragment.
 *
 * @param {string} url
 * @param {string} trackingQuery
 * @returns {string}
 */
function tagUrl( url, trackingQuery ) {
	// No docs anchor has a question mark, so a query after the fragment is in the wrong place. The query moves before
	// the fragment.
	const [ , base, query, fragment = '', misplacedQuery ] = url.match( /^([^?#]*)(?:\?([^#]*))?(#[^?]*)?(?:\?(.*))?$/ );
	const otherParameters = [ query, misplacedQuery ]
		.filter( part => part !== undefined )
		.flatMap( part => part.split( '&' ) )
		.filter( parameter => parameter !== '' && !parameter.startsWith( 'utm_' ) );

	return `${ base }?${ [ ...otherParameters, trackingQuery ].join( '&' ) }${ fragment }`;
}

/**
 * Returns the template of every snippet, by the snippet name.
 *
 * @param {object} options
 * @param {string} options.cwd Root of the repository.
 * @returns {Promise.<Map.<string, string>>}
 */
async function loadTemplates( { cwd } ) {
	const templates = new Map();

	for ( const { name, template } of SNIPPETS ) {
		const content = await fs.readFile( upath.join( cwd, template ), 'utf-8' );

		// Only the tracking query is different in each skill, so a different placeholder is a typo.
		assert(
			!content.replaceAll( QUERY_PLACEHOLDER, '' ).includes( '{{' ),
			`The "${ template }" template has an unknown placeholder. The only placeholder is "${ QUERY_PLACEHOLDER }".`
		);

		templates.set( name, content );
	}

	return templates;
}

/**
 * @param {object} options
 * @param {string} options.cwd Root of the repository.
 * @param {string} options.directory Path to a skill directory, relative to `cwd`.
 * @returns {Promise.<Array.<string>>} Sorted paths (relative to `cwd`) to the markdown files in the directory.
 */
async function findMarkdownFiles( { cwd, directory } ) {
	const entries = await fs.readdir( upath.join( cwd, directory ), { recursive: true, withFileTypes: true } );

	return entries
		.filter( entry => entry.isFile() && entry.name.endsWith( '.md' ) )
		.map( entry => upath.relative( cwd, upath.join( entry.parentPath, entry.name ) ) )
		.sort();
}

/**
 * @param {string} name
 * @returns {string}
 */
function getStartMarker( name ) {
	return `<!-- docs-tracking:${ name } -->`;
}

/**
 * @param {string} name
 * @returns {string}
 */
function getEndMarker( name ) {
	return `<!-- /docs-tracking:${ name } -->`;
}
