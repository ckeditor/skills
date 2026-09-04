/**
 * @license Copyright (c) 2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import upath from 'upath';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCommand } from '../../../scripts/release/utils/command.js';

describe( 'scripts/release/utils/command', () => {
	let cwd;

	beforeEach( async () => {
		cwd = await fs.mkdtemp( upath.join( os.tmpdir(), 'ckeditor-skills-' ) );
	} );

	afterEach( async () => {
		await fs.rm( cwd, { recursive: true, force: true } );
	} );

	describe( 'runCommand()', () => {
		it( 'should return the standard output of the command', async () => {
			expect( await runCommand( 'git', [ '--version' ], { cwd } ) ).to.match( /^git version / );
		} );

		it( 'should throw with the standard error when the command fails', async () => {
			// The `C` locale keeps git from translating the message.
			const env = { ...process.env, LC_ALL: 'C' };

			await expect( runCommand( 'git', [ 'nonsense' ], { cwd, env } ) ).rejects.toThrow(
				`The "git" command failed in the "${ cwd }" directory: git: 'nonsense' is not a git command.`
			);
		} );

		it( 'should throw when the executable does not exist', async () => {
			await expect( runCommand( 'nonexistent-executable', [], { cwd } ) ).rejects.toThrow(
				`Could not run "nonexistent-executable" in the "${ cwd }" directory: ` +
				'the executable or the directory does not exist.'
			);
		} );

		it( 'should throw when the working directory does not exist', async () => {
			const directory = upath.join( cwd, 'missing' );

			await expect( runCommand( 'git', [ '--version' ], { cwd: directory } ) ).rejects.toThrow(
				`Could not run "git" in the "${ directory }" directory: the executable or the directory does not exist.`
			);
		} );
	} );
} );
