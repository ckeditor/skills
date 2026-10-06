Changelog
=========

## [0.2.0](https://github.com/ckeditor/skills/compare/v0.1.1...v0.2.0) (October 6, 2026)

### Features

* Introduced the `ckeditor-update` skill that updates an existing CKEditor 5 integration between versions. See [ckeditor/skills#22](https://github.com/ckeditor/skills/issues/22). Closes [#39](https://github.com/ckeditor/skills/issues/39).

  The skill detects the installed version and installation method, walks the official update guide of every major version in the range, and applies the breaking changes in code, not only in `package.json`. It migrates legacy setups (predefined builds, DLL builds, the old CDN) to the new installation methods, keeps the features that legacy builds included implicitly, avoids the LTS license trap, verifies the result, and reports every change with the guide section that required it.

### Other changes

* Introduced the Agent Skills Discovery artifacts in the release process.

  Preparing a release now builds a `.tar.gz` archive per skill and an `index.json` manifest following the [Agent Skills Discovery specification](https://github.com/cloudflare/agent-skills-discovery-rfc) into the `release/` directory.
* The release process now runs on CircleCI and publishes the Agent Skills Discovery artifacts to `ckeditor.com/.well-known/agent-skills/`.
* The `ckeditor` and `ckeditor-update` skills now include the `utm_source=ckeditor-skill` and `utm_medium=ai-agent` query parameters in documentation URLs. Both skills also instruct the agent to add these parameters to any `ckeditor.com/docs/…` URL it builds or follows. See [ckeditor/skills#21](https://github.com/ckeditor/skills/issues/21). Closes [#36](https://github.com/ckeditor/skills/issues/36).


## 0.1.1 (July 23, 2026)

The baseline entry, added together with the release process. It covers everything published in the repository before
the changelog was introduced — see the [commit history](https://github.com/ckeditor/skills/commits/master/) for details.

### Features

* The `ckeditor` skill: an umbrella router that takes a project from "I want a rich-text editor" to a working,
  configured, correctly-licensed CKEditor 5 — in any JavaScript environment. Distributed as an `agentskills.io` skill,
  a Claude Code plugin, and a `skills.sh` entry.
