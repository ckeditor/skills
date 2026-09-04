/**
 * @license Copyright (c) 2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { gunzipSync } from 'node:zlib';
import fs from 'node:fs/promises';
import os from 'node:os';
import upath from 'upath';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createArchive } from '../../../scripts/release/utils/archive.js';

const execFileAsync = promisify( execFile );

const ARCHIVE_FILE_NAME = 'ckeditor-1.2.3.tar.gz';

describe( 'scripts/release/utils/archive', () => {
	let cwd, artifactsDirectory;

	beforeEach( async () => {
		cwd = await fs.mkdtemp( upath.join( os.tmpdir(), 'ckeditor-skills-' ) );
		artifactsDirectory = upath.join( cwd, 'release' );

		await fs.mkdir( artifactsDirectory );
		await writeFile( 'skills/ckeditor/SKILL.md', '---\nname: ckeditor\n---\n\n# ckeditor\n' );
		await writeFile( 'skills/ckeditor/references/usage.md', 'How to use ckeditor.\n' );

		// The archives ship only git-tracked files, so the fixture must be a repository with its content staged.
		await git( 'init', '--quiet' );
		await git( 'add', '--all' );
	} );

	afterEach( async () => {
		await fs.rm( cwd, { recursive: true, force: true } );
	} );

	describe( 'createArchive()', () => {
		it( 'should store the git-tracked skill files at the root of the archive', async () => {
			await createSkillArchive();

			expect( await listArchive() ).to.deep.equal( [
				'SKILL.md',
				'references/usage.md'
			] );
		} );

		it( 'should archive the exact contents of the skill files', async () => {
			await createSkillArchive();

			const extractDirectory = upath.join( cwd, 'extracted' );

			await fs.mkdir( extractDirectory );
			await execFileAsync( 'tar', [ '-xzf', ARCHIVE_FILE_NAME, '-C', extractDirectory ], { cwd: artifactsDirectory } );

			for ( const file of [ 'SKILL.md', 'references/usage.md' ] ) {
				expect( await readFile( upath.join( 'extracted', file ) ) )
					.to.equal( await readFile( upath.join( 'skills', 'ckeditor', file ) ) );
			}
		} );

		it( 'should create a ustar archive', async () => {
			await createSkillArchive();

			// The magic and version fields of the first header, starting at the offset 257: POSIX ustar stores
			// `ustar`, NUL and `00` there, while the default GNU format stores `ustar`, two spaces and NUL.
			expect( ( await readArchive() ).toString( 'latin1', 257, 265 ) ).to.equal( 'ustar\x0000' );
		} );

		it( 'should not store the user and group names in the archive', async () => {
			await createSkillArchive();

			// The user and group name fields of the first header, 32 bytes each, starting at the offset 265.
			expect( ( await readArchive() ).toString( 'latin1', 265, 329 ).replaceAll( '\0', '' ) ).to.equal( '' );
		} );

		it( 'should archive a file whose name starts with a dash', async () => {
			await writeFile( 'skills/ckeditor/-notes.md', 'Starts with a dash.\n' );
			await git( 'add', '--all' );

			await createSkillArchive();

			expect( await listArchive() ).to.deep.equal( [
				'-notes.md',
				'SKILL.md',
				'references/usage.md'
			] );
		} );

		it( 'should archive a path longer than 100 characters when it can be split at a slash', async () => {
			// The `ustar` header stores such a path in two fields: a prefix of up to 155 characters and a name of up
			// to 100 characters.
			const file = `references/${ 'a'.repeat( 95 ) }.md`;

			await writeFile( `skills/ckeditor/${ file }`, 'A long path.\n' );
			await git( 'add', '--all' );

			await createSkillArchive();

			expect( await listArchive() ).to.include( file );
		} );

		it( 'should leave out the files ignored by git', async () => {
			await writeFile( '.gitignore', '*.log\n' );
			await writeFile( 'skills/ckeditor/debug.log', 'Not skill content.\n' );

			await createSkillArchive();

			expect( await listArchive() ).to.deep.equal( [
				'SKILL.md',
				'references/usage.md'
			] );
		} );

		it( 'should throw when the skill directory contains a file not tracked by git', async () => {
			await writeFile( 'skills/ckeditor/references/draft.md', 'Work in progress.\n' );

			await expect( createSkillArchive() ).rejects.toThrow(
				'The "skills/ckeditor" directory does not match git: "references/draft.md". Commit, restore, or remove these files.'
			);
		} );

		it( 'should throw when a git-tracked skill file is missing from disk', async () => {
			await fs.rm( upath.join( cwd, 'skills', 'ckeditor', 'references', 'usage.md' ) );

			await expect( createSkillArchive() ).rejects.toThrow(
				'The "skills/ckeditor" directory does not match git: "references/usage.md". Commit, restore, or remove these files.'
			);
		} );

		it( 'should list every file that does not match git', async () => {
			await writeFile( 'skills/ckeditor/references/draft.md', 'Work in progress.\n' );
			await fs.rm( upath.join( cwd, 'skills', 'ckeditor', 'references', 'usage.md' ) );

			await expect( createSkillArchive() ).rejects.toThrow(
				'does not match git: "references/draft.md", "references/usage.md".'
			);
		} );

		it( 'should throw when the skill directory does not have any git-tracked file', async () => {
			await git( 'rm', '--cached', '--quiet', '-r', 'skills/ckeditor' );
			await writeFile( '.gitignore', 'skills/\n' );

			await expect( createSkillArchive() ).rejects.toThrow(
				'The "skills/ckeditor" directory does not have any git-tracked file. Add the skill files to git.'
			);
		} );

		it( 'should throw when git tracks the skill file under another letter case', async () => {
			await git( 'mv', 'skills/ckeditor/SKILL.md', 'skills/ckeditor/skill.md' );

			await expect( createSkillArchive() ).rejects.toThrow(
				'Expected git to track a "SKILL.md" file (with this exact letter case) in the "skills/ckeditor" directory.'
			);
		} );

		it( 'should throw when git tracks a hidden file in the skill directory', async () => {
			await writeFile( 'skills/ckeditor/.hidden', 'Not skill content.\n' );
			await git( 'add', '--force', 'skills/ckeditor/.hidden' );

			await expect( createSkillArchive() ).rejects.toThrow(
				'The hidden ".hidden" file of the "skills/ckeditor" directory must not be published. Remove it from git.'
			);
		} );

		it( 'should throw when a git-tracked entry is not a regular file', async () => {
			// A directory stands in for a symbolic link, as creating one requires elevated privileges on Windows.
			await fs.rm( upath.join( cwd, 'skills', 'ckeditor', 'references', 'usage.md' ) );
			await fs.mkdir( upath.join( cwd, 'skills', 'ckeditor', 'references', 'usage.md' ) );

			await expect( createSkillArchive() ).rejects.toThrow(
				'Expected the "references/usage.md" entry of the "skills/ckeditor" directory to be a regular file. ' +
				'Replace it with one.'
			);
		} );

		it( 'should throw when a path contains characters outside printable ASCII', async () => {
			await writeFile( 'skills/ckeditor/references/ünicode.md', 'Not portable.\n' );
			await git( 'add', '--all' );

			await expect( createSkillArchive() ).rejects.toThrow(
				'Expected the "references/ünicode.md" path in the "skills/ckeditor" directory ' +
				'to consist of printable ASCII characters only. Rename it.'
			);
		} );

		it( 'should throw when a path starts with an at sign', async () => {
			await writeFile( 'skills/ckeditor/@notes.md', 'Starts with an at sign.\n' );
			await git( 'add', '--all' );

			await expect( createSkillArchive() ).rejects.toThrow(
				'The "@notes.md" path in the "skills/ckeditor" directory must not start with "@". Rename it.'
			);
		} );

		it( 'should throw when tar cannot store an entry', async () => {
			// The name does not fit the `ustar` header. GNU tar refuses to create the archive, while bsdtar leaves the
			// entry out and exits successfully, which the listing check catches. Only our own wording is asserted, as
			// tar translates its messages.
			await writeFile( `skills/ckeditor/${ 'a'.repeat( 98 ) }.md`, 'Too long a name.\n' );
			await git( 'add', '--all' );

			await expect( createSkillArchive() ).rejects.toThrow(
				/^The "tar" command failed in the .* directory: |^Expected the "ckeditor-1\.2\.3\.tar\.gz" archive to contain/
			);
		} );

		it( 'should throw with the git error when git cannot list the skill directory', async () => {
			// A directory inside `.git/` is not part of any work tree, so `git ls-files` refuses to run there.
			await writeFile( '.git/skill/SKILL.md', '---\nname: skill\n---\n' );

			// Only the prefix, as git translates its own message.
			await expect( createSkillArchive( '.git/skill' ) ).rejects.toThrow(
				`The "git" command failed in the "${ upath.join( cwd, '.git', 'skill' ) }" directory: `
			);
		} );
	} );

	function createSkillArchive( skillDirectory = 'skills/ckeditor' ) {
		return createArchive( {
			cwd,
			skillDirectory,
			artifactsDirectory,
			archiveFileName: ARCHIVE_FILE_NAME
		} );
	}

	async function readArchive() {
		return gunzipSync( await fs.readFile( upath.join( artifactsDirectory, ARCHIVE_FILE_NAME ) ) );
	}

	async function listArchive() {
		const { stdout } = await execFileAsync( 'tar', [ '-tzf', ARCHIVE_FILE_NAME ], { cwd: artifactsDirectory } );

		return stdout.split( /\r?\n/ ).filter( line => line !== '' );
	}

	function git( ...args ) {
		return execFileAsync( 'git', args, { cwd } );
	}

	async function writeFile( file, content ) {
		const filePath = upath.join( cwd, file );

		await fs.mkdir( upath.dirname( filePath ), { recursive: true } );
		await fs.writeFile( filePath, content, 'utf-8' );
	}

	function readFile( file ) {
		return fs.readFile( upath.join( cwd, file ), 'utf-8' );
	}
} );
