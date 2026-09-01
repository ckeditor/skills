#!/usr/bin/env node

/**
 * @license Copyright (c) 2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import { parseArgs } from 'node:util';
import { Listr } from 'listr2';
import upath from 'upath';
import * as releaseTools from '@ckeditor/ckeditor5-dev-release-tools';
import { getMetadataVersion, updateMetadataVersions } from './utils/metadataversions.js';
import { prepareDiscoveryArtifacts, verifyDiscoveryArtifacts } from './utils/discoveryartifacts.js';

const ROOT_DIRECTORY = upath.join( import.meta.dirname, '..', '..' );
const RELEASE_BRANCH = 'main';

const { values: options } = parseArgs( {
	options: {
		'compile-only': {
			type: 'boolean',
			default: false
		},
		verbose: {
			type: 'boolean',
			default: false
		}
	}
} );

const compileOnly = options[ 'compile-only' ];

const currentVersion = releaseTools.getCurrent( ROOT_DIRECTORY );
const latestVersion = releaseTools.getLastFromChangelog( ROOT_DIRECTORY );

if ( !latestVersion && !compileOnly ) {
	console.error( 'Cannot find any version in the changelog. Run "pnpm release:prepare-changelog" first.' );

	process.exit( 1 );
}

// In the compile-only mode the metadata files are not updated, so the artifacts describe the current version.
const releaseVersion = compileOnly ? currentVersion : latestVersion;
const versionChangelog = compileOnly ? null : releaseTools.getChangesForVersion( latestVersion, ROOT_DIRECTORY );

const tasks = new Listr( [
	{
		title: 'Verify the repository.',
		task: async () => {
			const errors = await releaseTools.validateRepositoryToRelease( {
				cwd: ROOT_DIRECTORY,
				branch: RELEASE_BRANCH,
				version: latestVersion,
				changes: versionChangelog
			} );

			if ( !errors.length ) {
				return;
			}

			return Promise.reject( 'Aborted due to errors.\n' + errors.map( message => `* ${ message }` ).join( '\n' ) );
		},
		skip: () => compileOnly
	},
	{
		title: 'Verify that all files store the same version.',
		task: async () => {
			const metadataVersion = await getMetadataVersion( { cwd: ROOT_DIRECTORY } );

			if ( metadataVersion === currentVersion ) {
				return;
			}

			return Promise.reject(
				`Expected all files to store the "${ currentVersion }" version (as "package.json" does), ` +
				`but found "${ metadataVersion }". Align them with the last release before releasing a new version.`
			);
		}
	},
	{
		title: 'Update the version.',
		task: async ( context, task ) => {
			await releaseTools.updateVersions( {
				cwd: ROOT_DIRECTORY,
				version: latestVersion
			} );

			// The `package.json` file is updated by the task above, the rest by the one below.
			context.updatedFiles = [
				'package.json',
				...await updateMetadataVersions( {
					cwd: ROOT_DIRECTORY,
					version: latestVersion
				} )
			];

			task.output = `Updated ${ context.updatedFiles.map( file => `"${ file }"` ).join( ', ' ) }.`;
		},
		options: {
			persistentOutput: true
		},
		skip: () => compileOnly
	},
	{
		title: 'Prepare the discovery artifacts.',
		task: async ( _, task ) => {
			const createdFiles = await prepareDiscoveryArtifacts( {
				cwd: ROOT_DIRECTORY,
				version: releaseVersion
			} );

			// The artifacts are served from ckeditor.com rather than committed, so they do not
			// extend `context.updatedFiles`.
			task.output = `Created ${ createdFiles.map( file => `"${ file }"` ).join( ', ' ) }.`;
		},
		options: {
			persistentOutput: true
		}
	},
	{
		title: 'Verify the release directory.',
		task: () => {
			return verifyDiscoveryArtifacts( {
				cwd: ROOT_DIRECTORY,
				version: releaseVersion
			} );
		}
	},
	{
		title: 'Commit & tag phase.',
		task: context => {
			return releaseTools.commitAndTag( {
				cwd: ROOT_DIRECTORY,
				version: latestVersion,
				files: context.updatedFiles
			} );
		},
		skip: () => compileOnly
	}
], {
	renderer: options.verbose ? 'verbose' : 'default'
} );

tasks.run()
	.catch( err => {
		process.exitCode = 1;

		console.log( '' );
		console.error( err );
	} );
