/**
 * @license Copyright (c) 2026-2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import upath from 'upath';
import { afterAll, describe, expect, it } from 'vitest';
import { ROOT_DIRECTORY, SKILLS_DIRECTORY } from '../../scripts/constants.js';

// The skills contain JavaScript code that agents copy into projects, for example the check script of the
// `ckeditor-bundle` skill. No other job runs this code, so this test makes sure that each `js` block has valid syntax.

// A `js` block, also an indented one in a list. The closing fence has the same indentation as the opening fence.
const JS_BLOCK_PATTERN = /^([ \t]*)```js\n([\s\S]*?)^\1```$/gm;

const skillFiles = readdirSync( upath.join( ROOT_DIRECTORY, SKILLS_DIRECTORY ), { recursive: true, withFileTypes: true } )
	.filter( entry => entry.isFile() && entry.name.endsWith( '.md' ) )
	.map( entry => upath.relative( ROOT_DIRECTORY, upath.join( entry.parentPath, entry.name ) ) )
	.sort();

const codeBlocks = skillFiles.flatMap( file => {
	const content = readFileSync( upath.join( ROOT_DIRECTORY, file ), 'utf8' );

	return [ ...content.matchAll( JS_BLOCK_PATTERN ) ].map( match => ( {
		location: `${ file }:${ content.slice( 0, match.index ).split( '\n' ).length }`,
		code: match[ 2 ]
	} ) );
} );

const temporaryDirectory = mkdtempSync( upath.join( tmpdir(), 'skills-code-blocks-' ) );

afterAll( () => {
	rmSync( temporaryDirectory, { recursive: true, force: true } );
} );

describe( 'skills: JavaScript code blocks', () => {
	it( 'should find JavaScript code blocks in the skills', () => {
		expect( codeBlocks.length ).toBeGreaterThan( 0 );
	} );

	for ( const [ index, { location, code } ] of codeBlocks.entries() ) {
		it( `should have valid syntax in the code block at ${ location }`, () => {
			// With the `.mjs` extension, Node.js reads the code as an ES module, so `import` and top-level `await` are valid.
			const file = upath.join( temporaryDirectory, `${ index }.mjs` );

			writeFileSync( file, code );

			const { status, stderr } = spawnSync( process.execPath, [ '--check', file ], { encoding: 'utf8' } );

			expect( status, stderr ).toBe( 0 );
		} );
	}
} );
