/**
 * @license Copyright (c) 2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import upath from 'upath';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadDiscoveryArtifacts } from '../../../scripts/release/utils/upload.js';
import { runCommand } from '../../../scripts/release/utils/command.js';

vi.mock( '../../../scripts/release/utils/command.js', () => ( {
	runCommand: vi.fn()
} ) );

const BUCKET = 'ckeditor-site';
const DISTRIBUTION_ID = 'E2EXAMPLE';

describe( 'scripts/release/utils/upload', () => {
	let cwd, releaseDirectory;

	beforeEach( async () => {
		cwd = await fs.mkdtemp( upath.join( os.tmpdir(), 'ckeditor-skills-' ) );
		releaseDirectory = upath.join( cwd, 'release' );

		// One archive sorts after `index.json`, so plain sorting would not put the index last.
		await fs.mkdir( releaseDirectory );
		await writeFile( 'zebra-1.2.3.tar.gz', 'An archive.\n' );
		await writeFile( 'ckeditor-upgrade-1.2.3.tar.gz', 'An archive.\n' );
		await writeFile( 'ckeditor-1.2.3.tar.gz', 'An archive.\n' );
		await writeFile( 'index.json', '{}\n' );

		runCommand.mockResolvedValue( '' );
	} );

	afterEach( async () => {
		runCommand.mockReset();

		await fs.rm( cwd, { recursive: true, force: true } );
	} );

	describe( 'uploadDiscoveryArtifacts()', () => {
		it( 'should upload the archives in name order and the index last', async () => {
			await upload();

			expect( getUploadedFiles() ).to.deep.equal( [
				'ckeditor-1.2.3.tar.gz',
				'ckeditor-upgrade-1.2.3.tar.gz',
				'zebra-1.2.3.tar.gz',
				'index.json'
			] );
		} );

		it( 'should upload an archive into the well-known path as gzip cached for a year', async () => {
			await upload();

			expect( getUploadCall( 'ckeditor-1.2.3.tar.gz' ) ).to.deep.equal( {
				command: 'aws',
				args: [
					's3', 'cp',
					upath.join( releaseDirectory, 'ckeditor-1.2.3.tar.gz' ),
					`s3://${ BUCKET }/.well-known/agent-skills/ckeditor-1.2.3.tar.gz`,
					'--content-type', 'application/gzip',
					'--cache-control', 'public, max-age=31536000'
				],
				options: { cwd }
			} );
		} );

		it( 'should upload the index into the well-known path as JSON with a short lifetime', async () => {
			await upload();

			expect( getUploadCall( 'index.json' ) ).to.deep.equal( {
				command: 'aws',
				args: [
					's3', 'cp',
					upath.join( releaseDirectory, 'index.json' ),
					`s3://${ BUCKET }/.well-known/agent-skills/index.json`,
					'--content-type', 'application/json',
					'--cache-control', 'public, max-age=300'
				],
				options: { cwd }
			} );
		} );

		it( 'should invalidate the whole well-known path in CloudFront after the upload', async () => {
			await upload();

			expect( getCalls() ).to.have.length( 5 );
			expect( getCalls().at( -1 ) ).to.deep.equal( {
				command: 'aws',
				args: [
					'cloudfront', 'create-invalidation',
					'--distribution-id', DISTRIBUTION_ID,
					'--paths', '/.well-known/agent-skills/*'
				],
				options: { cwd }
			} );
		} );

		it( 'should return the public URLs of the uploaded files in the upload order', async () => {
			expect( await upload() ).to.deep.equal( [
				'https://ckeditor.com/.well-known/agent-skills/ckeditor-1.2.3.tar.gz',
				'https://ckeditor.com/.well-known/agent-skills/ckeditor-upgrade-1.2.3.tar.gz',
				'https://ckeditor.com/.well-known/agent-skills/zebra-1.2.3.tar.gz',
				'https://ckeditor.com/.well-known/agent-skills/index.json'
			] );
		} );

		it( 'should stop at the first failed upload', async () => {
			runCommand
				.mockResolvedValueOnce( '' )
				.mockRejectedValueOnce( new Error( 'The "aws" command failed.' ) );

			await expect( upload() ).rejects.toThrow( 'The "aws" command failed.' );
			expect( getUploadedFiles() ).to.deep.equal( [ 'ckeditor-1.2.3.tar.gz', 'ckeditor-upgrade-1.2.3.tar.gz' ] );
			expect( getCalls() ).to.have.length( 2 );
		} );

		it( 'should fail when the invalidation fails, with everything uploaded', async () => {
			runCommand.mockImplementation( ( command, args ) => {
				return args[ 0 ] === 'cloudfront' ? Promise.reject( new Error( 'The "aws" command failed.' ) ) : Promise.resolve( '' );
			} );

			await expect( upload() ).rejects.toThrow( 'The "aws" command failed.' );
			expect( getUploadedFiles() ).to.have.length( 4 );
			expect( getCalls() ).to.have.length( 5 );
		} );
	} );

	function upload() {
		return uploadDiscoveryArtifacts( { cwd, bucket: BUCKET, distributionId: DISTRIBUTION_ID } );
	}

	function getCalls() {
		return runCommand.mock.calls.map( ( [ command, args, options ] ) => ( { command, args, options } ) );
	}

	function getUploadCalls() {
		return getCalls().filter( ( { args } ) => args[ 0 ] === 's3' );
	}

	function getUploadCall( file ) {
		return getUploadCalls().find( ( { args } ) => upath.basename( args[ 2 ] ) === file );
	}

	function getUploadedFiles() {
		return getUploadCalls().map( ( { args } ) => upath.basename( args[ 2 ] ) );
	}

	async function writeFile( file, content ) {
		await fs.writeFile( upath.join( releaseDirectory, file ), content, 'utf-8' );
	}
} );
