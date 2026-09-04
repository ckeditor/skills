/**
 * @license Copyright (c) 2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import { load } from 'js-yaml';
import { assert } from './assert.js';

// The YAML front matter block that opens a `SKILL.md` file. There may be nothing between the fences.
const FRONT_MATTER_REGEXP = /^---\r?\n(?:[\s\S]*?\r?\n)?---/;

/**
 * Returns the front matter block that opens a `SKILL.md` file, including the `---` fences.
 *
 * @param {string} content Content of a `SKILL.md` file.
 * @param {string} file Path to the file, used in the error message.
 * @returns {string}
 */
export function getFrontMatter( content, file ) {
	const frontMatter = content.match( FRONT_MATTER_REGEXP )?.[ 0 ];

	assert( frontMatter !== undefined, `The "${ file }" file does not start with a YAML front matter block.` );

	return frontMatter;
}

/**
 * Returns the front matter of a `SKILL.md` file parsed into an object.
 *
 * @param {string} content Content of a `SKILL.md` file.
 * @param {string} file Path to the file, used in the error messages.
 * @returns {object}
 */
export function parseFrontMatter( content, file ) {
	// Only the closing fence is dropped: the parser reads the opening one as the document start marker,
	// and keeping it makes the reported line numbers match the file.
	const yaml = getFrontMatter( content, file ).split( /\r?\n/ ).slice( 0, -1 ).join( '\n' );
	let frontMatter;

	try {
		frontMatter = load( yaml );
	} catch ( error ) {
		const position = error.mark ? ` (line ${ error.mark.line + 1 })` : '';

		throw new Error(
			`The front matter of the "${ file }" file is not valid YAML: ${ error.reason || error.message }${ position }.`
		);
	}

	// A YAML mapping loads as a plain object. A scalar, a sequence, or an empty document does not.
	assert(
		typeof frontMatter === 'object' && frontMatter !== null && !Array.isArray( frontMatter ),
		`The front matter of the "${ file }" file does not have the expected shape: a YAML mapping.`
	);

	return frontMatter;
}
