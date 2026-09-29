<!--

This repository uses Markdown files to define changelog entries. If the changes in this pull request are **user-facing** (anything an agent or a developer using the skill will notice), create a changelog entry by running:

    pnpm run nice

This generates an `*.md` file in the `.changelog/` directory. You can create as many as you need.

If your PR is internal-only (tests, tooling, CI), skip this step and mention it below.

-->

### Summary

*A brief summary of what this PR changes.*

### Related issues

<!-- GitHub needs the issues listed here to link and close them automatically. -->

* Closes #000

### Notes

*Optional: decisions, edge cases, or anything helpful for reviewers.*

### Checklists

If an item is **not relevant** to this change, leave it unchecked.

#### Author checklist

- [ ] Is the changelog entry intentionally omitted?
- [ ] Does the guidance match the current CKEditor 5 documentation?
- [ ] Is the guidance version-agnostic, or does it point the agent at the live docs for version-specific facts?
- [ ] Do all links point at official CKEditor sources?
- [ ] Have you tried the changed skill with at least one agent (for example Claude Code or Codex)?
- [ ] Are the `.claude-plugin/` manifests updated when a skill is added, renamed, or removed?
- [ ] Do the tests pass (`pnpm test`) when `scripts/` changed?

#### Reviewer checklist

- [ ] The PR description explains the change and the chosen approach.
- [ ] The changelog entry is clear and describes any breaking changes.
- [ ] I tried the changed skill with an agent, or I verified the guidance against the documentation.
- [ ] The target branch is correct.
