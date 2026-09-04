/**
 * @license Copyright (c) 2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import fs from 'node:fs/promises';
import upath from 'upath';
import { assert } from './assert.js';
import { parseFrontMatter } from './frontmatter.js';

export const SKILLS_DIRECTORY = 'skills';
export const SKILL_FILE = 'SKILL.md';

// The discovery specification constraints for a skill name: lowercase alphanumeric characters and hyphens,
// with no leading, trailing, or consecutive hyphens.
const SKILL_NAME_FORMAT_REGEXP = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;

/**
 * Returns paths (relative to `cwd`) to the `SKILL.md` file of every skill in the repository, sorted by the skill
 * directory.
 *
 * @param {object} options
 * @param {string} options.cwd Root of the repository.
 * @returns {Promise.<Array.<string>>}
 */
export async function findSkillFiles( { cwd } ) {
	const directoryEntries = await fs.readdir( upath.join( cwd, SKILLS_DIRECTORY ), { withFileTypes: true } );
	const directoryNames = [];
	const skillFiles = [];

	// A symbolic link could pull content from elsewhere into a release, so it is rejected rather than followed.
	for ( const entry of directoryEntries ) {
		assert(
			!entry.isSymbolicLink(),
			`The "${ upath.join( SKILLS_DIRECTORY, entry.name ) }" entry is a symbolic link, which must not be released. ` +
			'Replace it with the actual directory or file.'
		);

		if ( entry.isDirectory() ) {
			directoryNames.push( entry.name );
		}
	}

	// Sorted, so that the order does not depend on the file system.
	for ( const directoryName of directoryNames.sort() ) {
		const file = upath.join( SKILLS_DIRECTORY, directoryName, SKILL_FILE );
		const stats = await fs.lstat( upath.join( cwd, file ) ).catch( error => {
			// Only a missing file is a legitimate outcome here.
			if ( error.code !== 'ENOENT' ) {
				throw error;
			}

			return null;
		} );

		assert(
			!stats?.isSymbolicLink(),
			`The "${ file }" file is a symbolic link, which must not be released. Replace it with the actual file.`
		);

		// Every directory is a skill, so a missing skill file is a mistake (a `skill.md`, for one) rather than a draft.
		assert(
			stats?.isFile(),
			`Expected the "${ upath.join( SKILLS_DIRECTORY, directoryName ) }" directory to contain a "${ SKILL_FILE }" file.`
		);

		skillFiles.push( file );
	}

	assert( skillFiles.length > 0, `Could not find any "${ SKILL_FILE }" file in the "${ SKILLS_DIRECTORY }" directory.` );

	return skillFiles;
}

/**
 * Returns the discovery metadata of every skill in the repository, sorted by the skill name (which is required to
 * match the skill directory). The metadata is validated against the discovery specification, so that a release
 * cannot publish an index installers reject.
 *
 * @param {object} options
 * @param {string} options.cwd Root of the repository.
 * @returns {Promise.<Array.<{ file: string, directory: string, name: string, description: string }>>}
 */
export async function findSkills( { cwd } ) {
	const skills = [];

	for ( const file of await findSkillFiles( { cwd } ) ) {
		const { name, description } = parseFrontMatter( await fs.readFile( upath.join( cwd, file ), 'utf-8' ), file );
		const skill = {
			file,
			directory: upath.dirname( file ),
			name,
			description
		};

		validateSkill( skill );
		skills.push( skill );
	}

	return skills;
}

/**
 * Checks the skill metadata against the discovery specification. The name is also required to match the skill
 * directory, as installers use it as the identifier.
 *
 * @param {{ file: string, directory: string, name: unknown, description: unknown }} skill
 */
function validateSkill( { file, directory, name, description } ) {
	const directoryName = upath.basename( directory );

	assert(
		isNonEmptyString( name ),
		`Expected the "${ file }" file to store a non-empty "name" string in its front matter.`
	);

	assert(
		name.length <= MAX_NAME_LENGTH && SKILL_NAME_FORMAT_REGEXP.test( name ),
		`The "${ name }" skill name in the "${ file }" file does not follow the discovery specification: ` +
		`up to ${ MAX_NAME_LENGTH } lowercase alphanumeric characters and hyphens, ` +
		'with no leading, trailing, or consecutive hyphens.'
	);

	assert(
		name === directoryName,
		`Expected the "${ file }" file to store the "${ directoryName }" name (as its directory does), but found "${ name }".`
	);

	assert(
		isNonEmptyString( description ),
		`Expected the "${ file }" file to store a non-empty "description" string in its front matter.`
	);

	assert(
		description.length <= MAX_DESCRIPTION_LENGTH,
		`The description in the "${ file }" file is ${ description.length } characters long, ` +
		`while the discovery specification allows up to ${ MAX_DESCRIPTION_LENGTH }.`
	);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isNonEmptyString( value ) {
	return typeof value === 'string' && value.trim() !== '';
}
