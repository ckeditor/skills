# Release process

This repository follows the same release process as other CKEditor projects: changes are described in changelog
entry files while they are developed, and a release turns those entries into a `CHANGELOG.md` section, a version
bump, a git tag, and a GitHub release page.

## Versioning

Everything in the repository shares **one version**. It is stored in four places, and all of them are updated by
the release scripts — **never edit them by hand**:

| File | Key |
| --- | --- |
| `package.json` | `version` |
| `.claude-plugin/plugin.json` | `version` |
| `.claude-plugin/marketplace.json` | `metadata.version` and `version` of every entry in `plugins` |
| `skills/*/SKILL.md` | `metadata.version` in the YAML front matter |

The release fails if these files do not agree on the current version, so a manual edit that slips through review
is caught before it is published.

Since the skills are documentation for agents rather than an API, use the following rule of thumb:

* **patch** — typos, clarifications, link fixes, small corrections that do not change what the agent is told to do,
* **minor** — new guidance, a new reference file, a new skill, meaningful changes to the existing instructions,
* **major** — a removed or renamed skill, or a change that breaks how the skill is installed or consumed.

## While working on a change

1. Create a changelog entry on your branch:

	```bash
	pnpm nice
	```

	This creates a file in the `.changelog/` directory, named after the current date and branch.

2. Fill it in. The `type` field is required and accepts `Feature`, `Fix`, `Other`, `Minor breaking change`, or
	`Major breaking change` — it decides both the changelog section and the version bump suggested during the release.
	Leave `scope` empty (this is a single-package repository). List related issues in `closes` and `see`, using either
	an issue number or the `{owner}/{repo}#{number}` notation.

	The text below the front matter is what lands in the changelog, so write it for the reader of the release notes:
	a concise summary in the first paragraph, and optional context in the following ones.

3. Commit the entry together with the change it describes.

Every user-facing change should come with an entry. Purely internal work (CI, tooling, refactoring) can either use
the `Other` type or skip the entry altogether.

## Releasing

Prerequisites:

* Node.js `>=24.11.0` and pnpm `^11.9.0`, with dependencies installed (`pnpm install`).
* The `main` branch, up to date with the remote and with a clean working tree.
* Permission to push to `main`.
* A GitHub token for the last step: a **classic** personal access token with the `repo` scope. The prompt only
	accepts 40-character tokens, so fine-grained tokens will not work.

### Prepare the changelog

```bash
pnpm release:prepare-changelog
```

The script lists the collected entries, asks for the release type and the new version (suggesting one based on the
entry types), and then:

* adds a new section at the top of `CHANGELOG.md`,
* removes the consumed files from `.changelog/`,
* commits both as `Changelog for vX.Y.Z. [skip ci]`.

Review the generated section before continuing — this is the release notes text, and it is the last moment to
correct the wording. Amend the commit if needed.

Add `--dry-run` to print the section without touching any file, and `--date=YYYY-MM-DD` to override the release date.

### Prepare the release commit

```bash
pnpm release:prepare-packages
```

The script verifies the repository (right branch, not behind the remote, changelog section present, all files
storing the same version), writes the new version to the four files listed above, and creates the release commit
`Release: vX.Y.Z. [skip ci]` with the annotated `vX.Y.Z` tag.

Despite the name, nothing is built here — this repository does not produce any packages, so the `--compile-only`
option known from other repositories does not apply.

Nothing has left your machine at this point. Inspect `git show HEAD` before continuing.

### Publish

```bash
pnpm release:publish-packages
```

The script asks for the GitHub token, pushes `main` and the new tag, and creates the GitHub release page with the
changelog section as its description. The token only needs write access to the repository contents (the `repo` scope),
as that is what creating a release requires. The printed release page URL is the last thing to verify.

### If something goes wrong

The steps are safe to re-run, so fix the cause and run the failed one again. If that does not help — nothing landed
on `main`, or the release page is missing — ping the `@ckeditor/ckeditor-5-platform` team. You can also just ask them
to do the release for you.