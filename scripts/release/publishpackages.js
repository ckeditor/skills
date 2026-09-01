#!/usr/bin/env node

/**
 * @license Copyright (c) 2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import { parseArgs } from 'node:util';
import { Listr } from 'listr2';
import upath from 'upath';
import * as releaseTools from '@ckeditor/ckeditor5-dev-release-tools';
import { verifyDiscoveryArtifacts } from './utils/discoveryartifacts.js';

const ROOT_DIRECTORY = upath.join( import.meta.dirname, '..', '..' );
const RELEASE_BRANCH = 'main';

const { values: options } = parseArgs( {
	options: {
		verbose: {
			type: 'boolean',
			default: false
		}
	}
} );

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
		title: 'Verifying the discovery artifacts.',
		task: async ( _, task ) => {
			await verifyDiscoveryArtifacts( {
				cwd: ROOT_DIRECTORY,
				version: latestVersion
			} );

			// The upload procedure to ckeditor.com is not established yet. Once it is, this task should
			// upload the contents of the "release/" directory to "ckeditor.com/.well-known/agent-skills/".
			task.output = 'Automatic upload to "ckeditor.com/.well-known/agent-skills/" is not implemented yet. ' +
				'The verified artifacts are ready in the "release/" directory.';
		},
		options: {
			persistentOutput: true
		}
	},
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
], {
	renderer: options.verbose ? 'verbose' : 'default'
} );

try {
	await tasks.run();
} catch ( err ) {
	process.exitCode = 1;

	console.log( '' );
	console.error( err );
}
