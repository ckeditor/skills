# Release process

This repository follows the same release process as other CKEditor projects: changes are described in changelog
entry files while they are developed, and a release turns those entries into a `CHANGELOG.md` section, a version
bump, a git tag, a GitHub release page, and the Agent Skills Discovery artifacts to be served from `ckeditor.com`.

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
* The `git` and `tar` executables on the `PATH`. They list and archive the skill files. Both GNU tar and bsdtar
	(the `tar` of macOS and Windows) work.
* The `main` branch, up to date with the remote and with a clean working tree. Uncommitted changes to the version
	files are tolerated, as the release commit includes them anyway.
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

The script verifies the repository (right branch, not behind the remote, clean working tree, changelog section
present, all files storing the same version), writes the new version to the four files listed above, builds the
discovery artifacts, and creates the release commit `Release: vX.Y.Z. [skip ci]` with the annotated `vX.Y.Z` tag.

The [Agent Skills Discovery](https://github.com/cloudflare/agent-skills-discovery-rfc) artifacts — a
`<skill>-<version>.tar.gz` archive per skill plus an `index.json` manifest, generated from the `SKILL.md` front
matter — land in the gitignored `release/` directory and are not part of the commit. Once uploaded to
`ckeditor.com/.well-known/agent-skills/`, they make `npx skills add https://ckeditor.com` install the skills.

An archive contains exactly the git-tracked files of the skill directory, so an untracked (and not git-ignored) or
deleted file inside a skill directory fails the build: commit or remove it first. Hidden files, symbolic links, paths
with characters outside printable ASCII or starting with `@`, and a `SKILL.md` tracked under another letter case fail
it too. Every directory under `skills/` is a skill, so one without a `SKILL.md` fails the build as well.

Add `--compile-only` to only build the artifacts (using the current `package.json` version) — CI runs
this mode as a smoke test. Add `--verbose` for more detailed output.

Nothing has left your machine at this point. Inspect `git show HEAD` before continuing.

### Publish

```bash
pnpm release:publish-packages
```

The script asks for the GitHub token, checks that the discovery artifacts are complete and match the released version
and the current `SKILL.md` files (a failure aborts the release before anything is pushed — re-run
`pnpm release:prepare-packages` to rebuild them), pushes `main` and the new tag, and creates the GitHub release page
with the changelog section as its description. The token only needs write access to the repository contents (the
`repo` scope), as that is what creating a release requires. The printed release page URL is the last thing to verify.

The artifacts are not uploaded anywhere yet, as the upload procedure to `ckeditor.com` is not established — the
script only reports that they are ready in `release/`.

### If something goes wrong

The steps are safe to re-run, so fix the cause and run the failed one again. If that does not help — nothing landed
on `main`, or the release page is missing — ping the `@ckeditor/ckeditor-5-platform` team. You can also just ask them
to do the release for you.