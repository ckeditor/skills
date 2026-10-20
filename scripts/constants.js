/**
 * @license Copyright (c) 2026-2026, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import upath from 'upath';

// The paths and the settings of the repository that the scripts share. `ROOT_DIRECTORY` is an absolute path, and the
// other paths are relative to it.

export const ROOT_DIRECTORY = upath.join( import.meta.dirname, '..' );

export const RELEASE_BRANCH = 'master';

// Every directory in it is a skill.
export const SKILLS_DIRECTORY = 'skills';

export const SKILL_FILE = 'SKILL.md';

// Wiped and rebuilt on every run, so it must not hold anything else. Its contents are uploaded as-is into
// `ckeditor.com/.well-known/agent-skills/`.
export const RELEASE_DIRECTORY = 'release';

// The templates of the tracking rules that every skill includes.
export const DOCS_TRACKING_TEMPLATES_DIRECTORY = 'scripts/skills/templates';
