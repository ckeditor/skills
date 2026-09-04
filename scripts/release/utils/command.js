/**
 * @license Copyright (c) 2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify( execFile );

/**
 * Runs a system command and returns its standard output.
 *
 * @param {string} command Name of the executable.
 * @param {Array.<string>} args Arguments to pass to the executable.
 * @param {object} options Options of `child_process.execFile()`, with `cwd` set and optionally `env`.
 * @returns {Promise.<string>}
 */
export async function runCommand( command, args, options ) {
	try {
		const { stdout } = await execFileAsync( command, args, options );

		return stdout;
	} catch ( error ) {
		// The same code reports a missing executable and a missing working directory.
		if ( error.code === 'ENOENT' ) {
			throw new Error(
				`Could not run "${ command }" in the "${ options.cwd }" directory: the executable or the directory does not exist.`
			);
		}

		throw new Error(
			`The "${ command }" command failed in the "${ options.cwd }" directory: ${ ( error.stderr || error.message ).trim() }`
		);
	}
}
