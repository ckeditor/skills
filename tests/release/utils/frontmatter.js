/**
 * @license Copyright (c) 2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import { describe, expect, it } from 'vitest';
import { getFrontMatter, parseFrontMatter } from '../../../scripts/release/utils/frontmatter.js';

const FILE = 'skills/ckeditor/SKILL.md';

describe( 'scripts/release/utils/frontmatter', () => {
	describe( 'getFrontMatter()', () => {
		it( 'should return the front matter block including the fences', () => {
			expect( getFrontMatter( '---\nname: ckeditor\n---\n\n# ckeditor\n', FILE ) ).to.equal( '---\nname: ckeditor\n---' );
		} );

		it( 'should throw when the file does not start with the front matter', () => {
			expect( () => getFrontMatter( '# ckeditor\n\nNo front matter here.\n', FILE ) ).toThrow(
				'The "skills/ckeditor/SKILL.md" file does not start with a YAML front matter block.'
			);
		} );
	} );

	describe( 'parseFrontMatter()', () => {
		it( 'should return the front matter as an object', () => {
			const content = '---\nname: ckeditor\nmetadata:\n  version: 1.0.0\n---\n\n# ckeditor\n';

			expect( parseFrontMatter( content, FILE ) ).to.deep.equal( {
				name: 'ckeditor',
				metadata: { version: '1.0.0' }
			} );
		} );

		it( 'should parse a file with CRLF line endings', () => {
			const content = '---\r\nname: ckeditor\r\nmetadata:\r\n  version: 1.0.0\r\n---\r\n\r\n# ckeditor\r\n';

			expect( parseFrontMatter( content, FILE ) ).to.deep.equal( {
				name: 'ckeditor',
				metadata: { version: '1.0.0' }
			} );
		} );

		it( 'should throw when the file does not start with the front matter', () => {
			expect( () => parseFrontMatter( '# ckeditor\n\nNo front matter here.\n', FILE ) ).toThrow(
				'The "skills/ckeditor/SKILL.md" file does not start with a YAML front matter block.'
			);
		} );

		it( 'should throw when the front matter is not valid YAML, pointing at the line in the file', () => {
			// The reason comes from the parser, so only its presence is asserted.
			expect( () => parseFrontMatter( '---\nname: ckeditor\nname: other\n---\n', FILE ) ).toThrow(
				/^The front matter of the "skills\/ckeditor\/SKILL\.md" file is not valid YAML: .+ \(line 3\)\.$/
			);
		} );

		it( 'should throw when the front matter is not valid YAML and the parser reports no position', () => {
			// The `...` marker ends the document, so the parser finds a second one and rejects the stream as a whole.
			expect( () => parseFrontMatter( '---\nname: ckeditor\n...\ndescription: A skill.\n---\n', FILE ) ).toThrow(
				/^The front matter of the "skills\/ckeditor\/SKILL\.md" file is not valid YAML: [^()]+\.$/
			);
		} );

		for ( const [ shape, content ] of [
			[ 'empty', '---\n---\n' ],
			[ 'a blank line', '---\n\n---\n' ],
			[ 'a list', '---\n- ckeditor\n---\n' ],
			[ 'a scalar', '---\nckeditor\n---\n' ]
		] ) {
			it( `should throw when the front matter is ${ shape }`, () => {
				expect( () => parseFrontMatter( content, FILE ) ).toThrow(
					'The front matter of the "skills/ckeditor/SKILL.md" file does not have the expected shape: a YAML mapping.'
				);
			} );
		}
	} );
} );
