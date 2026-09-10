#!/usr/bin/env node

/**
 * @license Copyright (c) 2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import fs from 'node:fs/promises';
import upath from 'upath';
import { Octokit } from '@octokit/rest';
import { getLastFromChangelog } from '@ckeditor/ckeditor5-dev-release-tools';
import { getGithubToken } from '../release/utils/githubtoken.js';

// Tells CI whether the changelog announces a version without a GitHub release yet. Exit codes:
// * 0 when it does,
// * 1 when there is nothing to release (the CI job then ends quietly),
// * 2 when the check could not be made.

const ROOT_DIRECTORY = upath.join( import.meta.dirname, '..', '..' );

try {
	const packageJson = JSON.parse( await fs.readFile( upath.join( ROOT_DIRECTORY, 'package.json' ), 'utf-8' ) );
	const repositoryUrl = packageJson.repository.url.replace( /\.git$/, '' );
	const [ , repositoryOwner, repositoryName ] = new URL( repositoryUrl ).pathname.split( '/' );

	const changelogVersion = getLastFromChangelog( ROOT_DIRECTORY );

	if ( !changelogVersion ) {
		console.error( 'Cannot find any version in the changelog. Nothing to release.' );

		process.exit( 1 );
	}

	const githubToken = await getGithubToken( { cwd: ROOT_DIRECTORY } );

	if ( await isGithubVersionAvailable( githubToken, repositoryOwner, repositoryName, changelogVersion ) ) {
		console.log( `The project is ready to release v${ changelogVersion }.` );
	} else {
		console.error( `The proposed changelog version (${ changelogVersion }) is already taken.` );

		process.exit( 1 );
	}
} catch ( error ) {
	// An uncaught error would end the process with code 1, which is reserved for "nothing to release".
	console.error( error );

	process.exit( 2 );
}

/**
 * Checks whether the version has no GitHub release yet. A missing tag is answered with an error, so any failed
 * request counts as "no release".
 *
 * @param {string} githubToken
 * @param {string} repositoryOwner
 * @param {string} repositoryName
 * @param {string} version
 * @returns {Promise.<boolean>}
 */
async function isGithubVersionAvailable( githubToken, repositoryOwner, repositoryName, version ) {
	const octokit = new Octokit( {
		auth: githubToken
	} );

	try {
		await octokit.request( 'GET /repos/{owner}/{repo}/releases/tags/{tag}', {
			owner: repositoryOwner,
			repo: repositoryName,
			tag: `v${ version }`,
			headers: {
				'X-GitHub-Api-Version': '2022-11-28'
			}
		} );

		return false;
	} catch {
		return true;
	}
}
