/**
 * @license Copyright (c) 2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import fs from 'node:fs/promises';
import upath from 'upath';

/**
 * The agent-facing metadata files. Each descriptor points at every object in a file that owns a `version` key,
 * so adding another plugin to the marketplace manifest does not require touching this script.
 */
const JSON_FILES = [
	{
		file: '.claude-plugin/plugin.json',
		getVersionOwners: json => [ json ]
	},
	{
		file: '.claude-plugin/marketplace.json',
		getVersionOwners: json => [ json.metadata, ...json.plugins ]
	}
];

const SKILLS_DIRECTORY = 'skills';
const SKILL_FILE = 'SKILL.md';

// The YAML front matter block that opens a `SKILL.md` file.
const FRONT_MATTER_REGEXP = /^---\r?\n[\s\S]*?\r?\n---/;

// The `version` key in the front matter. It is nested in `metadata`, hence the required leading indentation.
const SKILL_VERSION_REGEXP = /^([ \t]+version:[ \t]*)(\S+)[ \t]*$/gm;

/**
 * Returns the version stored in the metadata files. Throws when they do not all store the same one, as the whole
 * repository shares a single version.
 *
 * @param {object} options
 * @param {string} options.cwd Root of the repository.
 * @returns {Promise.<string>}
 */
export async function getMetadataVersion( { cwd } ) {
	// One entry per file, as a single file may store the version more than once.
	const versionsPerFile = [];

	for ( const { file, getVersionOwners } of JSON_FILES ) {
		const versionOwners = getVersionOwners( await readJson( cwd, file ) );

		versionsPerFile.push( {
			file,
			versions: versionOwners.map( owner => getJsonVersion( owner, file ) )
		} );
	}

	for ( const file of await findSkillFiles( { cwd } ) ) {
		const content = await fs.readFile( upath.join( cwd, file ), 'utf-8' );

		versionsPerFile.push( {
			file,
			versions: [ getSkillVersion( content, file ) ]
		} );
	}

	const uniqueVersions = [ ...new Set( versionsPerFile.flatMap( ( { versions } ) => versions ) ) ];

	if ( uniqueVersions.length > 1 ) {
		const details = versionsPerFile.map( ( { file, versions } ) => `* ${ file }: ${ versions.join( ', ' ) }` );

		throw new Error( 'Expected all files to store the same version, but found:\n' + details.join( '\n' ) );
	}

	return uniqueVersions[ 0 ];
}

/**
 * Stores the given version in all metadata files.
 *
 * @param {object} options
 * @param {string} options.version Version to store.
 * @param {string} options.cwd Root of the repository.
 * @returns {Promise.<Array.<string>>} Paths (relative to `cwd`) of the updated files.
 */
export async function updateMetadataVersions( { version, cwd } ) {
	const updatedFiles = [];

	for ( const { file, getVersionOwners } of JSON_FILES ) {
		const json = await readJson( cwd, file );

		for ( const versionOwner of getVersionOwners( json ) ) {
			// Read the current value first, so that a file with an unexpected shape fails the release
			// instead of silently gaining a new `version` key.
			getJsonVersion( versionOwner, file );

			versionOwner.version = version;
		}

		await fs.writeFile( upath.join( cwd, file ), JSON.stringify( json, null, 2 ) + '\n', 'utf-8' );

		updatedFiles.push( file );
	}

	for ( const file of await findSkillFiles( { cwd } ) ) {
		const filePath = upath.join( cwd, file );
		const content = await fs.readFile( filePath, 'utf-8' );

		await fs.writeFile( filePath, setSkillVersion( content, version, file ), 'utf-8' );

		updatedFiles.push( file );
	}

	return updatedFiles;
}

/**
 * Returns paths (relative to `cwd`) to the `SKILL.md` file of every skill in the repository.
 *
 * @param {object} options
 * @param {string} options.cwd Root of the repository.
 * @returns {Promise.<Array.<string>>}
 */
async function findSkillFiles( { cwd } ) {
	const directoryEntries = await fs.readdir( upath.join( cwd, SKILLS_DIRECTORY ), { withFileTypes: true } );
	const skillFiles = [];

	for ( const directoryEntry of directoryEntries ) {
		if ( !directoryEntry.isDirectory() ) {
			continue;
		}

		const file = upath.join( SKILLS_DIRECTORY, directoryEntry.name, SKILL_FILE );

		if ( await isFile( upath.join( cwd, file ) ) ) {
			skillFiles.push( file );
		}
	}

	if ( !skillFiles.length ) {
		throw new Error( `Could not find any "${ SKILL_FILE }" file in the "${ SKILLS_DIRECTORY }" directory.` );
	}

	return skillFiles;
}

/**
 * @param {string} cwd Root of the repository.
 * @param {string} file Path to a JSON file, relative to `cwd`.
 * @returns {Promise.<object>}
 */
async function readJson( cwd, file ) {
	return JSON.parse( await fs.readFile( upath.join( cwd, file ), 'utf-8' ) );
}

/**
 * @param {object|undefined} versionOwner An object that is expected to own a `version` key.
 * @param {string} file Path to the file the object comes from, used in the error message.
 * @returns {string}
 */
function getJsonVersion( versionOwner, file ) {
	if ( typeof versionOwner?.version !== 'string' ) {
		throw new Error( `The "${ file }" file does not have the expected shape: a missing "version" key.` );
	}

	return versionOwner.version;
}

/**
 * @param {string} content Content of a `SKILL.md` file.
 * @param {string} file Path to the file, used in the error message.
 * @returns {string}
 */
function getSkillVersion( content, file ) {
	const [ { version } ] = findSkillVersionMatches( content, file );

	return version;
}

/**
 * @param {string} content Content of a `SKILL.md` file.
 * @param {string} version Version to store.
 * @param {string} file Path to the file, used in the error message.
 * @returns {string}
 */
function setSkillVersion( content, version, file ) {
	const [ { match, key } ] = findSkillVersionMatches( content, file );
	const frontMatter = content.match( FRONT_MATTER_REGEXP )[ 0 ];

	return content.replace( frontMatter, frontMatter.replace( match, key + version ) );
}

/**
 * Finds the `metadata.version` entry in the front matter of a `SKILL.md` file. Anything other than exactly one
 * match means the front matter is not shaped as expected, so the release must not continue.
 *
 * @param {string} content Content of a `SKILL.md` file.
 * @param {string} file Path to the file, used in the error message.
 * @returns {Array.<{ match: string, key: string, version: string }>}
 */
function findSkillVersionMatches( content, file ) {
	const frontMatter = content.match( FRONT_MATTER_REGEXP )?.[ 0 ];

	if ( !frontMatter ) {
		throw new Error( `The "${ file }" file does not start with a YAML front matter block.` );
	}

	const matches = [ ...frontMatter.matchAll( SKILL_VERSION_REGEXP ) ]
		.map( ( [ match, key, version ] ) => ( { match, key, version } ) );

	if ( matches.length !== 1 ) {
		throw new Error(
			`Expected exactly one "metadata.version" entry in the front matter of the "${ file }" file, ` +
			`found ${ matches.length }.`
		);
	}

	return matches;
}

/**
 * @param {string} filePath An absolute path.
 * @returns {Promise.<boolean>}
 */
async function isFile( filePath ) {
	return fs.stat( filePath )
		.then( stats => stats.isFile() )
		.catch( () => false );
}
