/**
 * @license Copyright (c) 2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import upath from 'upath';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findSkillFiles, findSkills } from '../../../scripts/release/utils/skills.js';

describe( 'scripts/release/utils/skills', () => {
	let cwd;

	beforeEach( async () => {
		cwd = await fs.mkdtemp( upath.join( os.tmpdir(), 'ckeditor-skills-' ) );

		await fs.mkdir( upath.join( cwd, 'skills' ) );
	} );

	afterEach( async () => {
		await fs.rm( cwd, { recursive: true, force: true } );
	} );

	describe( 'findSkillFiles()', () => {
		it( 'should return the skill file of every skill directory, sorted by the directory', async () => {
			await createSkill( 'zebra' );
			await createSkill( 'alpha' );
			await createSkill( 'middle' );

			expect( await findSkillFiles( { cwd } ) ).to.deep.equal( [
				'skills/alpha/SKILL.md',
				'skills/middle/SKILL.md',
				'skills/zebra/SKILL.md'
			] );
		} );

		it( 'should ignore files in the skills directory', async () => {
			await createSkill( 'ckeditor' );
			await writeFile( 'skills/README.md', 'Not a skill.\n' );

			expect( await findSkillFiles( { cwd } ) ).to.deep.equal( [ 'skills/ckeditor/SKILL.md' ] );
		} );

		it( 'should throw when a skill directory does not have the skill file', async () => {
			await createSkill( 'ckeditor' );
			await fs.mkdir( upath.join( cwd, 'skills', 'drafts' ) );

			await expect( findSkillFiles( { cwd } ) ).rejects.toThrow(
				'Expected the "skills/drafts" directory to contain a "SKILL.md" file.'
			);
		} );

		it( 'should throw when a skill directory is a symbolic link', async () => {
			await createSkill( 'ckeditor' );
			await writeFile( 'elsewhere/SKILL.md', '---\nname: linked\n---\n' );

			// A junction on Windows, where a symbolic link requires elevated privileges; a symbolic link elsewhere.
			await fs.symlink( upath.join( cwd, 'elsewhere' ), upath.join( cwd, 'skills', 'linked' ), 'junction' );

			await expect( findSkillFiles( { cwd } ) ).rejects.toThrow(
				'The "skills/linked" entry is a symbolic link, which must not be released. ' +
				'Replace it with the actual directory or file.'
			);
		} );

		it( 'should throw when a skill file is a symbolic link', async () => {
			await createSkill( 'ckeditor' );
			await writeFile( 'elsewhere/SKILL.md', '---\nname: linked\n---\n' );

			// A junction to a directory stands in for a symbolic link to a file, which requires elevated privileges
			// on Windows. Either is a symbolic link to `lstat()`.
			await fs.mkdir( upath.join( cwd, 'skills', 'linked' ) );
			await fs.symlink( upath.join( cwd, 'elsewhere' ), upath.join( cwd, 'skills', 'linked', 'SKILL.md' ), 'junction' );

			await expect( findSkillFiles( { cwd } ) ).rejects.toThrow(
				'The "skills/linked/SKILL.md" file is a symbolic link, which must not be released. Replace it with the actual file.'
			);
		} );

		it( 'should throw when the repository does not contain any skill', async () => {
			await expect( findSkillFiles( { cwd } ) ).rejects.toThrow(
				'Could not find any "SKILL.md" file in the "skills" directory.'
			);
		} );
	} );

	describe( 'findSkills()', () => {
		it( 'should return the discovery metadata of every skill sorted by name', async () => {
			await createSkill( 'zebra' );
			await createSkill( 'alpha' );

			expect( await findSkills( { cwd } ) ).to.deep.equal( [
				{
					file: 'skills/alpha/SKILL.md',
					directory: 'skills/alpha',
					name: 'alpha',
					description: 'Install and configure alpha in any JavaScript project.'
				},
				{
					file: 'skills/zebra/SKILL.md',
					directory: 'skills/zebra',
					name: 'zebra',
					description: 'Install and configure zebra in any JavaScript project.'
				}
			] );
		} );

		it( 'should fold a ">-" description block into paragraphs', async () => {
			await writeSkillFile( 'ckeditor', skillFileWithDescription( [
				'description: >-',
				'  line one',
				'  line two',
				'',
				'  second paragraph'
			] ) );

			expect( await getDescription() ).to.equal( 'line one line two\nsecond paragraph' );
		} );

		it( 'should support a plain single-line description', async () => {
			await writeSkillFile( 'ckeditor', skillFileWithDescription( [
				'description: Install CKEditor 5.'
			] ) );

			expect( await getDescription() ).to.equal( 'Install CKEditor 5.' );
		} );

		it( 'should keep the trailing newline of a ">" description block', async () => {
			await writeSkillFile( 'ckeditor', skillFileWithDescription( [
				'description: >',
				'  Install CKEditor 5.'
			] ) );

			expect( await getDescription() ).to.equal( 'Install CKEditor 5.\n' );
		} );

		for ( const [ style, descriptionLines, description ] of [
			[ 'a double-quoted value', [ 'description: "Install CKEditor 5."' ], 'Install CKEditor 5.' ],
			[ 'a single-quoted value', [ 'description: \'Install CKEditor 5.\'' ], 'Install CKEditor 5.' ],
			[ 'a multi-line plain value', [ 'description: Install', '  CKEditor 5.' ], 'Install CKEditor 5.' ],
			[ 'a value followed by a comment', [ 'description: Install CKEditor 5. # A comment.' ], 'Install CKEditor 5.' ],
			[ 'the "|" literal block', [ 'description: |', '  Install', '  CKEditor 5.' ], 'Install\nCKEditor 5.\n' ],
			[ 'the ">+" keep block', [ 'description: >+', '  Install CKEditor 5.' ], 'Install CKEditor 5.\n' ],
			[ 'a folded block with a more-indented line', [ 'description: >-', '  Install', '    CKEditor 5.' ], 'Install\n  CKEditor 5.' ]
		] ) {
			it( `should read a description written as ${ style }`, async () => {
				await writeSkillFile( 'ckeditor', skillFileWithDescription( descriptionLines ) );

				expect( await getDescription() ).to.equal( description );
			} );
		}

		it( 'should propagate the errors of parsing the front matter', async () => {
			await writeSkillFile( 'ckeditor', '# CKEditor 5\n\nNo front matter here.\n' );

			await expect( findSkills( { cwd } ) ).rejects.toThrow(
				'The "skills/ckeditor/SKILL.md" file does not start with a YAML front matter block.'
			);
		} );

		for ( const [ problem, frontMatterLines ] of [
			[ 'does not have the name', [ 'description: A skill.' ] ],
			[ 'has a name without a value', [ 'name:', 'description: A skill.' ] ],
			[ 'has a numeric name', [ 'name: 123', 'description: A skill.' ] ]
		] ) {
			it( `should throw when the front matter of a skill file ${ problem }`, async () => {
				await writeSkillFile( 'ckeditor', skillFileWithFrontMatter( frontMatterLines ) );

				await expect( findSkills( { cwd } ) ).rejects.toThrow(
					'Expected the "skills/ckeditor/SKILL.md" file to store a non-empty "name" string in its front matter.'
				);
			} );
		}

		it( 'should throw when a skill name does not match its directory', async () => {
			await writeSkillFile( 'ckeditor', skillFileWithFrontMatter( [ 'name: other-name', 'description: A skill.' ] ) );

			await expect( findSkills( { cwd } ) ).rejects.toThrow(
				'Expected the "skills/ckeditor/SKILL.md" file to store the "ckeditor" name (as its directory does), ' +
				'but found "other-name".'
			);
		} );

		it( 'should throw when a skill name does not follow the discovery specification', async () => {
			await createSkill( 'bad--name' );

			await expect( findSkills( { cwd } ) ).rejects.toThrow(
				'The "bad--name" skill name in the "skills/bad--name/SKILL.md" file does not follow the discovery specification: ' +
				'up to 64 lowercase alphanumeric characters and hyphens, with no leading, trailing, or consecutive hyphens.'
			);
		} );

		it( 'should throw when a skill name is too long', async () => {
			const name = 'a'.repeat( 65 );

			await createSkill( name );

			await expect( findSkills( { cwd } ) ).rejects.toThrow(
				`The "${ name }" skill name in the "skills/${ name }/SKILL.md" file does not follow the discovery specification:`
			);
		} );

		for ( const [ problem, descriptionLines ] of [
			[ 'does not have the description', [] ],
			[ 'has a description without a value', [ 'description:' ] ],
			[ 'has an empty quoted description', [ 'description: ""' ] ],
			[ 'has a blank quoted description', [ 'description: \'  \'' ] ],
			[ 'has a ">-" description block without content', [ 'description: >-' ] ],
			[ 'has a list as the description', [ 'description:', '  - Install CKEditor 5.', '  - Configure CKEditor 5.' ] ]
		] ) {
			it( `should throw when the front matter of a skill file ${ problem }`, async () => {
				await writeSkillFile( 'ckeditor', skillFileWithDescription( descriptionLines ) );

				await expect( findSkills( { cwd } ) ).rejects.toThrow(
					'Expected the "skills/ckeditor/SKILL.md" file to store a non-empty "description" string in its front matter.'
				);
			} );
		}

		it( 'should throw when the description is too long', async () => {
			await writeSkillFile( 'ckeditor', skillFileWithDescription( [
				`description: ${ 'a'.repeat( 1025 ) }`
			] ) );

			await expect( findSkills( { cwd } ) ).rejects.toThrow(
				'The description in the "skills/ckeditor/SKILL.md" file is 1025 characters long, ' +
				'while the discovery specification allows up to 1024.'
			);
		} );
	} );

	/**
	 * Creates a skill storing a folded description that resolves to
	 * `Install and configure <name> in any JavaScript project.`.
	 */
	function createSkill( name ) {
		return writeSkillFile( name, [
			'---',
			`name: ${ name }`,
			'description: >-',
			`  Install and configure ${ name }`,
			'  in any JavaScript project.',
			'metadata:',
			'  author: CKEditor (CKSource)',
			'  version: 1.0.0',
			'---',
			'',
			`# ${ name }`,
			''
		].join( '\n' ) );
	}

	/**
	 * Returns the content of a `SKILL.md` file of the `ckeditor` skill with the given front matter lines.
	 */
	function skillFileWithFrontMatter( frontMatterLines ) {
		return [
			'---',
			...frontMatterLines,
			'---',
			'',
			'# ckeditor',
			''
		].join( '\n' );
	}

	/**
	 * Returns the content of a `SKILL.md` file of the `ckeditor` skill with the given `description` lines.
	 */
	function skillFileWithDescription( descriptionLines ) {
		return skillFileWithFrontMatter( [
			'name: ckeditor',
			...descriptionLines,
			'metadata:',
			'  version: 1.0.0'
		] );
	}

	async function getDescription() {
		const [ skill ] = await findSkills( { cwd } );

		return skill.description;
	}

	function writeSkillFile( name, content ) {
		return writeFile( upath.join( 'skills', name, 'SKILL.md' ), content );
	}

	async function writeFile( file, content ) {
		const filePath = upath.join( cwd, file );

		await fs.mkdir( upath.dirname( filePath ), { recursive: true } );
		await fs.writeFile( filePath, content, 'utf-8' );
	}
} );
