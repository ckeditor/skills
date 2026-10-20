#!/usr/bin/env node

/**
 * @license Copyright (c) 2026-2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/*

Usage:
pnpm skills:update-docs-tracking

Copies the tracking rules from the templates in `scripts/skills/templates/` into every skill, and adds the tracking
parameters of each skill to its docs URLs. Run it after a change in a skill or in a template. Then review the changes.

To change the tags, edit `getTrackingParameters()` in `scripts/skills/utils/docstracking.js`. Then run the script.
Also update the expected values in `tests/skills/utils/docstracking.js`.

To change the rules, edit the templates. Then run the script.

To add a skill, add an empty `summary` snippet to its `SKILL.md` and an empty `rules` snippet to its
`references/documentation-access.md`. A snippet is a `<!-- docs-tracking:NAME -->` line and a
`<!-- /docs-tracking:NAME -->` line. Then run the script. If a snippet is missing, the script and CI name the file.

*/

import fs from 'node:fs/promises';
import upath from 'upath';
import { ROOT_DIRECTORY } from '../constants.js';
import { quote } from '../release/utils/assert.js';
import { findDocsTrackingUpdates } from './utils/docstracking.js';

try {
	const updates = await findDocsTrackingUpdates( { cwd: ROOT_DIRECTORY } );

	for ( const { file, content } of updates ) {
		await fs.writeFile( upath.join( ROOT_DIRECTORY, file ), content, 'utf-8' );
	}

	if ( updates.length ) {
		console.log( `Updated ${ quote( updates.map( ( { file } ) => file ) ) }.` );
	} else {
		console.log( 'The docs tracking in the skills is up to date.' );
	}
} catch ( error ) {
	process.exitCode = 1;

	console.error( error );
}
