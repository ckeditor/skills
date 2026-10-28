/**
 * @license Copyright (c) 2026-2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import upath from 'upath';
import { describe, expect, it } from 'vitest';
import { ROOT_DIRECTORY, SKILLS_DIRECTORY } from '../../scripts/constants.js';

// The skills contain script files that agents copy into projects, for example the check script of the `ckeditor-bundle`
// skill. No other job runs these scripts, so this test makes sure that each script has valid syntax. The scripts import
// the modules of the project, so the test does not run them.

const scriptFiles = readdirSync( upath.join( ROOT_DIRECTORY, SKILLS_DIRECTORY ), { recursive: true, withFileTypes: true } )
	.filter( entry => entry.isFile() && /\.[cm]?js$/.test( entry.name ) )
	.map( entry => upath.relative( ROOT_DIRECTORY, upath.join( entry.parentPath, entry.name ) ) )
	.sort();

describe( 'skills: script files', () => {
	it( 'should find script files in the skills', () => {
		expect( scriptFiles.length ).toBeGreaterThan( 0 );
	} );

	for ( const file of scriptFiles ) {
		it( `should have valid syntax in ${ file }`, () => {
			const { status, stderr } = spawnSync( process.execPath, [ '--check', upath.join( ROOT_DIRECTORY, file ) ], {
				encoding: 'utf8'
			} );

			expect( status, stderr ).toBe( 0 );
		} );
	}
} );
