# CKEditor skills

Official **[Agent Skills](https://code.claude.com/docs/en/skills)** for working
with CKEditor, designed to be portable across AI coding agents (Claude Code,
Cursor, Codex, and any tool that supports the open skill format).

The first skill, **`ckeditor`**, takes a developer and their coding agent from
"I want a rich-text editor" to a **working, configured, correctly-licensed
CKEditor 5** — picking an install method, wiring the editor (vanilla or a
framework wrapper), configuring features, loading CSS, setting the license key,
and unlocking premium features. It's an **umbrella router**: it detects the
project's state and routes to the right path, in any JavaScript environment.

> [!NOTE]
> **Want a skill for something else with CKEditor?** This repo is meant to grow
> beyond install + configure. If you'd like a skill for a specific feature,
> workflow, or integration, [open an issue](https://github.com/ckeditor/skills/issues)
> and tell us what you need — requests help us decide what to build next.

## Install

**skills.sh** (any supported agent):

```bash
npx skills add ckeditor/skills
```

**Claude Code plugin marketplace:**

```
/plugin marketplace add ckeditor/skills
/plugin install ckeditor@ckeditor
```

**Manual:** copy `skills/ckeditor/` into your agent's skills directory (e.g.
`.claude/skills/ckeditor/`).

Once installed, the skill loads automatically when you ask your agent to install,
set up, configure, or troubleshoot CKEditor.

## What's in here

```
skills/ckeditor/
├── SKILL.md                      # umbrella router + core workflow (loads first)
└── references/                   # loaded on demand
    ├── installation.md           # npm / CDN / ZIP, single-package model, versions
    ├── frameworks.md             # any-JS baseline, official wrappers, SSR
    ├── configuration.md          # editor types, plugins/toolbar, CSS, i18n, TS, CSP
    ├── licensing.md              # free/GPL, commercial keys, premium, trial/portal
    ├── gotchas.md                # universal gotchas, "don'ts," troubleshooting
    ├── documentation-access.md   # doc sources: Kapa MCP, docs site, llms-full.txt, TypeScript types, llms.txt
    └── skill-feedback.md         # how to report wrong/missing guidance
.claude-plugin/                   # Claude Code plugin + marketplace manifests
.github/ISSUE_TEMPLATE/           # skill-feedback issue form
```

The skill is **version-agnostic by design**: it carries durable, universal
knowledge and points the agent at the live docs for anything version-specific.

## Staying current

The skill works standalone, but is more effective with live docs access:

- **Docs:** <https://ckeditor.com/docs/ckeditor5/latest/>
- **`llms-full.txt`** (<https://ckeditor.com/docs/llms-full.txt>) — the guides as
  one fetchable text bundle (no API reference); and **`llms.txt`**
  (<https://ckeditor.com/llms.txt>) — a product overview (capabilities, lineup,
  pricing) with links.
- **Kapa documentation MCP** (optional): semantic search over the docs — setup in
  [`skills/ckeditor/references/documentation-access.md`](skills/ckeditor/references/documentation-access.md).

## Feedback

Found wrong, stale, or missing guidance? [Open an
issue](https://github.com/ckeditor/skills/issues/new?template=skill-feedback.yml)
with the **skill feedback** template. Agents are encouraged to file these (with
the user's awareness) when reality contradicts the skill.

## License

[MIT](LICENSE.md) © CKSource. CKEditor® is a trademark of [CKSource](https://cksource.com).
