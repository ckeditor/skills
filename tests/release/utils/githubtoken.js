/**
 * @license Copyright (c) 2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import * as releaseTools from '@ckeditor/ckeditor5-dev-release-tools';
import { getGithubToken } from '../../../scripts/release/utils/githubtoken.js';

// Getting the token reaches GitHub or a terminal, so the release tools are mocked.
vi.mock( '@ckeditor/ckeditor5-dev-release-tools', () => ( {
	validateGithubToken: vi.fn(),
	provideToken: vi.fn()
} ) );

describe( 'scripts/release/utils/githubtoken', () => {
	afterEach( () => {
		vi.unstubAllEnvs();
		vi.resetAllMocks();
	} );

	describe( 'getGithubToken()', () => {
		it( 'should validate the token from the environment and return the validated one', async () => {
			vi.stubEnv( 'CKE5_RELEASE_TOKEN', ' ghp_token ' );
			releaseTools.validateGithubToken.mockResolvedValue( 'ghp_token' );

			expect( await getGithubToken( { cwd: '/repo' } ) ).to.equal( 'ghp_token' );
			expect( releaseTools.validateGithubToken ).toHaveBeenCalledWith( ' ghp_token ', { cwd: '/repo' } );
			expect( releaseTools.provideToken ).not.toHaveBeenCalled();
		} );

		it( 'should fail when the token from the environment is invalid', async () => {
			vi.stubEnv( 'CKE5_RELEASE_TOKEN', 'bad' );
			releaseTools.validateGithubToken.mockRejectedValue( new Error( 'GitHub API request failed with HTTP 401.' ) );

			await expect( getGithubToken( { cwd: '/repo' } ) ).rejects.toThrow( 'HTTP 401' );
			expect( releaseTools.provideToken ).not.toHaveBeenCalled();
		} );

		it( 'should ask for the token when the environment does not provide one', async () => {
			vi.stubEnv( 'CKE5_RELEASE_TOKEN', undefined );
			releaseTools.provideToken.mockResolvedValue( 'typed_token' );

			expect( await getGithubToken( { cwd: '/repo' } ) ).to.equal( 'typed_token' );
			expect( releaseTools.provideToken ).toHaveBeenCalledWith( { cwd: '/repo' } );
			expect( releaseTools.validateGithubToken ).not.toHaveBeenCalled();
		} );

		it( 'should ask for the token when the environment provides an empty one', async () => {
			vi.stubEnv( 'CKE5_RELEASE_TOKEN', '' );
			releaseTools.provideToken.mockResolvedValue( 'typed_token' );

			expect( await getGithubToken( { cwd: '/repo' } ) ).to.equal( 'typed_token' );
			expect( releaseTools.validateGithubToken ).not.toHaveBeenCalled();
		} );
	} );
} );
