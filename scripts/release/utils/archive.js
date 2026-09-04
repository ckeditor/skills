/**
 * @license Copyright (c) 2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import { isDeepStrictEqual } from 'node:util';
import fs from 'node:fs/promises';
import upath from 'upath';
import { assert, quote } from './assert.js';
import { runCommand } from './command.js';
import { listGitFiles } from './git.js';
import { SKILL_FILE } from './skills.js';

/**
 * Creates a `.tar.gz` archive with the git-tracked files of the skill directory at the archive root, as the
 * discovery specification requires. The archives are installed on end-user machines, so the set of files must
 * match git: an untracked or deleted file fails the build. The contents come from the working tree, as the release
 * flow bumps the version in `SKILL.md` before archiving and commits afterwards.
 *
 * The archive is created by the system `tar`, as both GNU tar and bsdtar understand the arguments used below.
 * Note that the archive name must stay relative, with `cwd` pointing at the output directory: GNU tar treats
 * the drive colon of an absolute Windows path passed to `-f` as a remote host name, while the `--force-local`
 * cure is not understood by bsdtar.
 *
 * @param {object} options
 * @param {string} options.cwd Root of the repository.
 * @param {string} options.skillDirectory Path to the skill directory, relative to `cwd`.
 * @param {string} options.artifactsDirectory Absolute path to the directory to create the archive in.
 * @param {string} options.archiveFileName Name of the archive to create.
 * @returns {Promise.<void>}
 */
export async function createArchive( { cwd, skillDirectory, artifactsDirectory, archiveFileName } ) {
	const skillPath = upath.join( cwd, skillDirectory );
	const entries = await findArchiveEntries( { skillPath, skillDirectory } );

	// The `--` guard keeps a file name starting with a dash from being read as an option, `--numeric-owner` keeps the
	// user and group names of the releasing machine out of the headers, and the COPYFILE_DISABLE variable keeps macOS
	// from adding AppleDouble (`._*`) entries for extended attributes.
	await runCommand( 'tar', [ '--format=ustar', '--numeric-owner', '-czf', archiveFileName, '-C', skillPath, '--', ...entries ], {
		cwd: artifactsDirectory,
		env: { ...process.env, COPYFILE_DISABLE: '1' }
	} );

	// bsdtar skips an entry it cannot store (a path too long for the `ustar` header, for one) and still exits
	// successfully, so the result is checked, not trusted.
	const archivedEntries = ( await runCommand( 'tar', [ '-tzf', archiveFileName ], { cwd: artifactsDirectory } ) )
		.split( /\r?\n/ )
		.filter( entry => entry !== '' )
		.sort();

	assert(
		isDeepStrictEqual( archivedEntries, entries ),
		`Expected the "${ archiveFileName }" archive to contain ${ quote( entries ) }, found ${ quote( archivedEntries ) }.`
	);
}

/**
 * Returns the git-tracked files of a skill directory as sorted paths relative to it.
 *
 * @param {object} options
 * @param {string} options.skillPath Absolute path to the skill directory.
 * @param {string} options.skillDirectory The same path relative to the repository root, used in the error messages.
 * @returns {Promise.<Array.<string>>}
 */
async function findArchiveEntries( { skillPath, skillDirectory } ) {
	// A file that is neither tracked nor ignored is either a leftover that must not be published or a legitimate
	// addition that must be committed first, and a tracked file missing from disk means the working tree is out
	// of sync with git.
	const outOfSyncFiles = await listGitFiles( skillPath, [ '--others', '--deleted', '--exclude-standard' ] );

	assert(
		!outOfSyncFiles.length,
		`The "${ skillDirectory }" directory does not match git: ${ quote( outOfSyncFiles.sort() ) }. ` +
		'Commit, restore, or remove these files.'
	);

	// Sorted for a stable archive layout.
	const trackedFiles = ( await listGitFiles( skillPath ) ).sort();

	assert(
		trackedFiles.length > 0,
		`The "${ skillDirectory }" directory does not have any git-tracked file. Add the skill files to git.`
	);

	// Unlike the file systems of Windows and macOS, git preserves the letter case, so this also catches a `skill.md`
	// that passed for the skill file when the skills were found.
	assert(
		trackedFiles.includes( SKILL_FILE ),
		`Expected git to track a "${ SKILL_FILE }" file (with this exact letter case) in the "${ skillDirectory }" directory.`
	);

	for ( const file of trackedFiles ) {
		// Hidden files (`.DS_Store` and friends) are never legitimate skill content.
		assert(
			!file.split( '/' ).some( segment => segment.startsWith( '.' ) ),
			`The hidden "${ file }" file of the "${ skillDirectory }" directory must not be published. Remove it from git.`
		);

		// Symbolic links and other special entries could smuggle content from outside the skill directory.
		assert(
			( await fs.lstat( upath.join( skillPath, file ) ) ).isFile(),
			`Expected the "${ file }" entry of the "${ skillDirectory }" directory to be a regular file. Replace it with one.`
		);

		// Other characters are escaped in the listing of `tar`, and bsdtar on Windows stores them in the OEM code page.
		assert(
			/^[\x20-\x7e]+$/.test( file ),
			`Expected the "${ file }" path in the "${ skillDirectory }" directory to consist of printable ASCII characters only. ` +
			'Rename it.'
		);

		// bsdtar reads a member starting with `@` as an archive to append, whatever the `--` guard says.
		assert(
			!file.startsWith( '@' ),
			`The "${ file }" path in the "${ skillDirectory }" directory must not start with "@". Rename it.`
		);
	}

	return trackedFiles;
}
