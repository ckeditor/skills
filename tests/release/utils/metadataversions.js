/**
 * @license Copyright (c) 2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import upath from 'upath';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getMetadataVersion, updateMetadataVersions } from '../../../scripts/release/utils/metadataversions.js';

describe( 'scripts/release/utils/metadataversions', () => {
	let cwd;

	beforeEach( async () => {
		cwd = await fs.mkdtemp( upath.join( os.tmpdir(), 'ckeditor-skills-' ) );
	} );

	afterEach( async () => {
		await fs.rm( cwd, { recursive: true, force: true } );
	} );

	describe( 'getMetadataVersion()', () => {
		it( 'should return the version stored in the metadata files', async () => {
			await createRepository( { version: '1.2.3' } );

			expect( await getMetadataVersion( { cwd } ) ).to.equal( '1.2.3' );
		} );

		it( 'should return the version when there are many plugins and many skills', async () => {
			await createRepository( {
				version: '1.2.3',
				plugins: [ 'ckeditor', 'ckeditor-premium' ],
				skills: [ 'ckeditor', 'ckeditor-upgrade' ]
			} );

			expect( await getMetadataVersion( { cwd } ) ).to.equal( '1.2.3' );
		} );

		it( 'should throw when the files do not store the same version', async () => {
			await createRepository( { version: '1.2.3' } );
			await writePluginJson( '1.0.0' );

			await expect( getMetadataVersion( { cwd } ) ).rejects.toThrow(
				'Expected all files to store the same version, but found:\n' +
				'* .claude-plugin/plugin.json: 1.0.0\n' +
				// The marketplace manifest stores the version once for itself and once per plugin.
				'* .claude-plugin/marketplace.json: 1.2.3, 1.2.3\n' +
				'* skills/ckeditor/SKILL.md: 1.2.3'
			);
		} );

		it( 'should throw when a single file stores two different versions', async () => {
			await createRepository( { version: '1.2.3' } );
			await writeJson( '.claude-plugin/marketplace.json', {
				metadata: { version: '1.2.3' },
				plugins: [ { name: 'ckeditor', version: '1.0.0' } ]
			} );

			await expect( getMetadataVersion( { cwd } ) ).rejects.toThrow(
				'* .claude-plugin/marketplace.json: 1.2.3, 1.0.0'
			);
		} );

		it( 'should throw when a JSON file does not have the version', async () => {
			await createRepository();
			await writeJson( '.claude-plugin/plugin.json', { name: 'ckeditor' } );

			await expect( getMetadataVersion( { cwd } ) ).rejects.toThrow(
				'The ".claude-plugin/plugin.json" file does not have the expected shape: a missing "version" key.'
			);
		} );

		it( 'should throw when a skill file does not start with the front matter', async () => {
			await createRepository();
			await writeSkillFile( 'ckeditor', '# CKEditor 5\n\nNo front matter here.\n' );

			await expect( getMetadataVersion( { cwd } ) ).rejects.toThrow(
				'The "skills/ckeditor/SKILL.md" file does not start with a YAML front matter block.'
			);
		} );

		it( 'should throw when the front matter of a skill file does not have the version', async () => {
			await createRepository();
			await writeSkillFile( 'ckeditor', '---\nname: ckeditor\n---\n\nBody.\n' );

			await expect( getMetadataVersion( { cwd } ) ).rejects.toThrow(
				'Expected exactly one "metadata.version" entry in the front matter of the "skills/ckeditor/SKILL.md" file, found 0.'
			);
		} );

		it( 'should throw when the front matter of a skill file has more than one version', async () => {
			await createRepository();
			await writeSkillFile( 'ckeditor', '---\nmetadata:\n  version: 1.2.3\nother:\n  version: 1.2.3\n---\n\nBody.\n' );

			await expect( getMetadataVersion( { cwd } ) ).rejects.toThrow(
				'Expected exactly one "metadata.version" entry in the front matter of the "skills/ckeditor/SKILL.md" file, found 2.'
			);
		} );

		it( 'should throw when the repository does not contain any skill', async () => {
			await createRepository( { skills: [] } );

			await expect( getMetadataVersion( { cwd } ) ).rejects.toThrow(
				'Could not find any "SKILL.md" file in the "skills" directory.'
			);
		} );

		it( 'should ignore files and skill-less directories in the skills directory', async () => {
			await createRepository( { version: '1.2.3' } );
			await fs.writeFile( upath.join( cwd, 'skills', 'README.md' ), 'Not a skill.\n', 'utf-8' );
			await fs.mkdir( upath.join( cwd, 'skills', 'work-in-progress' ) );

			expect( await getMetadataVersion( { cwd } ) ).to.equal( '1.2.3' );
		} );
	} );

	describe( 'updateMetadataVersions()', () => {
		it( 'should store the version in every metadata file', async () => {
			await createRepository( {
				version: '1.2.3',
				plugins: [ 'ckeditor', 'ckeditor-premium' ],
				skills: [ 'ckeditor', 'ckeditor-upgrade' ]
			} );

			await updateMetadataVersions( { cwd, version: '2.0.0' } );

			expect( await getMetadataVersion( { cwd } ) ).to.equal( '2.0.0' );
		} );

		it( 'should return the paths of the updated files', async () => {
			await createRepository( { skills: [ 'ckeditor', 'ckeditor-upgrade' ] } );

			expect( await updateMetadataVersions( { cwd, version: '2.0.0' } ) ).to.deep.equal( [
				'.claude-plugin/plugin.json',
				'.claude-plugin/marketplace.json',
				'skills/ckeditor/SKILL.md',
				'skills/ckeditor-upgrade/SKILL.md'
			] );
		} );

		it( 'should not touch anything else in a skill file', async () => {
			await createRepository( { version: '1.2.3' } );

			const contentBefore = await readFile( 'skills/ckeditor/SKILL.md' );

			await updateMetadataVersions( { cwd, version: '2.0.0' } );

			expect( await readFile( 'skills/ckeditor/SKILL.md' ) )
				.to.equal( contentBefore.replace( 'version: 1.2.3', 'version: 2.0.0' ) );
		} );

		it( 'should keep the formatting of the JSON files', async () => {
			await createRepository( { version: '1.2.3' } );

			const contentBefore = await readFile( '.claude-plugin/plugin.json' );

			await updateMetadataVersions( { cwd, version: '2.0.0' } );

			expect( await readFile( '.claude-plugin/plugin.json' ) )
				.to.equal( contentBefore.replace( '1.2.3', '2.0.0' ) );
		} );

		it( 'should throw when a JSON file does not have the version', async () => {
			await createRepository();
			await writeJson( '.claude-plugin/plugin.json', { name: 'ckeditor' } );

			await expect( updateMetadataVersions( { cwd, version: '2.0.0' } ) ).rejects.toThrow(
				'The ".claude-plugin/plugin.json" file does not have the expected shape: a missing "version" key.'
			);
		} );

		it( 'should throw when the front matter of a skill file does not have the version', async () => {
			await createRepository();
			await writeSkillFile( 'ckeditor', '---\nversion: 1.2.3\n---\n\nA top-level version is not the one we look for.\n' );

			await expect( updateMetadataVersions( { cwd, version: '2.0.0' } ) ).rejects.toThrow(
				'Expected exactly one "metadata.version" entry in the front matter of the "skills/ckeditor/SKILL.md" file, found 0.'
			);
		} );
	} );

	/**
	 * Creates a repository where every file stores the same version, so that a test only has to describe how it
	 * differs from that.
	 */
	async function createRepository( { version = '1.0.0', plugins = [ 'ckeditor' ], skills = [ 'ckeditor' ] } = {} ) {
		await writePluginJson( version );

		await writeJson( '.claude-plugin/marketplace.json', {
			name: 'ckeditor',
			metadata: {
				description: 'Official CKEditor skills for AI coding agents.',
				version
			},
			plugins: plugins.map( name => ( { name, source: './', version } ) )
		} );

		await fs.mkdir( upath.join( cwd, 'skills' ), { recursive: true } );

		for ( const name of skills ) {
			await writeSkillFile( name, [
				'---',
				`name: ${ name }`,
				'description: >-',
				'  A description long enough to be folded, so that a reformatted front matter',
				'  would be easy to spot.',
				'allowed-tools:',
				'  - Read',
				'metadata:',
				'  author: CKEditor (CKSource)',
				`  version: ${ version }`,
				'---',
				'',
				`# ${ name }`,
				''
			].join( '\n' ) );
		}
	}

	function writePluginJson( version ) {
		return writeJson( '.claude-plugin/plugin.json', {
			name: 'ckeditor',
			description: 'Install, configure, and integrate CKEditor 5 in any JavaScript project.',
			version,
			license: 'MIT'
		} );
	}

	async function writeJson( file, json ) {
		await writeFile( file, JSON.stringify( json, null, 2 ) + '\n' );
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
