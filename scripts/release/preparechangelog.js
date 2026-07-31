#!/usr/bin/env node

/**
 * @license Copyright (c) 2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import { parseArgs } from 'node:util';
import upath from 'upath';
import { generateChangelogForSingleRepository } from '@ckeditor/ckeditor5-dev-changelog';

const ROOT_DIRECTORY = upath.join( import.meta.dirname, '..', '..' );

// Issues in these repositories are not readable for everyone, so they are not linked in the public changelog.
const PRIVATE_REPOSITORIES = [
	'ckeditor/ckeditor5-internal',
	'cksource/'
];

const { values: options } = parseArgs( {
	options: {
		date: {
			type: 'string',
			default: undefined
		},
		'dry-run': {
			type: 'boolean',
			default: false
		}
	}
} );

const changelogOptions = {
	cwd: ROOT_DIRECTORY,
	linkFilter: url => !PRIVATE_REPOSITORIES.some( repository => url.includes( repository ) ),
	disableFilesystemOperations: options[ 'dry-run' ]
};

if ( options.date ) {
	changelogOptions.date = options.date;
}

generateChangelogForSingleRepository( changelogOptions )
	.then( maybeChangelog => {
		if ( maybeChangelog ) {
			console.log( maybeChangelog );
		}
	} );
