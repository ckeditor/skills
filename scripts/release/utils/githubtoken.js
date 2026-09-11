/**
 * @license Copyright (c) 2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import * as releaseTools from '@ckeditor/ckeditor5-dev-release-tools';

/**
 * Returns the GitHub token: `CKE5_RELEASE_TOKEN` from the environment, validated against the repository (rejects when
 * invalid), or one typed at the prompt, which validates on its own.
 *
 * @param {object} options
 * @param {string} options.cwd Root of the repository.
 * @returns {Promise.<string>}
 */
export async function getGithubToken( { cwd } ) {
	if ( process.env.CKE5_RELEASE_TOKEN ) {
		return releaseTools.validateGithubToken( process.env.CKE5_RELEASE_TOKEN, { cwd } );
	}

	return releaseTools.provideToken( { cwd } );
}
