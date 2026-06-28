# Documentation access (stay current)

This skill is intentionally version-agnostic. For anything version-specific —
exact config keys, current feature/plugin lists, API signatures, CDN version
numbers, error strings — **consult the live docs at use time** instead of relying
on training data.

There are several complementary sources. They are **not ranked** — each wins for
a different task, so pick by the task at hand:

| Source | Sweet spot |
|---|---|
| **Kapa MCP** | Natural-language, RAG-based research across *all* the docs. Best when you don't yet know where the answer lives. |
| **Docs site (direct)** | Targeted reading of a known page. The source material, so **highest confidence** — and the only source with the full **API reference**. |
| **`llms-full.txt`** | The guides in one file: fewest roundtrips, but a large token cost. **Guides/feature guides only — no API reference.** |
| **TypeScript types (npm)** | API documentation as JSDoc, readable **offline** from `node_modules`; fastest for a quick class/method/config signature check. |
| **`llms.txt`** | Product overview (capabilities, lineup, pricing). Not docs. |

## Version routing

The skill is rooted at the **latest** release. Match the docs (and the sources
above) to the project's version:

- **Latest** (recommended default): <https://ckeditor.com/docs/ckeditor5/latest/>.
- **LTS** edition: versioned docs at `…/lts-v47/…`.
- **Pinned older** version: version-numbered docs URLs (for example `…/42.0.0/…`).

**Kapa and `llms-full.txt` cover the latest docs only** — for LTS or a pinned
version, use the versioned docs-site URLs above. Recommend upgrading to latest
where feasible; cross-version upgrades and breaking-change fixes are **out of
scope** for this skill.

## Kapa documentation MCP (optional)

A hosted MCP server (powered by Kapa.ai) giving agents **semantic search over the
CKEditor 5 docs**, answered with the most relevant snippets plus source links.
**Optional, never a dependency** — the skill works without it — but it makes
docs-grounded work markedly more effective and, because it queries live docs,
reinforces version-agnosticism. Use it to find the right guide/API page from a
natural-language question, or to verify how a feature/config is supposed to work.

- **Endpoint:** `https://ckeditor5.mcp.kapa.ai/`
- **Auth:** Google SSO

**Turn it on — Claude Code** (`.mcp.json` or settings):

```json
{
  "mcpServers": {
    "ckeditor5": {
      "type": "http",
      "url": "https://ckeditor5.mcp.kapa.ai"
    }
  }
}
```

**Turn it on — Codex** (`~/.codex/config.toml`):

```toml
# CKEditor 5 Docs via Kapa (hosted streamable HTTP MCP server)
[mcp_servers.ckeditor5-docs]
url = "https://ckeditor5.mcp.kapa.ai"
startup_timeout_sec = 20
tool_timeout_sec = 60
enabled = true
```

**Pitfall — prefer a sub-agent.** Kapa can return large doc chunks that flood the
context and inflate token use; query it **through a sub-agent** that returns only
a short summary plus source links.

**Caveat — coverage.** Kapa indexes the **latest** docs only (see [Version
routing](#version-routing)).

## `llms-full.txt`

<https://ckeditor.com/docs/llms-full.txt> — a large plain-text bundle fetchable
with no setup, for fewer roundtrips than browsing page by page.

- **Scope — guides and feature guides only; no API reference.** For API details
  use Kapa, the docs site's API section, or the shipped TypeScript types.
- **Prefer a sub-agent.** It's a massive file that will flood the context; fetch
  and search it **through a sub-agent** that returns only a short summary plus the
  relevant excerpts/links (same as Kapa).
- Covers the **latest** docs only (see [Version routing](#version-routing)).
