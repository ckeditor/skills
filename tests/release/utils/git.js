/**
 * @license Copyright (c) 2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import upath from 'upath';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findUncommittedFiles, listGitFiles } from '../../../scripts/release/utils/git.js';

const execFileAsync = promisify( execFile );

describe( 'scripts/release/utils/git', () => {
	let cwd;

	beforeEach( async () => {
		cwd = await fs.mkdtemp( upath.join( os.tmpdir(), 'ckeditor-skills-' ) );

		await writeFile( 'skills/ckeditor/SKILL.md', '---\nname: ckeditor\n---\n\n# ckeditor\n' );
		await writeFile( 'skills/ckeditor/references/usage.md', 'How to use ckeditor.\n' );
		await git( 'init', '--quiet' );
		await commitAll();
	} );

	afterEach( async () => {
		await fs.rm( cwd, { recursive: true, force: true } );
	} );

	describe( 'listGitFiles()', () => {
		it( 'should list the tracked files of a directory as paths relative to it', async () => {
			expect( await listGitFiles( upath.join( cwd, 'skills', 'ckeditor' ) ) ).to.have.members( [
				'SKILL.md',
				'references/usage.md'
			] );
		} );

		it( 'should pass the arguments to git', async () => {
			await writeFile( 'skills/ckeditor/references/draft.md', 'Work in progress.\n' );

			expect( await listGitFiles( upath.join( cwd, 'skills', 'ckeditor' ), [ '--others' ] ) ).to.deep.equal( [
				'references/draft.md'
			] );
		} );
	} );

	describe( 'findUncommittedFiles()', () => {
		it( 'should return nothing for a clean working tree', async () => {
			expect( await findUncommittedFiles( { cwd } ) ).to.deep.equal( [] );
		} );

		it( 'should list a modified file', async () => {
			await writeFile( 'skills/ckeditor/SKILL.md', '---\nname: ckeditor\n---\n\n# ckeditor, modified\n' );

			expect( await findUncommittedFiles( { cwd } ) ).to.deep.equal( [ 'skills/ckeditor/SKILL.md' ] );
		} );

		it( 'should list an untracked file', async () => {
			await writeFile( 'notes.md', 'Not committed.\n' );

			expect( await findUncommittedFiles( { cwd } ) ).to.deep.equal( [ 'notes.md' ] );
		} );

		it( 'should list a file added to the index', async () => {
			await writeFile( 'notes.md', 'Staged, not committed.\n' );
			await git( 'add', 'notes.md' );

			expect( await findUncommittedFiles( { cwd } ) ).to.deep.equal( [ 'notes.md' ] );
		} );

		it( 'should list a deleted file', async () => {
			await fs.rm( upath.join( cwd, 'skills', 'ckeditor', 'references', 'usage.md' ) );

			expect( await findUncommittedFiles( { cwd } ) ).to.deep.equal( [ 'skills/ckeditor/references/usage.md' ] );
		} );

		it( 'should list an untracked directory as a single entry', async () => {
			await writeFile( 'skills/upgrade/SKILL.md', '---\nname: upgrade\n---\n' );

			expect( await findUncommittedFiles( { cwd } ) ).to.deep.equal( [ 'skills/upgrade/' ] );
		} );

		it( 'should list a renamed file under its new path only', async () => {
			await git( 'mv', 'skills/ckeditor/references/usage.md', 'skills/ckeditor/references/guide.md' );

			expect( await findUncommittedFiles( { cwd } ) ).to.deep.equal( [ 'skills/ckeditor/references/guide.md' ] );
		} );

		it( 'should leave out the ignored files', async () => {
			await writeFile( '.gitignore', '*.log\n' );
			await commitAll();
			await writeFile( 'debug.log', 'Not skill content.\n' );

			expect( await findUncommittedFiles( { cwd } ) ).to.deep.equal( [] );
		} );

		it( 'should not quote a path with a space', async () => {
			await writeFile( 'sp ace.md', 'Not committed.\n' );

			expect( await findUncommittedFiles( { cwd } ) ).to.deep.equal( [ 'sp ace.md' ] );
		} );
	} );

	function git( ...args ) {
		return execFileAsync( 'git', args, { cwd } );
	}

	async function commitAll() {
		await git( 'add', '--all' );
		await git(
			'-c', 'user.name=CKEditor', '-c', 'user.email=ci@ckeditor.com', '-c', 'commit.gpgsign=false',
			'commit', '--quiet', '--message', 'A commit.'
		);
	}

	async function writeFile( file, content ) {
		const filePath = upath.join( cwd, file );

		await fs.mkdir( upath.dirname( filePath ), { recursive: true } );
		await fs.writeFile( filePath, content, 'utf-8' );
	}
} );
