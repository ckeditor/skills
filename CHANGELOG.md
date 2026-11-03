Changelog
=========

## [0.3.0](https://github.com/ckeditor/skills/compare/v0.2.0...v0.3.0) (November 3, 2026)

### Features

* Introduced the `ckeditor-bundle` skill that adds a script to an existing CKEditor 5 integration. The script builds the editor bundle for CKEditor Cloud Services. See [#29](https://github.com/ckeditor/skills/issues/29).

  The skill moves the editor into one module that the application and the bundle share. It decides for each custom plugin if the bundle needs it, if Cloud Services removes it, or if the plugin must be split, and it splits the configuration into the uploaded part and the runtime part. It also sets up the bundle build for the bundler of the project, makes the test data from sample documents, and verifies the bundle the way Cloud Services loads it.

  The skill also sets up the upload of the editor bundle to CKEditor Cloud Services. It adds an upload script that sends the signed `POST /editors` request, and three scripts in `package.json`: `build:bundle`, `upload:bundle`, and `release:bundle`. The upload script reads the shared configuration, the bundle version, and the test data that the skill prepares, so that the application and the bundle keep one editor definition. It reads the credentials from environment variables, and it exits with an error when the upload fails. As a result, CI can build and check the bundle on each change, and upload the bundle in a release job.

### Bug fixes

* The `ckeditor-update` skill now requires the agent to record the feature baseline in the browser when a browser MCP is available. A baseline from the code is only a fallback when there is no browser MCP or the agent cannot open the editor. Closes [#50](https://github.com/ckeditor/skills/issues/50).
* The `ckeditor-update` skill now checks that the project's custom styles still work after the update. It compares every `--ck-*` variable that the project sets or reads and every `.ck-*` selector that it styles with the editor CSS of the old and the new version. When a browser is available, it also compares the computed styles of both versions on a test page. Before, an override that the new editor CSS no longer reads went unnoticed when the update guides did not name the change. Closes [#51](https://github.com/ckeditor/skills/issues/51).

### Other changes

* The `ckeditor` and `ckeditor-update` skills now also tag documentation requests with the `utm_content` query parameter, which names the skill: `utm_content=ckeditor` or `utm_content=ckeditor-update`. As a result, the docs access logs can show the requests of each skill and of all skills together. See [#36](https://github.com/ckeditor/skills/issues/36). Closes [#48](https://github.com/ckeditor/skills/issues/48).


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
