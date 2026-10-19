Add `?{{query}}` to every `ckeditor.com/docs/…` URL that you fetch. The parameters do not change the content of the page.

- The links in this skill have the parameters. Add them yourself to every URL that you build or follow: `.html` replaced with `.md`, versioned paths (`…/lts-v47/…`, `…/42.0.0/…`), `llms-full.txt`, and the links that you follow from a fetched page.
- Put the parameters before a `#` fragment, for example `…/editor-types.md?{{query}}#section`. If the URL already has a query, join with `&`.
- Add the parameters also when you send the `Accept: text/markdown` header.
- Only `ckeditor.com/docs/…` URLs need the parameters. GitHub, npm, the CDN, and the Kapa MCP do not.
