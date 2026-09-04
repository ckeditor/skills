/**
 * @license Copyright (c) 2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import upath from 'upath';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prepareDiscoveryArtifacts, verifyDiscoveryArtifacts } from '../../../scripts/release/utils/discoveryartifacts.js';

const execFileAsync = promisify( execFile );

const RELEASE_DIRECTORY = 'release';
const SCHEMA_URL = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json';
const REBUILD_HINT = 'Run "pnpm release:prepare-packages" first.';

describe( 'scripts/release/utils/discoveryartifacts', () => {
	let cwd;

	beforeEach( async () => {
		cwd = await fs.mkdtemp( upath.join( os.tmpdir(), 'ckeditor-skills-' ) );
	} );

	afterEach( async () => {
		await fs.rm( cwd, { recursive: true, force: true } );
	} );

	describe( 'prepareDiscoveryArtifacts()', () => {
		it( 'should create an archive per skill and return the created paths', async () => {
			await createRepository( { skills: [ 'ckeditor', 'ckeditor-upgrade' ] } );

			expect( await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).to.deep.equal( [
				'release/ckeditor-1.2.3.tar.gz',
				'release/ckeditor-upgrade-1.2.3.tar.gz',
				'release/index.json'
			] );

			for ( const file of [ 'ckeditor-1.2.3.tar.gz', 'ckeditor-upgrade-1.2.3.tar.gz' ] ) {
				expect( ( await fs.stat( upath.join( cwd, RELEASE_DIRECTORY, file ) ) ).isFile() ).to.equal( true );
			}
		} );

		it( 'should write an index that follows the discovery schema', async () => {
			await createRepository();

			await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );

			const index = await readIndex();

			expect( index.$schema ).to.equal( SCHEMA_URL );
			expect( index.skills ).to.have.length( 1 );
			expect( index.skills[ 0 ].name ).to.equal( 'ckeditor' );
			expect( index.skills[ 0 ].type ).to.equal( 'archive' );
			expect( index.skills[ 0 ].description ).to.equal( 'Install and configure ckeditor in any JavaScript project.' );
			expect( index.skills[ 0 ].url ).to.equal( '/.well-known/agent-skills/ckeditor-1.2.3.tar.gz' );
			expect( index.skills[ 0 ].digest ).to.match( /^sha256:[0-9a-f]{64}$/ );
		} );

		it( 'should store a digest matching the archive content', async () => {
			await createRepository();

			await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );

			const archive = await fs.readFile( upath.join( cwd, RELEASE_DIRECTORY, 'ckeditor-1.2.3.tar.gz' ) );
			const digest = createHash( 'sha256' ).update( archive ).digest( 'hex' );

			expect( ( await readIndex() ).skills[ 0 ].digest ).to.equal( `sha256:${ digest }` );
		} );

		it( 'should sort the skills in the index by name', async () => {
			await createRepository( { skills: [ 'zebra', 'alpha' ] } );

			await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );

			expect( ( await readIndex() ).skills.map( ( { name } ) => name ) ).to.deep.equal( [ 'alpha', 'zebra' ] );
		} );

		it( 'should wipe the release directory before building', async () => {
			await createRepository();
			await writeFile( upath.join( RELEASE_DIRECTORY, 'stale.txt' ), 'Leftover from a previous run.\n' );
			await writeFile( upath.join( RELEASE_DIRECTORY, 'ckeditor-0.0.1.tar.gz' ), 'Stale archive.\n' );

			await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );

			expect( ( await fs.readdir( upath.join( cwd, RELEASE_DIRECTORY ) ) ).sort() ).to.deep.equal( [
				'ckeditor-1.2.3.tar.gz',
				'index.json'
			] );
		} );
	} );

	describe( 'verifyDiscoveryArtifacts()', () => {
		it( 'should pass for freshly prepared artifacts', async () => {
			await createRepository( { skills: [ 'ckeditor', 'ckeditor-upgrade' ] } );
			await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );

			await verifyDiscoveryArtifacts( { cwd, version: '1.2.3' } );
		} );

		it( 'should throw when the release directory does not exist', async () => {
			await createRepository();

			await expect( verifyDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).rejects.toThrow(
				'Expected the "release" directory to contain "ckeditor-1.2.3.tar.gz", "index.json", found nothing. ' + REBUILD_HINT
			);
		} );

		it( 'should throw when an archive file is missing', async () => {
			await createRepository();
			await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );
			await fs.rm( upath.join( cwd, RELEASE_DIRECTORY, 'ckeditor-1.2.3.tar.gz' ) );

			await expect( verifyDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).rejects.toThrow(
				'Expected the "release" directory to contain "ckeditor-1.2.3.tar.gz", "index.json", found "index.json". ' + REBUILD_HINT
			);
		} );

		it( 'should throw when the release directory contains unexpected entries', async () => {
			await createRepository();
			await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );
			await writeFile( upath.join( RELEASE_DIRECTORY, 'notes.txt' ), 'Not an artifact.\n' );

			await expect( verifyDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).rejects.toThrow(
				'Expected the "release" directory to contain "ckeditor-1.2.3.tar.gz", "index.json", ' +
				'found "ckeditor-1.2.3.tar.gz", "index.json", "notes.txt". ' + REBUILD_HINT
			);
		} );

		it( 'should throw when the archives do not carry the given version', async () => {
			await createRepository();
			await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );

			await expect( verifyDiscoveryArtifacts( { cwd, version: '2.0.0' } ) ).rejects.toThrow(
				'Expected the "release" directory to contain "ckeditor-2.0.0.tar.gz", "index.json", ' +
				'found "ckeditor-1.2.3.tar.gz", "index.json". ' + REBUILD_HINT
			);
		} );

		it( 'should throw when a skill was added after preparing', async () => {
			await createRepository();
			await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );
			await createSkill( 'ckeditor-upgrade' );

			await expect( verifyDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).rejects.toThrow(
				'Expected the "release" directory to contain "ckeditor-1.2.3.tar.gz", "ckeditor-upgrade-1.2.3.tar.gz", "index.json", ' +
				'found "ckeditor-1.2.3.tar.gz", "index.json". ' + REBUILD_HINT
			);
		} );

		it( 'should throw when the index file is not a valid JSON file', async () => {
			await createRepository();
			await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );
			await writeFile( upath.join( RELEASE_DIRECTORY, 'index.json' ), 'Not a JSON file.\n' );

			await expect( verifyDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).rejects.toThrow(
				'The "release/index.json" file is not a valid JSON file.'
			);
		} );

		for ( const [ problem, tamper ] of [
			[ 'follows another schema', index => {
				index.$schema = 'https://example.com/schema.json';
			} ],
			[ 'does not contain an entry for a skill', index => {
				index.skills = [];
			} ],
			[ 'stores another entry type', index => {
				index.skills[ 0 ].type = 'skill-md';
			} ],
			[ 'stores a stale description', index => {
				index.skills[ 0 ].description = 'An outdated description.';
			} ]
		] ) {
			it( `should throw when the index ${ problem }`, async () => {
				await createRepository();
				await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );
				await updateIndex( tamper );

				await expect( verifyDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).rejects.toThrow(
					'The "release/index.json" file does not match the current skills and archives. ' + REBUILD_HINT
				);
			} );
		}

		it( 'should throw when a skill file changed after preparing', async () => {
			await createRepository();
			await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );
			await createSkill( 'ckeditor', 'A new description.' );

			await expect( verifyDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).rejects.toThrow(
				'The "release/index.json" file does not match the current skills and archives. ' + REBUILD_HINT
			);
		} );

		it( 'should throw when the digest does not match the archive', async () => {
			await createRepository();
			await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );
			await fs.appendFile( upath.join( cwd, RELEASE_DIRECTORY, 'ckeditor-1.2.3.tar.gz' ), 'Extra byte.' );

			await expect( verifyDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).rejects.toThrow(
				'The "release/index.json" file does not match the current skills and archives. ' + REBUILD_HINT
			);
		} );
	} );

	/**
	 * Creates a repository with the given skills, each storing a description that resolves to
	 * `Install and configure <name> in any JavaScript project.`.
	 */
	async function createRepository( { skills = [ 'ckeditor' ] } = {} ) {
		await fs.mkdir( upath.join( cwd, 'skills' ), { recursive: true } );

		for ( const name of skills ) {
			await createSkill( name );
		}

		// The archives ship only git-tracked files, so the fixture must be a repository with its content staged.
		await execFileAsync( 'git', [ 'init', '--quiet' ], { cwd } );
		await execFileAsync( 'git', [ 'add', '--all' ], { cwd } );
	}

	async function createSkill( name, description = `Install and configure ${ name } in any JavaScript project.` ) {
		await writeFile( upath.join( 'skills', name, 'SKILL.md' ), [
			'---',
			`name: ${ name }`,
			`description: ${ description }`,
			'metadata:',
			'  version: 1.0.0',
			'---',
			'',
			`# ${ name }`,
			''
		].join( '\n' ) );

		await writeFile( upath.join( 'skills', name, 'references', 'usage.md' ), `How to use ${ name }.\n` );
	}

	function readIndex() {
		return fs.readFile( upath.join( cwd, RELEASE_DIRECTORY, 'index.json' ), 'utf-8' ).then( JSON.parse );
	}

	async function updateIndex( callback ) {
		const index = await readIndex();

		callback( index );

		await writeFile( upath.join( RELEASE_DIRECTORY, 'index.json' ), JSON.stringify( index, null, 2 ) + '\n' );
	}

	async function writeFile( file, content ) {
		const filePath = upath.join( cwd, file );

		await fs.mkdir( upath.dirname( filePath ), { recursive: true } );
		await fs.writeFile( filePath, content, 'utf-8' );
	}
} );
