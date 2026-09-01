/**
 * @license Copyright (c) 2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import upath from 'upath';
import { findSkillFiles, getFrontMatter, isFile } from './metadataversions.js';

const execFileAsync = promisify( execFile );

// Wiped and rebuilt on every run, so it must not hold anything else. Its contents are meant to be uploaded
// as-is into `ckeditor.com/.well-known/agent-skills/`.
const RELEASE_DIRECTORY = 'release';

const INDEX_FILE = 'index.json';

// The Agent Skills Discovery index format, as defined by https://github.com/cloudflare/agent-skills-discovery-rfc.
const SCHEMA_URL = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json';

// Where the artifacts will be publicly served from once uploaded to ckeditor.com.
const URL_PREFIX = '/.well-known/agent-skills/';

// The `name` key in the front matter. It is a top-level key, hence no leading indentation is allowed.
const SKILL_NAME_REGEXP = /^(name:[ \t]*)(\S+)[ \t]*$/gm;

// The discovery specification constraints for a skill name: lowercase alphanumeric characters and hyphens,
// with no leading, trailing, or consecutive hyphens.
const SKILL_NAME_FORMAT_REGEXP = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;

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
	const artifactsDirectory = upath.join( cwd, RELEASE_DIRECTORY );

	await fs.rm( artifactsDirectory, { recursive: true, force: true } );
	await fs.mkdir( artifactsDirectory, { recursive: true } );

	const indexEntries = [];
	const createdFiles = [];

	for ( const skill of await findSkills( { cwd } ) ) {
		const archiveFileName = `${ skill.name }-${ version }.tar.gz`;

		await createArchive( {
			archiveFileName,
			artifactsDirectory,
			skillDirectory: upath.join( cwd, skill.directory )
		} );

		indexEntries.push( {
			name: skill.name,
			type: 'archive',
			description: skill.description,
			url: URL_PREFIX + archiveFileName,
			digest: 'sha256:' + await getFileDigest( upath.join( artifactsDirectory, archiveFileName ) )
		} );

		createdFiles.push( upath.join( RELEASE_DIRECTORY, archiveFileName ) );
	}

	const index = {
		$schema: SCHEMA_URL,
		skills: indexEntries
	};

	await fs.writeFile( upath.join( artifactsDirectory, INDEX_FILE ), JSON.stringify( index, null, 2 ) + '\n', 'utf-8' );

	return [ ...createdFiles, upath.join( RELEASE_DIRECTORY, INDEX_FILE ) ];
}

/**
 * Verifies that the discovery artifacts exist and describe the given version of every skill in the repository.
 * Throws when anything is missing or out of sync, so a release cannot publish a stale or broken index.
 *
 * @param {object} options
 * @param {string} options.cwd Root of the repository.
 * @param {string} options.version Version the artifacts are expected to store.
 * @returns {Promise.<void>}
 */
export async function verifyDiscoveryArtifacts( { cwd, version } ) {
	const indexFile = upath.join( RELEASE_DIRECTORY, INDEX_FILE );
	const index = await readIndex( cwd, indexFile );

	if ( index?.$schema !== SCHEMA_URL || !Array.isArray( index.skills ) ) {
		throw new Error(
			`The "${ indexFile }" file does not have the expected shape: ` +
			`an index following the "${ SCHEMA_URL }" schema with a "skills" array.`
		);
	}

	const skills = await findSkills( { cwd } );

	for ( const entry of index.skills ) {
		if ( !skills.some( skill => skill.name === entry.name ) ) {
			throw new Error(
				`The "${ indexFile }" file contains an entry for the unknown "${ entry.name }" skill. ` +
				'Run "pnpm release:prepare-packages" first.'
			);
		}
	}

	for ( const skill of skills ) {
		const entry = index.skills.find( ( { name } ) => name === skill.name );

		if ( !entry ) {
			throw new Error(
				`The "${ indexFile }" file does not contain an entry for the "${ skill.name }" skill. ` +
				'Run "pnpm release:prepare-packages" first.'
			);
		}

		const archiveFileName = `${ skill.name }-${ version }.tar.gz`;
		const archiveFile = upath.join( RELEASE_DIRECTORY, archiveFileName );

		if ( entry.type !== 'archive' ) {
			throw new Error(
				`Expected the "${ skill.name }" entry in the "${ indexFile }" file to have the "archive" type, ` +
				`found "${ entry.type }".`
			);
		}

		if ( entry.description !== skill.description ) {
			throw new Error(
				`The description of the "${ skill.name }" entry in the "${ indexFile }" file does not match ` +
				`the "${ skill.file }" file.`
			);
		}

		if ( entry.url !== URL_PREFIX + archiveFileName ) {
			throw new Error(
				`Expected the "${ skill.name }" entry in the "${ indexFile }" file to point at ` +
				`"${ URL_PREFIX + archiveFileName }", found "${ entry.url }".`
			);
		}

		const archivePath = upath.join( cwd, archiveFile );

		if ( !await isFile( archivePath ) ) {
			throw new Error( `Could not find the "${ archiveFile }" archive. Run "pnpm release:prepare-packages" first.` );
		}

		if ( entry.digest !== 'sha256:' + await getFileDigest( archivePath ) ) {
			throw new Error( `The digest of the "${ archiveFile }" archive does not match its "${ indexFile }" entry.` );
		}
	}

	// The directory is uploaded as-is, so anything beyond the index and the archives must not slip in.
	const expectedFiles = [ INDEX_FILE, ...skills.map( skill => `${ skill.name }-${ version }.tar.gz` ) ];
	const unexpectedFiles = ( await fs.readdir( upath.join( cwd, RELEASE_DIRECTORY ) ) )
		.filter( file => !expectedFiles.includes( file ) );

	if ( unexpectedFiles.length ) {
		throw new Error(
			`The "${ RELEASE_DIRECTORY }" directory contains unexpected entries: ` +
			`${ unexpectedFiles.map( file => `"${ file }"` ).join( ', ' ) }. ` +
			'Run "pnpm release:prepare-packages" first.'
		);
	}
}

/**
 * Returns the discovery metadata of every skill in the repository, sorted by the skill name.
 *
 * @param {object} options
 * @param {string} options.cwd Root of the repository.
 * @returns {Promise.<Array.<{ file: string, directory: string, name: string, description: string }>>}
 */
async function findSkills( { cwd } ) {
	const skills = [];

	for ( const file of await findSkillFiles( { cwd } ) ) {
		const content = await fs.readFile( upath.join( cwd, file ), 'utf-8' );
		const directory = upath.dirname( file );

		skills.push( {
			file,
			directory,
			name: getSkillName( content, file, upath.basename( directory ) ),
			description: getSkillDescription( content, file )
		} );
	}

	return skills.sort( ( a, b ) => a.name < b.name ? -1 : 1 );
}

/**
 * Creates a `.tar.gz` archive with the given files of the skill directory at the archive root, as the discovery
 * specification requires.
 *
 * The archive is created by the system `tar`, as both GNU tar and bsdtar understand the arguments used below.
 * Note that the archive name must stay relative, with `cwd` pointing at the output directory: GNU tar treats
 * the drive colon of an absolute Windows path passed to `-f` as a remote host name, while the `--force-local`
 * cure is not understood by bsdtar.
 *
 * @param {object} options
 * @param {string} options.archiveFileName Name of the archive to create.
 * @param {string} options.artifactsDirectory Absolute path to the directory to create the archive in.
 * @param {string} options.skillDirectory Absolute path to the skill directory to archive.
 * @returns {Promise.<void>}
 */
async function createArchive( { archiveFileName, artifactsDirectory, skillDirectory } ) {
	const entries = await findArchiveEntries( skillDirectory );

	try {
		// The `--` guard keeps a file name starting with a dash from being read as an option.
		await execFileAsync(
			'tar',
			[ '--format=ustar', '-czf', archiveFileName, '-C', skillDirectory, '--', ...entries ],
			{ cwd: artifactsDirectory }
		);
	} catch ( error ) {
		if ( error.code === 'ENOENT' ) {
			throw new Error( 'Could not find the "tar" executable required to create the skill archives.' );
		}

		throw new Error( `Creating the "${ archiveFileName }" archive failed: ${ ( error.stderr || error.message ).trim() }` );
	}
}

/**
 * Returns the files of a skill directory as sorted paths relative to it, ready to become archive entries.
 *
 * @param {string} skillDirectory Absolute path to the skill directory.
 * @returns {Promise.<Array.<string>>}
 */
async function findArchiveEntries( skillDirectory ) {
	const directoryEntries = await fs.readdir( skillDirectory, { recursive: true, withFileTypes: true } );
	const files = [];

	for ( const directoryEntry of directoryEntries ) {
		if ( directoryEntry.isDirectory() ) {
			continue;
		}

		const file = upath.relative( skillDirectory, upath.join( directoryEntry.parentPath, directoryEntry.name ) );

		// Hidden files (`.DS_Store` and friends) are never legitimate skill content, and the archives are
		// installed on end-user machines — refuse loudly instead of shipping them silently.
		if ( file.split( '/' ).some( segment => segment.startsWith( '.' ) ) ) {
			throw new Error( `Remove the hidden "${ file }" entry from the "${ skillDirectory }" directory, as it must not be published.` );
		}

		// Symbolic links and other special entries could smuggle content from outside the skill directory.
		if ( !directoryEntry.isFile() ) {
			throw new Error( `Expected the "${ file }" entry of the "${ skillDirectory }" directory to be a regular file.` );
		}

		files.push( file );
	}

	// The traversal order is platform-dependent, so sort for a stable archive layout.
	return files.sort();
}

/**
 * Finds the `name` entry in the front matter of a `SKILL.md` file and validates it against the discovery
 * specification. The name is also required to match the skill directory, as installers use it as the identifier.
 *
 * @param {string} content Content of a `SKILL.md` file.
 * @param {string} file Path to the file, used in the error messages.
 * @param {string} directoryName Name of the directory the file lives in.
 * @returns {string}
 */
function getSkillName( content, file, directoryName ) {
	const matches = [ ...getFrontMatter( content, file ).matchAll( SKILL_NAME_REGEXP ) ];

	if ( matches.length !== 1 ) {
		throw new Error( `Expected exactly one "name" entry in the front matter of the "${ file }" file, found ${ matches.length }.` );
	}

	const name = matches[ 0 ][ 2 ];

	if ( name.length > MAX_NAME_LENGTH || !SKILL_NAME_FORMAT_REGEXP.test( name ) ) {
		throw new Error(
			`The "${ name }" skill name in the "${ file }" file does not follow the discovery specification: ` +
			`up to ${ MAX_NAME_LENGTH } lowercase alphanumeric characters and hyphens, ` +
			'with no leading, trailing, or consecutive hyphens.'
		);
	}

	if ( name !== directoryName ) {
		throw new Error(
			`Expected the "${ file }" file to store the "${ directoryName }" name (as its directory does), ` +
			`but found "${ name }".`
		);
	}

	return name;
}

/**
 * Finds the `description` entry in the front matter of a `SKILL.md` file. Only the styles used in this repository
 * are supported — a plain single-line value and the `>`/`>-` folded blocks — as reading anything else faithfully
 * would need a real YAML parser, and the release must not guess what lands in the public index.
 *
 * @param {string} content Content of a `SKILL.md` file.
 * @param {string} file Path to the file, used in the error messages.
 * @returns {string}
 */
function getSkillDescription( content, file ) {
	// Splitting drops the `\r` of CRLF files along the way, and slicing removes the `---` fences.
	const lines = getFrontMatter( content, file ).split( /\r?\n/ ).slice( 1, -1 );
	const headerIndexes = lines.flatMap( ( line, index ) => line.startsWith( 'description:' ) ? [ index ] : [] );

	if ( headerIndexes.length !== 1 ) {
		throw new Error(
			`Expected exactly one "description" entry in the front matter of the "${ file }" file, ` +
			`found ${ headerIndexes.length }.`
		);
	}

	const headerValue = lines[ headerIndexes[ 0 ] ].slice( 'description:'.length ).trim();
	const blockLines = collectBlockLines( lines.slice( headerIndexes[ 0 ] + 1 ) );
	const description = [ '>', '>-' ].includes( headerValue ) ?
		foldBlock( blockLines, headerValue, file ) :
		getInlineDescription( headerValue, blockLines, file );

	if ( !description ) {
		throw new Error( `The "description" entry in the front matter of the "${ file }" file is empty.` );
	}

	if ( description.length > MAX_DESCRIPTION_LENGTH ) {
		throw new Error(
			`The description in the "${ file }" file is ${ description.length } characters long, ` +
			`while the discovery specification allows up to ${ MAX_DESCRIPTION_LENGTH }.`
		);
	}

	return description;
}

/**
 * @param {string} headerValue The trimmed value following the `description:` key.
 * @param {Array.<string>} blockLines The lines that would continue the value in YAML.
 * @param {string} file Path to the file, used in the error message.
 * @returns {string}
 */
function getInlineDescription( headerValue, blockLines, file ) {
	// An indented line below an inline value continues the plain scalar in YAML.
	const isMultiLine = blockLines.some( line => line.trim() !== '' );

	// The unsupported cases: an empty value, a multi-line plain scalar, the quoted, literal, and reference
	// styles, and a value with a YAML comment (which a real parser would strip).
	if ( !headerValue || isMultiLine || /^["'|&*>]/.test( headerValue ) || /[ \t]#/.test( headerValue ) ) {
		throw createUnsupportedDescriptionError( file );
	}

	return headerValue;
}

/**
 * Returns the lines that belong to the value started on the `description:` line: everything until the first
 * non-blank line with no indentation (the next key or the closing fence).
 *
 * @param {Array.<string>} lines The front matter lines following the `description:` key.
 * @returns {Array.<string>}
 */
function collectBlockLines( lines ) {
	const blockLines = [];

	for ( const line of lines ) {
		if ( line.trim() !== '' && !/^[ \t]/.test( line ) ) {
			break;
		}

		blockLines.push( line );
	}

	return blockLines;
}

/**
 * Folds a `>`/`>-` block the way YAML does: adjacent non-blank lines are joined with a space, every blank line
 * becomes a newline, and the trailing newline is kept by `>` and dropped by `>-`.
 *
 * @param {Array.<string>} blockLines The lines of the block, as collected by `collectBlockLines()`.
 * @param {string} style The block style: `>` or `>-`.
 * @param {string} file Path to the file, used in the error message.
 * @returns {string}
 */
function foldBlock( blockLines, style, file ) {
	const indent = blockLines.find( line => line.trim() !== '' )?.match( /^[ \t]*/ )[ 0 ];
	let text = '';

	for ( const line of blockLines ) {
		if ( line.trim() === '' ) {
			text += '\n';

			continue;
		}

		// A line indented differently than the first one switches YAML to literal-newline semantics, and
		// trailing whitespace folds ambiguously — both would silently diverge from a real YAML parser.
		if ( !line.startsWith( indent ) || /^[ \t]/.test( line.slice( indent.length ) ) || /[ \t]$/.test( line ) ) {
			throw createUnsupportedDescriptionError( file );
		}

		const strippedLine = line.slice( indent.length );

		text += text === '' || text.endsWith( '\n' ) ? strippedLine : ' ' + strippedLine;
	}

	text = text.replace( /\n+$/, '' );

	return text && style === '>' ? text + '\n' : text;
}

/**
 * @param {string} file Path to the file, used in the error message.
 * @returns {Error}
 */
function createUnsupportedDescriptionError( file ) {
	return new Error(
		`The "${ file }" file stores the "description" in an unsupported style. ` +
		'Use a plain single-line value or a ">-"/">"-folded block.'
	);
}

/**
 * @param {string} cwd Root of the repository.
 * @param {string} indexFile Path to the index file, relative to `cwd`.
 * @returns {Promise.<object>}
 */
async function readIndex( cwd, indexFile ) {
	let content;

	try {
		content = await fs.readFile( upath.join( cwd, indexFile ), 'utf-8' );
	} catch {
		throw new Error( `Could not find the "${ indexFile }" file. Run "pnpm release:prepare-packages" first.` );
	}

	try {
		return JSON.parse( content );
	} catch {
		throw new Error( `The "${ indexFile }" file is not a valid JSON file.` );
	}
}

/**
 * @param {string} filePath An absolute path.
 * @returns {Promise.<string>} Lowercase hexadecimal SHA-256 digest of the file content.
 */
async function getFileDigest( filePath ) {
	return createHash( 'sha256' ).update( await fs.readFile( filePath ) ).digest( 'hex' );
}
