---
name: ckeditor-v49-migration
description: >-
  Use when upgrading a CKEditor 5 project to v49, or fixing code that broke
  after that upgrade — APIs removed or renamed in v49, component props and
  events that no longer exist, imports that stop resolving. Routes to a
  reference for the specific change at hand. Covers plain JavaScript and the
  React, Vue and Angular integrations. v49 removes the Watchdog, so this also
  applies to code that constructs `EditorWatchdog` or `ContextWatchdog`, calls
  `watchdog.create()`, or passes `disableWatchdog`, `watchdogConfig`,
  `watchdog-config`, `disable-watchdog` or the Angular `watchdog` input. NOT for
  a first CKEditor 5 installation, NOT for general configuration, and NOT for
  deciding what an application should do after an error.
license: MIT
allowed-tools:
  - Read
  - Edit
  - Bash
  - Glob
  - Grep
metadata:
  author: CKEditor (CKSource)
  version: 0.1.1
---

# CKEditor 5 — migrating to v49

v49 withdraws APIs that were correct for years, so a project that built and ran on any earlier version
can fail at runtime with nothing reported at build time. Work from the reference for the change in
front of you rather than from memory.

## The rule that outranks every reference

**Do the mechanical part only.** Withdrawing an API is mechanical; replacing what it did for the user
is not. Name that decision and leave it to a human rather than inventing an answer. Each reference
lists the ones it knows about.

## Pick the reference

| If the project… | Read |
|---|---|
| constructs `EditorWatchdog` or `ContextWatchdog`, calls `watchdog.create()`, or passes `disableWatchdog`, `watchdogConfig`, `watchdog-config`, `disable-watchdog` or the Angular `watchdog` input | `references/watchdog-migration.md` |

**Read the reference before changing anything.** Each one carries the order of work, the traps that
no compiler reports, and the list of decisions to hand back rather than make, and routes to the
documentation pages that carry the detail.

**If the project hits a v49 change that no row above covers, there is no reference for it yet.** Read
`…/latest/updating/update-to-49.md` — fetch it as markdown, swapping `.html` for `.md` — and stop
there. Report what the project hits, or that you could not reach the page, rather than improvising a
migration from memory.
