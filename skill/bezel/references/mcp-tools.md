# Bezel MCP quick reference

Remote server at `https://mcp.bezel.new/mcp` (Streamable HTTP, OAuth). The server returns data and instructions; the coding agent performs every local file edit and command. Project-scoped tools take the `projectId` from `bezel.json` or from `find-project`.

## Guided workflows

| Tool / prompt | Use |
|---|---|
| `setup-project` (tool and prompt) | Resumable setup: install bezel-kit, link a project, write `bezel.json`, fetch tokens, build, wire the CSS import, optional Crystal live preview. |
| `sync-project` (prompt) | Refresh `design-tokens.json` from the linked project and version, then rebuild. |
| `safe-usage-guide` (prompt) | Context-budget rules: manifest first, targeted queries, cite token paths. |
| `manifest-first-workflow`, `context-resolution` (prompts) | Recommended reading order and how contexts resolve. |
| `get-agent-guide` (tool) | Returns this skill's text when the repo has no local copy. |

## Discovery

| Tool | Parameters | Returns |
|---|---|---|
| `find-project` | `query?` | All owned projects (name + id), or one project resolved from a name or UUID. |
| `get-project-manifest` | `projectId` | Groups, token counts, types, contexts. No values. Call this first. |

## Repo sync

| Tool | Parameters | Returns |
|---|---|---|
| `get-design-tokens-file` | `projectId`, `version?` | The exact `design-tokens.json` content to write to disk, plus project name and version. Unknown version -> list of available versions. |

## Reading tokens

| Tool | Parameters | Returns |
|---|---|---|
| `query-tokens` | `projectId`, `groupPath?`, `tokenType?`, `search?`, `exportName?`, `contextKey?`, `resolveAliases?` | Filtered tokens. |
| `get-token-by-path` | `projectId`, `tokenPath`, `contextKey?`, `resolveAliases?` | One token with every context value and alias detail. |
| `get-token-bundle` | `projectId`, `intent` | Curated set: `theming-setup`, `button`, `card`, `input`, `form`, `auth-page`, `dashboard-shell`. |
| `get-project-contexts` | `projectId` | Context groups and values (theme modes, platforms, brands). |
| `resolve-context` | `projectId`, `contextGroup`, `contextValue` | Canonical context value or a structured error. |

## Generating code

| Tool | Parameters | Returns |
|---|---|---|
| `export-tokens` | `projectId`, `format` (`css-variables`, `js-object`, `ts-object`), filters, `prefix?`, `includeAll?` | Generated code with aliases resolved. |
| `get-framework-overrides` | `projectId`, `framework` (`tailwind`, `shadcn`, `mantine`), `version?`, filters | Framework config derived from the tokens. |

## Color and unit math (deterministic)

| Tool | Parameters |
|---|---|
| `contrast-check` | `foreground`, `background` -> WCAG ratio, grade, recommendations |
| `color-convert` | `color`, `targetFormat`, `manipulation?`, `mixColor?` |
| `color-ramp` | `baseColor`, `steps`, `endColor?`, `colorSpace?` |
| `unit-convert` | `value`, `fromUnit`, `toUnit`, `rootFontSize?`, `parentFontSize?` |

## Review and history

| Tool | Parameters |
|---|---|
| `design-review` | `projectId`, `componentDescription`, `tokenPathsUsed?`, `contextKey?` |
| `get-chat-history` | `projectId` |
| `search-chat-history` | `projectId`, `query` |

## Resources

- `bezel://projects`: your projects with ids and names.
- `bezel://agent-guide`: this skill's text.
