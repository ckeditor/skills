# Reporting feedback on this skill

This skill is meant to improve over time. When you (the agent) hit any of the
following, **open an issue** so the maintainers can fix it:

- The skill's guidance is **wrong** or contradicts what actually worked.
- It's **stale** — a rule no longer matches how the editor is updated.
- Something important is **missing** — an update path, installation method,
  or gotcha the skill didn't cover.
- An **update guide missed a breaking change** that you had to fix anyway (name
  the guide and the change).

## Where

Home repo: **<https://github.com/ckeditor/skills>** → open an issue (use the
**skill feedback** template).

## What to include

Keep it short and concrete so it's actionable:

- **From → to** — the installed and the target version.
- **Setup** — installation method (npm / CDN / ZIP / legacy build), framework +
  wrapper version, free vs premium.
- **What the skill said** vs **what actually happened** (paste the exact error
  code/message if there was one).
- **The fix or workaround** you found, if any.
- The agent/tool you're running in.

## When NOT to file here

- **Bugs in CKEditor itself** → the product repos (`ckeditor/ckeditor5`, or the
  relevant integration repo).
- **Mistakes in an update guide** → the `ckeditor/ckeditor5` repo (the guides
  live in its `docs/` directory).
- **Account / license / billing** questions → the Customer Portal and CKEditor
  support, not this repo.

> Don't open an issue without the user's awareness. Surface what you'd report and
> let them confirm — filing publicly is an outward-facing action.
