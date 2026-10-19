/**
 * @license Copyright (c) 2026-2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import { readdirSync, readFileSync } from 'node:fs';
import upath from 'upath';
import { describe, expect, it } from 'vitest';
import { DOCS_TRACKING_TEMPLATES_DIRECTORY, ROOT_DIRECTORY, SKILLS_DIRECTORY } from '../../scripts/constants.js';
import { assert } from '../../scripts/release/utils/assert.js';
import {
	DOCS_URL_PATTERN,
	findDocsTrackingUpdates,
	getTrackingParameters
} from '../../scripts/skills/utils/docstracking.js';

// Every documentation request that a skill makes carries the tracking parameters of the skill,
// so that the docs access logs can count the requests.
// See https://github.com/ckeditor/skills/issues/36 and https://github.com/ckeditor/skills/issues/48.

const skillFiles = readdirSync( upath.join( ROOT_DIRECTORY, SKILLS_DIRECTORY ), { recursive: true, withFileTypes: true } )
	.filter( entry => entry.isFile() && entry.name.endsWith( '.md' ) )
	.map( entry => upath.relative( ROOT_DIRECTORY, upath.join( entry.parentPath, entry.name ) ) )
	.filter( file => upath.dirname( file ) !== SKILLS_DIRECTORY )
	.sort();

/**
 * Returns one line per documentation URL that is not tagged correctly, for example:
 * "https://ckeditor.com/docs/…/editor-types.html: missing utm_content=ckeditor (skills/ckeditor/SKILL.md:122)".
 */
function findProblems( file ) {
	const content = readFileSync( upath.join( ROOT_DIRECTORY, file ), 'utf8' );
	const skillName = getSkillName( file );
	const problems = [];

	for ( const match of content.matchAll( DOCS_URL_PATTERN ) ) {
		const url = match[ 0 ];
		const line = content.slice( 0, match.index ).split( '\n' ).length;
		const problem = describeProblem( url, skillName );

		if ( problem ) {
			problems.push( `${ url }: ${ problem } (${ file }:${ line })` );
		}
	}

	return problems;
}

/**
 * Returns the name of the skill that a file belongs to: the name of the skill directory that holds the file. This
 * directory must be in the skills directory. For example, "skills/ckeditor-update/references/guide.md" belongs to
 * the "ckeditor-update" skill.
 */
function getSkillName( file ) {
	const [ directory, skillName, ...pathInSkill ] = file.split( '/' );

	assert(
		directory === SKILLS_DIRECTORY && pathInSkill.length > 0,
		`Expected the "${ file }" file to be in a skill directory inside the "${ SKILLS_DIRECTORY }" directory.`
	);

	return skillName;
}

function describeProblem( url, skillName ) {
	const hashIndex = url.indexOf( '#' );

	if ( hashIndex !== -1 && url.includes( '?', hashIndex ) ) {
		return 'the query string must come before the # fragment';
	}

	const { searchParams } = new URL( url );
	const trackingParameters = getTrackingParameters( skillName );

	for ( const [ name, value ] of Object.entries( trackingParameters ) ) {
		const values = searchParams.getAll( name );

		if ( !values.length ) {
			return `missing ${ name }=${ value }`;
		}

		if ( values.length > 1 ) {
			return `${ name } occurs ${ values.length } times, expected once`;
		}

		if ( values[ 0 ] !== value ) {
			return `${ name } is "${ values[ 0 ] }", expected "${ value }"`;
		}
	}

	// All `utm_*` parameters of a docs URL come from the skill, so a different one is a tag that is out of date.
	const unexpectedName = [ ...searchParams.keys() ]
		.find( name => name.startsWith( 'utm_' ) && !Object.hasOwn( trackingParameters, name ) );

	if ( unexpectedName ) {
		return `unexpected ${ unexpectedName }=${ searchParams.get( unexpectedName ) }`;
	}

	return null;
}

describe( 'skills: documentation URLs', () => {
	it( 'should find documentation URLs in the skills', () => {
		const urls = skillFiles.flatMap( file => readFileSync( upath.join( ROOT_DIRECTORY, file ), 'utf8' ).match( DOCS_URL_PATTERN ) || [] );

		expect( urls.length ).toBeGreaterThan( 0 );
	} );

	for ( const file of skillFiles ) {
		it( `should tag every documentation URL in ${ file }`, () => {
			expect( findProblems( file ), 'Run "pnpm skills:update-docs-tracking" to tag the URLs.' ).toEqual( [] );
		} );
	}

	it( 'should have the current docs tracking rules and parameters in every skill', async () => {
		const updates = await findDocsTrackingUpdates( { cwd: ROOT_DIRECTORY } );

		expect(
			updates.map( ( { file } ) => file ),
			'These files do not have the current docs tracking rules and parameters. The rules come from the templates in ' +
			`"${ DOCS_TRACKING_TEMPLATES_DIRECTORY }/". To change the rules, edit the templates, not the skills. ` +
			'Then run "pnpm skills:update-docs-tracking".'
		).toEqual( [] );
	} );
} );
