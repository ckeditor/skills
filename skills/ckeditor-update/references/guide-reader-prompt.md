# Prompt for a guide-reader sub-agent

Give each update guide to a sub-agent with this prompt. You can give the release notes of several releases to one sub-agent. Replace the values in angle brackets. The same prompt gives the same shape of output in every run, so you can merge the results into one checklist.

```text
Read <URL of the guide, or the URLs of the release notes>. Only read. Do not edit, create, or delete any file, and do not run commands that change the project.

Read only the sections of these releases: <list of releases in the range>.

Return every entry in these sections. An entry is each change that the text describes. This includes each item of a "breaking changes" list and each change inside a longer section. Do not merge entries, and do not skip entries that look optional or unrelated.

The project installs these packages: <installed CKEditor packages from the "Find the current state" step, for example "ckeditor5 only, no ckeditor5-premium-features">. It uses these plugins, config keys, and custom code: <plugins, config keys, custom plugins, converters, and CSS overrides from the "Find the current state" step>.

Return every entry that mentions one of them in full. For every other entry, return one line: the release, the section heading, and the exact names in it.

For each entry in full, return:
- the release and the section heading,
- one sentence that says what changed,
- the exact names that the entry mentions: APIs, method signatures, config keys, imports, CSS selectors and variables, packages, and error codes,
- the code snippets before and after the change, quoted exactly, if the entry has them,
- the links in the entry (issues, pull requests, other docs pages).

If an entry mentions no names, say so. Do not decide if an entry applies to the project. The main agent decides this.
```
