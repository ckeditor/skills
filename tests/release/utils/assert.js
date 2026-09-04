/**
 * @license Copyright (c) 2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import { describe, expect, it } from 'vitest';
import { assert, quote } from '../../../scripts/release/utils/assert.js';

describe( 'scripts/release/utils/assert', () => {
	describe( 'assert()', () => {
		it( 'should do nothing when the condition holds', () => {
			expect( assert( true, 'Never thrown.' ) ).to.be.undefined;
		} );

		it( 'should throw the message when the condition does not hold', () => {
			expect( () => assert( false, 'Something is wrong.' ) ).toThrow( 'Something is wrong.' );
		} );

		it( 'should throw a plain error, so that the release scripts print nothing but the message and the stack', () => {
			let error;

			try {
				assert( false, 'Something is wrong.' );
			} catch ( caughtError ) {
				error = caughtError;
			}

			expect( error ).to.be.an.instanceOf( Error );
			expect( error.constructor ).to.equal( Error );
			expect( error.message ).to.equal( 'Something is wrong.' );
		} );
	} );

	describe( 'quote()', () => {
		it( 'should quote every name and separate them with commas', () => {
			expect( quote( [ 'SKILL.md', 'references/usage.md' ] ) ).to.equal( '"SKILL.md", "references/usage.md"' );
		} );

		it( 'should describe no names as nothing', () => {
			expect( quote( [] ) ).to.equal( 'nothing' );
		} );
	} );
} );
