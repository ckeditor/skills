#!/usr/bin/env node

/**
 * @license Copyright (c) 2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import { Listr } from 'listr2';
import upath from 'upath';
import * as releaseTools from '@ckeditor/ckeditor5-dev-release-tools';

const ROOT_DIRECTORY = upath.join( import.meta.dirname, '..', '..' );
const RELEASE_BRANCH = 'main';

const latestVersion = releaseTools.getLastFromChangelog( ROOT_DIRECTORY );

if ( !latestVersion ) {
	console.error( 'Cannot find any version in the changelog. Run "pnpm release:prepare-changelog" first.' );

	process.exit( 1 );
}

const versionChangelog = releaseTools.getChangesForVersion( latestVersion, ROOT_DIRECTORY );

// Verify the repository before asking for the token, as the version is pushed from the release branch
// regardless of the branch that is currently checked out.
const errors = await releaseTools.validateRepositoryToRelease( {
	cwd: ROOT_DIRECTORY,
	branch: RELEASE_BRANCH,
	version: latestVersion,
	changes: versionChangelog
} );

if ( errors.length ) {
	console.error( 'Aborted due to errors.\n' + errors.map( message => `* ${ message }` ).join( '\n' ) );

	process.exit( 1 );
}

const githubToken = await releaseTools.provideToken();

const tasks = new Listr( [
	{
		title: 'Pushing changes.',
		task: () => {
			return releaseTools.push( {
				cwd: ROOT_DIRECTORY,
				releaseBranch: RELEASE_BRANCH,
				version: latestVersion
			} );
		}
	},
	{
		title: 'Creating the release page.',
		task: async ( _, task ) => {
			const releaseUrl = await releaseTools.createGithubRelease( {
				cwd: ROOT_DIRECTORY,
				token: githubToken,
				version: latestVersion,
				description: versionChangelog
			} );

			task.output = `Release page: ${ releaseUrl }`;
		},
		options: {
			persistentOutput: true
		}
	}
] );

try {
	await tasks.run();
} catch ( err ) {
	process.exitCode = 1;

	console.log( '' );
	console.error( err );
}
