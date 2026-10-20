/**
 * @license Copyright (c) 2026-2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import upath from 'upath';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	DOCS_URL_PATTERN,
	SNIPPETS,
	applyDocsTracking,
	findDocsTrackingUpdates,
	getTrackingParameters
} from '../../../scripts/skills/utils/docstracking.js';

describe( 'scripts/skills/utils/docstracking', () => {
	describe( 'getTrackingParameters()', () => {
		it( 'should return the general parameters first, then the parameter that names the skill', () => {
			expect( Object.entries( getTrackingParameters( 'ckeditor-update' ) ) ).to.deep.equal( [
				[ 'utm_source', 'ckeditor-skill' ],
				[ 'utm_medium', 'ai-agent' ],
				[ 'utm_content', 'ckeditor-update' ]
			] );
		} );
	} );

	describe( 'DOCS_URL_PATTERN', () => {
		for ( const [ context, text, urls ] of [
			[ 'an autolink', '<https://ckeditor.com/docs/a.html>', [ 'https://ckeditor.com/docs/a.html' ] ],
			[ 'an inline link', '[A](https://ckeditor.com/docs/a.html)', [ 'https://ckeditor.com/docs/a.html' ] ],
			[
				'the text and the target of a link',
				'[https://ckeditor.com/docs/a.html](https://ckeditor.com/docs/b.html)',
				[ 'https://ckeditor.com/docs/a.html', 'https://ckeditor.com/docs/b.html' ]
			],
			[ 'a code span', '`https://ckeditor.com/docs/a.html`', [ 'https://ckeditor.com/docs/a.html' ] ],
			[ 'a table cell', '|https://ckeditor.com/docs/a.html|', [ 'https://ckeditor.com/docs/a.html' ] ],
			[
				'quotes',
				'fetch( \'https://ckeditor.com/docs/a.html\' ) and "https://ckeditor.com/docs/b.html"',
				[ 'https://ckeditor.com/docs/a.html', 'https://ckeditor.com/docs/b.html' ]
			],
			[ 'the end of a sentence', 'See https://ckeditor.com/docs/a.html.', [ 'https://ckeditor.com/docs/a.html' ] ],
			[ 'bold text', '**https://ckeditor.com/docs/a.html**', [ 'https://ckeditor.com/docs/a.html' ] ]
		] ) {
			it( `should find a docs URL in ${ context }`, () => {
				expect( text.match( DOCS_URL_PATTERN ) ).to.deep.equal( urls );
			} );
		}

		it( 'should keep the query, the fragment, and the placeholders of a docs URL', () => {
			const url = 'https://ckeditor.com/docs/ckeditor5/latest/updating/guides/update-to-{N}.html?a=1&b=2#section';

			expect( `<${ url }>`.match( DOCS_URL_PATTERN ) ).to.deep.equal( [ url ] );
		} );

		it( 'should not find the URLs outside the docs', () => {
			const text = 'https://ckeditor.com/llms.txt https://cdn.ckeditor.com/ckeditor5/48.0.0/ckeditor5.js ' +
				'https://github.com/ckeditor/skills';

			expect( text.match( DOCS_URL_PATTERN ) ).to.equal( null );
		} );
	} );

	describe( 'applyDocsTracking()', () => {
		const QUERY = 'utm_source=ckeditor-skill&utm_medium=ai-agent&utm_content=ckeditor';

		const templates = new Map( [
			[ 'summary', 'Add `?{{query}}` to every docs URL.\n' ],
			[ 'rules', 'Put `?{{query}}` before a fragment, for example `…/a.md?{{query}}#section`.\n' ]
		] );

		function apply( content, skillName = 'ckeditor' ) {
			return applyDocsTracking( content, { skillName, templates, file: 'skills/ckeditor/SKILL.md' } );
		}

		describe( 'docs URLs', () => {
			it( 'should add the tracking parameters to a docs URL', () => {
				expect( apply( 'See <https://ckeditor.com/docs/ckeditor5/latest/index.html>.' ) )
					.to.equal( `See <https://ckeditor.com/docs/ckeditor5/latest/index.html?${ QUERY }>.` );
			} );

			it( 'should name the skill in the tracking parameters', () => {
				expect( apply( '<https://ckeditor.com/docs/a.html>', 'ckeditor-update' ) ).to.equal(
					'<https://ckeditor.com/docs/a.html?utm_source=ckeditor-skill&utm_medium=ai-agent&utm_content=ckeditor-update>'
				);
			} );

			it( 'should add the tracking parameters before the fragment', () => {
				expect( apply( '[A](https://ckeditor.com/docs/a.html#section)' ) )
					.to.equal( `[A](https://ckeditor.com/docs/a.html?${ QUERY }#section)` );
			} );

			it( 'should keep the other query parameters', () => {
				expect( apply( '<https://ckeditor.com/docs/a.html?b=1&c=2#section>' ) )
					.to.equal( `<https://ckeditor.com/docs/a.html?b=1&c=2&${ QUERY }#section>` );
			} );

			it( 'should replace the tracking parameters that are out of date', () => {
				expect( apply( [
					'<https://ckeditor.com/docs/a.html?utm_source=ckeditor-skill&utm_medium=ai-agent>',
					'<https://ckeditor.com/docs/b.html?utm_source=ckeditor-skill&utm_medium=ai-agent&utm_content=ckeditor-update>',
					'<https://ckeditor.com/docs/c.html?utm_content=ckeditor&utm_campaign=x&utm_source=ckeditor-skill>'
				].join( '\n' ) ) ).to.equal( [
					`<https://ckeditor.com/docs/a.html?${ QUERY }>`,
					`<https://ckeditor.com/docs/b.html?${ QUERY }>`,
					`<https://ckeditor.com/docs/c.html?${ QUERY }>`
				].join( '\n' ) );
			} );

			it( 'should move a query after the fragment to its place before the fragment', () => {
				expect( apply( '<https://ckeditor.com/docs/a.html#section?b=1&utm_source=ckeditor-skill>' ) )
					.to.equal( `<https://ckeditor.com/docs/a.html?b=1&${ QUERY }#section>` );
			} );

			it( 'should keep the placeholders in the path of a docs URL', () => {
				expect( apply( '`https://ckeditor.com/docs/ckeditor5/latest/updating/guides/update-to-{N}.html`' ) )
					.to.equal( `\`https://ckeditor.com/docs/ckeditor5/latest/updating/guides/update-to-{N}.html?${ QUERY }\`` );
			} );

			it( 'should not add the tracking parameters after the punctuation, a quote, or the emphasis', () => {
				expect( apply( 'See https://ckeditor.com/docs/a.html, \'https://ckeditor.com/docs/b.html\'.' ) )
					.to.equal( `See https://ckeditor.com/docs/a.html?${ QUERY }, 'https://ckeditor.com/docs/b.html?${ QUERY }'.` );

				expect( apply( '**https://ckeditor.com/docs/a.html**' ) )
					.to.equal( `**https://ckeditor.com/docs/a.html?${ QUERY }**` );
			} );

			it( 'should not change the URLs outside the docs, also when they have tracking parameters', () => {
				const content = [
					'<https://github.com/ckeditor/skills>',
					'`https://cdn.ckeditor.com/ckeditor5/<VERSION>/ckeditor5.js`',
					'<https://ckeditor5.mcp.kapa.ai/>',
					'<https://ckeditor.com/llms.txt>',
					'<https://ckeditor.com/pricing/?utm_source=newsletter&utm_medium=email>'
				].join( '\n' );

				expect( apply( content ) ).to.equal( content );
			} );
		} );

		describe( 'tracking queries', () => {
			it( 'should replace the tracking queries outside the URLs', () => {
				expect( apply( [
					'Add `?utm_source=ckeditor-skill&utm_medium=ai-agent` to every docs URL.',
					'Add ?utm_source=ckeditor-skill&utm_medium=ai-agent&utm_content=ckeditor-update to every docs URL.',
					'For example, `…/editor-types.md?utm_source=ckeditor-skill#section`.'
				].join( '\n' ) ) ).to.equal( [
					`Add \`?${ QUERY }\` to every docs URL.`,
					`Add ?${ QUERY } to every docs URL.`,
					`For example, \`…/editor-types.md?${ QUERY }#section\`.`
				].join( '\n' ) );
			} );

			it( 'should not change a query without the tracking parameters', () => {
				const content = 'Run `npm view ckeditor5 version` and open `…/editor-types.md?view=full`.';

				expect( apply( content ) ).to.equal( content );
			} );
		} );

		describe( 'snippets', () => {
			it( 'should replace the content of every snippet with its template', () => {
				expect( apply( [
					'# Skill',
					'',
					'<!-- docs-tracking:summary -->',
					'A summary that is out of date.',
					'<!-- /docs-tracking:summary -->',
					'',
					'<!-- docs-tracking:rules -->',
					'<!-- /docs-tracking:rules -->',
					'',
					'The end.',
					''
				].join( '\n' ) ) ).to.equal( [
					'# Skill',
					'',
					'<!-- docs-tracking:summary -->',
					`Add \`?${ QUERY }\` to every docs URL.`,
					'<!-- /docs-tracking:summary -->',
					'',
					'<!-- docs-tracking:rules -->',
					`Put \`?${ QUERY }\` before a fragment, for example \`…/a.md?${ QUERY }#section\`.`,
					'<!-- /docs-tracking:rules -->',
					'',
					'The end.',
					''
				].join( '\n' ) );
			} );

			it( 'should add the tracking parameters to the docs URLs in a template', () => {
				const content = applyDocsTracking( '<!-- docs-tracking:summary -->\n<!-- /docs-tracking:summary -->', {
					skillName: 'ckeditor',
					templates: new Map( [ [ 'summary', 'See <https://ckeditor.com/docs/a.html>.' ] ] ),
					file: 'skills/ckeditor/SKILL.md'
				} );

				expect( content ).to.equal( [
					'<!-- docs-tracking:summary -->',
					`See <https://ckeditor.com/docs/a.html?${ QUERY }>.`,
					'<!-- /docs-tracking:summary -->'
				].join( '\n' ) );
			} );

			it( 'should throw for an unknown snippet', () => {
				expect( () => apply( '<!-- docs-tracking:other -->\n<!-- /docs-tracking:other -->' ) ).toThrow(
					'The "skills/ckeditor/SKILL.md" file includes an unknown "other" docs tracking snippet. ' +
					'The known snippets are "summary", "rules".'
				);
			} );

			for ( const [ problem, content ] of [
				[ 'a start marker without an end marker', '<!-- docs-tracking:summary -->\nText.' ],
				[ 'an end marker without a start marker', 'Text.\n<!-- /docs-tracking:summary -->' ],
				[ 'markers with different names', '<!-- docs-tracking:summary -->\n<!-- /docs-tracking:rules -->' ],
				[ 'a marker with a typo', '<!--docs-tracking:summary-->\n<!-- /docs-tracking:summary -->' ],
				[ 'a marker that is not on its own line', 'Text. <!-- docs-tracking:summary -->\n<!-- /docs-tracking:summary -->' ],
				[
					'a snippet inside a different snippet',
					[
						'<!-- docs-tracking:summary -->',
						'<!-- docs-tracking:rules -->',
						'<!-- /docs-tracking:rules -->',
						'<!-- /docs-tracking:summary -->'
					].join( '\n' )
				]
			] ) {
				it( `should throw for ${ problem }`, () => {
					expect( () => apply( content ) ).toThrow(
						'The "skills/ckeditor/SKILL.md" file has a docs tracking marker without a pair. ' +
						'A snippet starts with a "<!-- docs-tracking:NAME -->" line and ends with a "<!-- /docs-tracking:NAME -->" line.'
					);
				} );
			}
		} );

		it( 'should not change the content when it applies the tracking for the second time', () => {
			const content = apply( [
				'<!-- docs-tracking:summary -->',
				'<!-- /docs-tracking:summary -->',
				'See <https://ckeditor.com/docs/a.html#section> and [B](https://ckeditor.com/docs/b.html?c=1).',
				'Add `?utm_source=ckeditor-skill` to `…/editor-types.md#section`.'
			].join( '\n' ) );

			expect( apply( content ) ).to.equal( content );
		} );
	} );

	describe( 'findDocsTrackingUpdates()', () => {
		let cwd;

		beforeEach( async () => {
			cwd = await fs.mkdtemp( upath.join( os.tmpdir(), 'ckeditor-skills-' ) );

			for ( const { name, template } of SNIPPETS ) {
				await writeFile( template, `The ${ name }: \`?{{query}}\`.\n` );
			}
		} );

		afterEach( async () => {
			await fs.rm( cwd, { recursive: true, force: true } );
		} );

		it( 'should return the updated content of the files that are out of date, with the parameters of their skill', async () => {
			await createSkill( 'ckeditor' );
			await createSkill( 'ckeditor-update' );
			await writeFile( 'skills/ckeditor-update/references/nested/guide.md', 'See <https://ckeditor.com/docs/a.html>.\n' );

			const updates = await findDocsTrackingUpdates( { cwd } );

			expect( updates.map( ( { file } ) => file ) ).to.deep.equal( [
				'skills/ckeditor/SKILL.md',
				'skills/ckeditor/references/documentation-access.md',
				'skills/ckeditor-update/SKILL.md',
				'skills/ckeditor-update/references/documentation-access.md',
				'skills/ckeditor-update/references/nested/guide.md'
			] );

			expect( updates[ 0 ].content ).to.equal( skillFile( 'ckeditor', [
				'<!-- docs-tracking:summary -->',
				`The summary: \`?${ getQuery( 'ckeditor' ) }\`.`,
				'<!-- /docs-tracking:summary -->'
			] ) );

			expect( updates[ 3 ].content ).to.equal( [
				'## Tag the docs requests',
				'',
				'<!-- docs-tracking:rules -->',
				`The rules: \`?${ getQuery( 'ckeditor-update' ) }\`.`,
				'<!-- /docs-tracking:rules -->',
				''
			].join( '\n' ) );

			expect( updates[ 4 ].content ).to.equal( `See <https://ckeditor.com/docs/a.html?${ getQuery( 'ckeditor-update' ) }>.\n` );
		} );

		it( 'should return no updates when the files are up to date', async () => {
			await createSkill( 'ckeditor' );

			for ( const { file, content } of await findDocsTrackingUpdates( { cwd } ) ) {
				await writeFile( file, content );
			}

			expect( await findDocsTrackingUpdates( { cwd } ) ).to.deep.equal( [] );
		} );

		it( 'should ignore the files that are not markdown files', async () => {
			await createSkill( 'ckeditor' );
			await writeFile( 'skills/ckeditor/scripts/fetch.sh', 'curl https://ckeditor.com/docs/a.html\n' );

			const files = ( await findDocsTrackingUpdates( { cwd } ) ).map( ( { file } ) => file );

			expect( files ).to.not.include( 'skills/ckeditor/scripts/fetch.sh' );
		} );

		it( 'should throw when a skill does not include a snippet in its file', async () => {
			await createSkill( 'ckeditor' );
			await createSkill( 'ckeditor-update' );

			// The summary is in the reference file, not in the skill file.
			await writeFile( 'skills/ckeditor/SKILL.md', skillFile( 'ckeditor', [ 'No summary.' ] ) );
			await writeFile( 'skills/ckeditor/references/documentation-access.md', [
				'<!-- docs-tracking:summary -->',
				'<!-- /docs-tracking:summary -->',
				'<!-- docs-tracking:rules -->',
				'<!-- /docs-tracking:rules -->',
				''
			].join( '\n' ) );
			await fs.rm( upath.join( cwd, 'skills/ckeditor-update/references/documentation-access.md' ) );

			await expect( findDocsTrackingUpdates( { cwd } ) ).rejects.toThrow(
				'Expected every skill to include the docs tracking snippets, but these are missing:\n' +
				'* skills/ckeditor/SKILL.md: "summary"\n' +
				'* skills/ckeditor-update/references/documentation-access.md: "rules"\n' +
				'Add the "<!-- docs-tracking:NAME -->" and "<!-- /docs-tracking:NAME -->" lines to each file. ' +
				'Then run "pnpm skills:update-docs-tracking".'
			);
		} );

		it( 'should throw when a template has an unknown placeholder', async () => {
			const { template } = SNIPPETS[ 0 ];

			await createSkill( 'ckeditor' );
			await writeFile( template, 'Add `?{{qeury}}` to every docs URL.\n' );

			await expect( findDocsTrackingUpdates( { cwd } ) ).rejects.toThrow(
				`The "${ template }" template has an unknown placeholder. The only placeholder is "{{query}}".`
			);
		} );

		/**
		 * Creates a skill with empty snippets in the skill file and in the reference file, so that both are out of date.
		 */
		async function createSkill( name ) {
			await writeFile( `skills/${ name }/SKILL.md`, skillFile( name, [
				'<!-- docs-tracking:summary -->',
				'<!-- /docs-tracking:summary -->'
			] ) );

			await writeFile( `skills/${ name }/references/documentation-access.md`, [
				'## Tag the docs requests',
				'',
				'<!-- docs-tracking:rules -->',
				'<!-- /docs-tracking:rules -->',
				''
			].join( '\n' ) );
		}

		function skillFile( name, bodyLines ) {
			return [
				'---',
				`name: ${ name }`,
				`description: Install and configure ${ name } in any JavaScript project.`,
				'---',
				'',
				...bodyLines,
				''
			].join( '\n' );
		}

		function getQuery( skillName ) {
			return `utm_source=ckeditor-skill&utm_medium=ai-agent&utm_content=${ skillName }`;
		}

		async function writeFile( file, content ) {
			const filePath = upath.join( cwd, file );

			await fs.mkdir( upath.dirname( filePath ), { recursive: true } );
			await fs.writeFile( filePath, content, 'utf-8' );
		}
	} );
} );
