/**
 * @license Copyright (c) 2026-2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import { readdirSync, readFileSync } from 'node:fs';
import upath from 'upath';
import { describe, expect, it } from 'vitest';

// Every documentation request made by the skills carries these parameters, so that the requests
// can be counted in the docs access logs. See https://github.com/ckeditor/skills/issues/36.
const TRACKING_PARAMETERS = {
	utm_source: 'ckeditor-skill',
	utm_medium: 'ai-agent'
};

// A docs URL runs until whitespace or until the character that closes an autolink (`>`),
// an inline link (`)`), or a code span (`` ` ``). The skills do not use bare URLs.
const DOCS_URL_PATTERN = /https?:\/\/ckeditor\.com\/docs[^\s>)`]*/g;

const skillFiles = readdirSync( 'skills', { recursive: true, withFileTypes: true } )
	.filter( entry => entry.isFile() && entry.name.endsWith( '.md' ) )
	.map( entry => upath.join( entry.parentPath, entry.name ) )
	.sort();

/**
 * Returns one line per documentation URL that is not tagged correctly, for example:
 * "https://ckeditor.com/docs/…/editor-types.html: missing utm_source=ckeditor-skill (skills/ckeditor/SKILL.md:122)".
 */
function findProblems( file ) {
	const content = readFileSync( file, 'utf8' );
	const problems = [];

	for ( const match of content.matchAll( DOCS_URL_PATTERN ) ) {
		const url = match[ 0 ];
		const line = content.slice( 0, match.index ).split( '\n' ).length;
		const problem = describeProblem( url );

		if ( problem ) {
			problems.push( `${ url }: ${ problem } (${ file }:${ line })` );
		}
	}

	return problems;
}

function describeProblem( url ) {
	const hashIndex = url.indexOf( '#' );
	const queryIndex = url.indexOf( '?' );

	if ( hashIndex !== -1 && queryIndex > hashIndex ) {
		return 'the query string must come before the # fragment';
	}

	const { searchParams } = new URL( url );

	for ( const [ name, value ] of Object.entries( TRACKING_PARAMETERS ) ) {
		if ( !searchParams.has( name ) ) {
			return `missing ${ name }=${ value }`;
		}

		if ( searchParams.get( name ) !== value ) {
			return `${ name } is "${ searchParams.get( name ) }", expected "${ value }"`;
		}
	}

	return null;
}

describe( 'skills: documentation URLs', () => {
	it( 'should find documentation URLs in the skills', () => {
		const urls = skillFiles.flatMap( file => readFileSync( file, 'utf8' ).match( DOCS_URL_PATTERN ) || [] );

		expect( urls.length ).toBeGreaterThan( 0 );
	} );

	for ( const file of skillFiles ) {
		it( `should tag every documentation URL in ${ file }`, () => {
			expect( findProblems( file ) ).toEqual( [] );
		} );
	}
} );
