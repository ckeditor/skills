#!/usr/bin/env node

/**
 * @license Copyright (c) 2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import { Listr } from 'listr2';
import upath from 'upath';
import * as releaseTools from '@ckeditor/ckeditor5-dev-release-tools';
import { VERSIONED_FILE_PATTERNS, getMetadataVersions, updateMetadataVersions } from './utils/metadataversions.js';

const ROOT_DIRECTORY = upath.join( import.meta.dirname, '..', '..' );
const RELEASE_BRANCH = 'main';

const currentVersion = releaseTools.getCurrent( ROOT_DIRECTORY );
const latestVersion = releaseTools.getLastFromChangelog( ROOT_DIRECTORY );

if ( !latestVersion ) {
	console.error( 'Cannot find any version in the changelog. Run "pnpm release:prepare-changelog" first.' );

	process.exit( 1 );
}

const versionChangelog = releaseTools.getChangesForVersion( latestVersion, ROOT_DIRECTORY );

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
		}
	},
	{
		title: 'Verify that all files store the same version.',
		task: async () => {
			const outdatedFiles = ( await getMetadataVersions( { cwd: ROOT_DIRECTORY } ) )
				.filter( ( { versions } ) => versions.some( version => version !== currentVersion ) );

			if ( !outdatedFiles.length ) {
				return;
			}

			const details = outdatedFiles.map( ( { file, versions } ) => `* ${ file }: ${ versions.join( ', ' ) }` );

			return Promise.reject(
				`Expected all files to store the "${ currentVersion }" version (as "package.json" does), ` +
				'but found:\n' + details.join( '\n' ) + '\n' +
				'Align them with the last release before releasing a new version.'
			);
		}
	},
	{
		title: 'Update the version.',
		task: async ( _, task ) => {
			await releaseTools.updateVersions( {
				cwd: ROOT_DIRECTORY,
				version: latestVersion
			} );

			const updatedFiles = await updateMetadataVersions( {
				cwd: ROOT_DIRECTORY,
				version: latestVersion
			} );

			task.output = `Updated "package.json" and ${ updatedFiles.map( file => `"${ file }"` ).join( ', ' ) }.`;
		},
		options: {
			persistentOutput: true
		}
	},
	{
		title: 'Commit & tag phase.',
		task: () => {
			return releaseTools.commitAndTag( {
				cwd: ROOT_DIRECTORY,
				version: latestVersion,
				files: VERSIONED_FILE_PATTERNS
			} );
		}
	}
] );

tasks.run()
	.catch( err => {
		process.exitCode = 1;

		console.log( '' );
		console.error( err );
	} );
