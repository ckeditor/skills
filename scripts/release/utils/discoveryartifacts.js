/**
 * @license Copyright (c) 2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import fs from 'node:fs/promises';
import upath from 'upath';
import { assert, quote } from './assert.js';
import { createArchive } from './archive.js';
import { findSkills } from './skills.js';

// Wiped and rebuilt on every run, so it must not hold anything else. Its contents are meant to be uploaded
// as-is into `ckeditor.com/.well-known/agent-skills/`.
const RELEASE_DIRECTORY = 'release';

const INDEX_FILE = 'index.json';

// The Agent Skills Discovery index format, as defined by https://github.com/cloudflare/agent-skills-discovery-rfc.
const SCHEMA_URL = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json';

// Where the artifacts will be publicly served from once uploaded to ckeditor.com.
const URL_PREFIX = '/.well-known/agent-skills/';

// The remedy for every mismatch between the release directory and the repository.
const REBUILD_HINT = 'Run "pnpm release:prepare-packages" first.';

/**
 * Builds the Agent Skills Discovery artifacts: a `.tar.gz` archive per skill, with the skill files at the archive
 * root, and the `index.json` manifest pointing at the archives. The release directory is wiped first, so the
 * function is safe to re-run.
 *
 * @param {object} options
 * @param {string} options.cwd Root of the repository.
 * @param {string} options.version Version to store in the archive names.
 * @returns {Promise.<Array.<string>>} Paths (relative to `cwd`) of the created files.
 */
export async function prepareDiscoveryArtifacts( { cwd, version } ) {
	const releaseDirectory = upath.join( cwd, RELEASE_DIRECTORY );
	const skills = await findSkills( { cwd } );

	await fs.rm( releaseDirectory, { recursive: true, force: true } );
	await fs.mkdir( releaseDirectory, { recursive: true } );

	for ( const skill of skills ) {
		await createArchive( {
			cwd,
			skillDirectory: skill.directory,
			artifactsDirectory: releaseDirectory,
			archiveFileName: getArchiveFileName( skill, version )
		} );
	}

	const index = await createIndex( { cwd, skills, version } );

	await fs.writeFile( upath.join( releaseDirectory, INDEX_FILE ), JSON.stringify( index, null, 2 ) + '\n', 'utf-8' );

	return getExpectedFiles( skills, version ).map( file => upath.join( RELEASE_DIRECTORY, file ) );
}

/**
 * Verifies that the discovery artifacts describe the given version of the skills currently in the repository:
 * the release directory holds exactly the expected files, and the index is the one that would be built now.
 * Throws otherwise, so that a release cannot publish a stale or broken index.
 *
 * @param {object} options
 * @param {string} options.cwd Root of the repository.
 * @param {string} options.version Version the artifacts are expected to store.
 * @returns {Promise.<void>}
 */
export async function verifyDiscoveryArtifacts( { cwd, version } ) {
	const skills = await findSkills( { cwd } );
	const expectedFiles = getExpectedFiles( skills, version ).sort();
	const actualFiles = ( await readReleaseDirectory( cwd ) ).sort();

	assert(
		isDeepStrictEqual( actualFiles, expectedFiles ),
		`Expected the "${ RELEASE_DIRECTORY }" directory to contain ${ quote( expectedFiles ) }, found ${ quote( actualFiles ) }. ` +
		REBUILD_HINT
	);

	const index = await readIndex( cwd );

	assert(
		isDeepStrictEqual( index, await createIndex( { cwd, skills, version } ) ),
		`The "${ upath.join( RELEASE_DIRECTORY, INDEX_FILE ) }" file does not match the current skills and archives. ${ REBUILD_HINT }`
	);
}

/**
 * Returns the discovery index describing the given skills and the archives already built for the version.
 *
 * @param {object} options
 * @param {string} options.cwd Root of the repository.
 * @param {Array.<{ name: string, description: string }>} options.skills
 * @param {string} options.version
 * @returns {Promise.<object>}
 */
async function createIndex( { cwd, skills, version } ) {
	const entries = [];

	for ( const skill of skills ) {
		const archiveFileName = getArchiveFileName( skill, version );

		entries.push( {
			name: skill.name,
			type: 'archive',
			description: skill.description,
			url: URL_PREFIX + archiveFileName,
			digest: 'sha256:' + await getFileDigest( upath.join( cwd, RELEASE_DIRECTORY, archiveFileName ) )
		} );
	}

	return {
		$schema: SCHEMA_URL,
		skills: entries
	};
}

/**
 * @param {string} cwd Root of the repository.
 * @returns {Promise.<Array.<string>>} Names of the files in the release directory, none if the directory is missing.
 */
async function readReleaseDirectory( cwd ) {
	try {
		return await fs.readdir( upath.join( cwd, RELEASE_DIRECTORY ) );
	} catch ( error ) {
		if ( error.code === 'ENOENT' ) {
			return [];
		}

		throw error;
	}
}

/**
 * @param {string} cwd Root of the repository.
 * @returns {Promise.<unknown>} The parsed index file.
 */
async function readIndex( cwd ) {
	const content = await fs.readFile( upath.join( cwd, RELEASE_DIRECTORY, INDEX_FILE ), 'utf-8' );

	try {
		return JSON.parse( content );
	} catch {
		throw new Error( `The "${ upath.join( RELEASE_DIRECTORY, INDEX_FILE ) }" file is not a valid JSON file.` );
	}
}

/**
 * @param {Array.<{ name: string }>} skills
 * @param {string} version
 * @returns {Array.<string>} Names of the files the release directory is expected to hold.
 */
function getExpectedFiles( skills, version ) {
	return [ ...skills.map( skill => getArchiveFileName( skill, version ) ), INDEX_FILE ];
}

/**
 * @param {{ name: string }} skill
 * @param {string} version
 * @returns {string}
 */
function getArchiveFileName( skill, version ) {
	return `${ skill.name }-${ version }.tar.gz`;
}

/**
 * @param {string} filePath An absolute path.
 * @returns {Promise.<string>} Lowercase hexadecimal SHA-256 digest of the file content.
 */
async function getFileDigest( filePath ) {
	return createHash( 'sha256' ).update( await fs.readFile( filePath ) ).digest( 'hex' );
}
