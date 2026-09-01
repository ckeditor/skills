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

		it( 'should store the skill files at the root of the archive', async () => {
			await createRepository();

			await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );

			expect( await listArchive( 'ckeditor-1.2.3.tar.gz' ) ).to.deep.equal( [
				'SKILL.md',
				'references/usage.md'
			] );
		} );

		it( 'should archive the exact contents of the skill directory', async () => {
			await createRepository();

			await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );

			const extractDirectory = upath.join( cwd, 'extracted' );

			await fs.mkdir( extractDirectory );
			await execFileAsync(
				'tar',
				[ '-xzf', 'ckeditor-1.2.3.tar.gz', '-C', extractDirectory ],
				{ cwd: upath.join( cwd, RELEASE_DIRECTORY ) }
			);

			for ( const file of [ 'SKILL.md', 'references/usage.md' ] ) {
				expect( await readFile( upath.join( 'extracted', file ) ) )
					.to.equal( await readFile( upath.join( 'skills', 'ckeditor', file ) ) );
			}
		} );

		it( 'should store a digest matching the archive content', async () => {
			await createRepository();

			await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );

			const archive = await fs.readFile( upath.join( cwd, RELEASE_DIRECTORY, 'ckeditor-1.2.3.tar.gz' ) );
			const digest = createHash( 'sha256' ).update( archive ).digest( 'hex' );

			expect( ( await readIndex() ).skills[ 0 ].digest ).to.equal( `sha256:${ digest }` );
		} );

		it( 'should fold a ">-" description block into paragraphs', async () => {
			await createRepository();
			await writeSkillFile( 'ckeditor', skillFileWithDescription( [
				'description: >-',
				'  line one',
				'  line two',
				'',
				'  second paragraph'
			] ) );

			await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );

			expect( ( await readIndex() ).skills[ 0 ].description ).to.equal( 'line one line two\nsecond paragraph' );
		} );

		it( 'should support a plain single-line description', async () => {
			await createRepository();
			await writeSkillFile( 'ckeditor', skillFileWithDescription( [
				'description: Install CKEditor 5.'
			] ) );

			await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );

			expect( ( await readIndex() ).skills[ 0 ].description ).to.equal( 'Install CKEditor 5.' );
		} );

		it( 'should keep the trailing newline of a ">" description block', async () => {
			await createRepository();
			await writeSkillFile( 'ckeditor', skillFileWithDescription( [
				'description: >',
				'  Install CKEditor 5.'
			] ) );

			await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );

			expect( ( await readIndex() ).skills[ 0 ].description ).to.equal( 'Install CKEditor 5.\n' );
		} );

		it( 'should parse a skill file with CRLF line endings', async () => {
			await createRepository();
			await writeSkillFile( 'ckeditor', skillFileWithDescription( [
				'description: >-',
				'  Install and configure',
				'  CKEditor 5.'
			] ).replaceAll( '\n', '\r\n' ) );

			await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );

			const [ skill ] = ( await readIndex() ).skills;

			expect( skill.name ).to.equal( 'ckeditor' );
			expect( skill.description ).to.equal( 'Install and configure CKEditor 5.' );
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

		it( 'should throw when a skill file does not start with the front matter', async () => {
			await createRepository();
			await writeSkillFile( 'ckeditor', '# CKEditor 5\n\nNo front matter here.\n' );

			await expect( prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).rejects.toThrow(
				'The "skills/ckeditor/SKILL.md" file does not start with a YAML front matter block.'
			);
		} );

		it( 'should throw when the front matter of a skill file does not have the name', async () => {
			await createRepository();
			await writeSkillFile( 'ckeditor', '---\ndescription: A skill.\n---\n\nBody.\n' );

			await expect( prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).rejects.toThrow(
				'Expected exactly one "name" entry in the front matter of the "skills/ckeditor/SKILL.md" file, found 0.'
			);
		} );

		it( 'should throw when the front matter of a skill file has more than one name', async () => {
			await createRepository();
			await writeSkillFile( 'ckeditor', '---\nname: ckeditor\nname: ckeditor\ndescription: A skill.\n---\n\nBody.\n' );

			await expect( prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).rejects.toThrow(
				'Expected exactly one "name" entry in the front matter of the "skills/ckeditor/SKILL.md" file, found 2.'
			);
		} );

		it( 'should throw when a skill name does not match its directory', async () => {
			await createRepository();
			await writeSkillFile( 'ckeditor', '---\nname: other-name\ndescription: A skill.\n---\n\nBody.\n' );

			await expect( prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).rejects.toThrow(
				'Expected the "skills/ckeditor/SKILL.md" file to store the "ckeditor" name (as its directory does), ' +
				'but found "other-name".'
			);
		} );

		it( 'should throw when a skill name does not follow the discovery specification', async () => {
			await createRepository( { skills: [] } );
			await createSkill( 'bad--name' );

			await expect( prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).rejects.toThrow(
				'The "bad--name" skill name in the "skills/bad--name/SKILL.md" file does not follow the discovery specification: ' +
				'up to 64 lowercase alphanumeric characters and hyphens, with no leading, trailing, or consecutive hyphens.'
			);
		} );

		it( 'should throw when a skill name is too long', async () => {
			const name = 'a'.repeat( 65 );

			await createRepository( { skills: [] } );
			await createSkill( name );

			await expect( prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).rejects.toThrow(
				`The "${ name }" skill name in the "skills/${ name }/SKILL.md" file does not follow the discovery specification:`
			);
		} );

		it( 'should throw when the front matter of a skill file does not have the description', async () => {
			await createRepository();
			await writeSkillFile( 'ckeditor', '---\nname: ckeditor\n---\n\nBody.\n' );

			await expect( prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).rejects.toThrow(
				'Expected exactly one "description" entry in the front matter of the "skills/ckeditor/SKILL.md" file, found 0.'
			);
		} );

		it( 'should throw when the description is too long', async () => {
			await createRepository();
			await writeSkillFile( 'ckeditor', skillFileWithDescription( [
				`description: ${ 'a'.repeat( 1025 ) }`
			] ) );

			await expect( prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).rejects.toThrow(
				'The description in the "skills/ckeditor/SKILL.md" file is 1025 characters long, ' +
				'while the discovery specification allows up to 1024.'
			);
		} );

		it( 'should throw when a ">-" description block is empty', async () => {
			await createRepository();
			await writeSkillFile( 'ckeditor', skillFileWithDescription( [
				'description: >-'
			] ) );

			await expect( prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).rejects.toThrow(
				'The "description" entry in the front matter of the "skills/ckeditor/SKILL.md" file is empty.'
			);
		} );

		for ( const [ style, descriptionLines ] of [
			[ 'the "|" literal block', [ 'description: |', '  Install CKEditor 5.' ] ],
			[ 'the ">+" keep block', [ 'description: >+', '  Install CKEditor 5.' ] ],
			[ 'a quoted value', [ 'description: "Install CKEditor 5."' ] ],
			[ 'an alias value', [ 'description: *shared' ] ],
			[ 'an empty value', [ 'description:' ] ],
			[ 'a multi-line plain value', [ 'description: Install', '  CKEditor 5.' ] ],
			[ 'a value with a YAML comment', [ 'description: Install CKEditor 5. # A comment.' ] ],
			[ 'a folded block with uneven indentation', [ 'description: >-', '  Install', '    CKEditor 5.' ] ],
			[ 'a folded block with trailing whitespace', [ 'description: >-', '  Install CKEditor 5. ' ] ]
		] ) {
			it( `should throw when the description uses ${ style }`, async () => {
				await createRepository();
				await writeSkillFile( 'ckeditor', skillFileWithDescription( descriptionLines ) );

				await expect( prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).rejects.toThrow(
					'The "skills/ckeditor/SKILL.md" file stores the "description" in an unsupported style. ' +
					'Use a plain single-line value or a ">-"/">"-folded block.'
				);
			} );
		}

		it( 'should throw when a skill directory contains a hidden file', async () => {
			await createRepository();
			await writeFile( upath.join( 'skills', 'ckeditor', '.DS_Store' ), 'Not skill content.\n' );

			await expect( prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).rejects.toThrow(
				'Remove the hidden ".DS_Store" entry from the'
			);
		} );

		it( 'should throw when the repository does not contain any skill', async () => {
			await createRepository( { skills: [] } );

			await expect( prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).rejects.toThrow(
				'Could not find any "SKILL.md" file in the "skills" directory.'
			);
		} );
	} );

	describe( 'verifyDiscoveryArtifacts()', () => {
		it( 'should pass for freshly prepared artifacts', async () => {
			await createRepository( { skills: [ 'ckeditor', 'ckeditor-upgrade' ] } );
			await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );

			await verifyDiscoveryArtifacts( { cwd, version: '1.2.3' } );
		} );

		it( 'should throw when the index file is missing', async () => {
			await createRepository();

			await expect( verifyDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).rejects.toThrow(
				'Could not find the "release/index.json" file. Run "pnpm release:prepare-packages" first.'
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

		it( 'should throw when the index does not have the expected shape', async () => {
			await createRepository();
			await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );
			await writeFile( upath.join( RELEASE_DIRECTORY, 'index.json' ), '{ "skills": {} }\n' );

			await expect( verifyDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).rejects.toThrow(
				'The "release/index.json" file does not have the expected shape: ' +
				`an index following the "${ SCHEMA_URL }" schema with a "skills" array.`
			);
		} );

		it( 'should throw when the index does not contain an entry for a skill', async () => {
			await createRepository();
			await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );
			await createSkill( 'ckeditor-upgrade' );

			await expect( verifyDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).rejects.toThrow(
				'The "release/index.json" file does not contain an entry for the "ckeditor-upgrade" skill. ' +
				'Run "pnpm release:prepare-packages" first.'
			);
		} );

		it( 'should throw when the index contains an entry for an unknown skill', async () => {
			await createRepository( { skills: [ 'ckeditor', 'ckeditor-upgrade' ] } );
			await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );
			await fs.rm( upath.join( cwd, 'skills', 'ckeditor-upgrade' ), { recursive: true } );

			await expect( verifyDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).rejects.toThrow(
				'The "release/index.json" file contains an entry for the unknown "ckeditor-upgrade" skill. ' +
				'Run "pnpm release:prepare-packages" first.'
			);
		} );

		it( 'should throw when an entry does not have the "archive" type', async () => {
			await createRepository();
			await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );
			await updateIndex( index => {
				index.skills[ 0 ].type = 'skill-md';
			} );

			await expect( verifyDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).rejects.toThrow(
				'Expected the "ckeditor" entry in the "release/index.json" file to have the "archive" type, ' +
				'found "skill-md".'
			);
		} );

		it( 'should throw when the description of an entry does not match the skill file', async () => {
			await createRepository();
			await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );
			await updateIndex( index => {
				index.skills[ 0 ].description = 'An outdated description.';
			} );

			await expect( verifyDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).rejects.toThrow(
				'The description of the "ckeditor" entry in the "release/index.json" file does not match ' +
				'the "skills/ckeditor/SKILL.md" file.'
			);
		} );

		it( 'should throw when the archives do not carry the given version', async () => {
			await createRepository();
			await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );

			await expect( verifyDiscoveryArtifacts( { cwd, version: '2.0.0' } ) ).rejects.toThrow(
				'Expected the "ckeditor" entry in the "release/index.json" file to point at ' +
				'"/.well-known/agent-skills/ckeditor-2.0.0.tar.gz", found "/.well-known/agent-skills/ckeditor-1.2.3.tar.gz".'
			);
		} );

		it( 'should throw when an archive file is missing', async () => {
			await createRepository();
			await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );
			await fs.rm( upath.join( cwd, RELEASE_DIRECTORY, 'ckeditor-1.2.3.tar.gz' ) );

			await expect( verifyDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).rejects.toThrow(
				'Could not find the "release/ckeditor-1.2.3.tar.gz" archive. ' +
				'Run "pnpm release:prepare-packages" first.'
			);
		} );

		it( 'should throw when the release directory contains unexpected entries', async () => {
			await createRepository();
			await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );
			await writeFile( upath.join( RELEASE_DIRECTORY, 'notes.txt' ), 'Not an artifact.\n' );

			await expect( verifyDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).rejects.toThrow(
				'The "release" directory contains unexpected entries: "notes.txt". ' +
				'Run "pnpm release:prepare-packages" first.'
			);
		} );

		it( 'should throw when the digest does not match the archive', async () => {
			await createRepository();
			await prepareDiscoveryArtifacts( { cwd, version: '1.2.3' } );
			await fs.appendFile( upath.join( cwd, RELEASE_DIRECTORY, 'ckeditor-1.2.3.tar.gz' ), 'Extra byte.' );

			await expect( verifyDiscoveryArtifacts( { cwd, version: '1.2.3' } ) ).rejects.toThrow(
				'The digest of the "release/ckeditor-1.2.3.tar.gz" archive does not match ' +
				'its "release/index.json" entry.'
			);
		} );
	} );

	/**
	 * Creates a repository with the given skills, each storing a folded description that resolves to
	 * `Install and configure <name> in any JavaScript project.`.
	 */
	async function createRepository( { skills = [ 'ckeditor' ] } = {} ) {
		await fs.mkdir( upath.join( cwd, 'skills' ), { recursive: true } );

		for ( const name of skills ) {
			await createSkill( name );
		}
	}

	async function createSkill( name ) {
		await writeSkillFile( name, [
			'---',
			`name: ${ name }`,
			'description: >-',
			`  Install and configure ${ name }`,
			'  in any JavaScript project.',
			'metadata:',
			'  author: CKEditor (CKSource)',
			'  version: 1.0.0',
			'---',
			'',
			`# ${ name }`,
			''
		].join( '\n' ) );

		await writeFile( upath.join( 'skills', name, 'references', 'usage.md' ), `How to use ${ name }.\n` );
	}

	/**
	 * Returns the content of a `SKILL.md` file of the `ckeditor` skill with the given `description` lines.
	 */
	function skillFileWithDescription( descriptionLines ) {
		return [
			'---',
			'name: ckeditor',
			...descriptionLines,
			'metadata:',
			'  version: 1.0.0',
			'---',
			'',
			'# ckeditor',
			''
		].join( '\n' );
	}

	function readIndex() {
		return readFile( upath.join( RELEASE_DIRECTORY, 'index.json' ) ).then( JSON.parse );
	}

	async function updateIndex( callback ) {
		const index = await readIndex();

		callback( index );

		await writeFile( upath.join( RELEASE_DIRECTORY, 'index.json' ), JSON.stringify( index, null, 2 ) + '\n' );
	}

	async function listArchive( archiveFileName ) {
		const { stdout } = await execFileAsync(
			'tar',
			[ '-tzf', archiveFileName ],
			{ cwd: upath.join( cwd, RELEASE_DIRECTORY ) }
		);

		return stdout.split( /\r?\n/ ).filter( line => line !== '' );
	}

	function writeSkillFile( name, content ) {
		return writeFile( upath.join( 'skills', name, 'SKILL.md' ), content );
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
