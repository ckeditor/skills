/**
 * @license Copyright (c) 2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import { runCommand } from './command.js';

/**
 * Runs `git ls-files` with the given arguments in a directory and returns the listed paths, relative to it.
 *
 * @param {string} directory An absolute path.
 * @param {Array.<string>} [args]
 * @returns {Promise.<Array.<string>>}
 */
export async function listGitFiles( directory, args = [] ) {
	// The `-z` flag separates the paths with NUL characters, so no path gets quoted or escaped.
	const stdout = await runCommand( 'git', [ 'ls-files', '-z', ...args ], { cwd: directory } );

	return stdout.split( '\0' ).filter( file => file !== '' );
}

/**
 * Returns paths (relative to the repository root) of the files with uncommitted changes, the untracked (but not
 * ignored) ones included.
 *
 * @param {object} options
 * @param {string} options.cwd Root of the repository.
 * @returns {Promise.<Array.<string>>}
 */
export async function findUncommittedFiles( { cwd } ) {
	// The `-z` flag separates the entries with NUL characters, so no path gets quoted or escaped. An entry consists
	// of a two-letter status, a space, and the path. A renamed or copied file is followed by its original path as
	// a separate entry. An untracked directory is a single entry with a trailing slash, whatever the user's
	// `status.showUntrackedFiles` setting.
	const stdout = await runCommand( 'git', [ 'status', '--porcelain', '--untracked-files=normal', '-z' ], { cwd } );
	const entries = stdout.split( '\0' ).filter( entry => entry !== '' );
	const files = [];

	for ( let index = 0; index < entries.length; index++ ) {
		const entry = entries[ index ];

		files.push( entry.slice( 3 ) );

		if ( /[RC]/.test( entry.slice( 0, 2 ) ) ) {
			index++;
		}
	}

	return files;
}
