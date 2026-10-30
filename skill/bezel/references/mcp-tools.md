# Bezel MCP quick reference

Remote server at `https://mcp.bezel.new/mcp` (Streamable HTTP, OAuth). The server returns data and instructions; the coding agent performs every local file edit and command. Project-scoped tools take the `projectId` from `bezel.json` or from `find-project`.

## Guided workflows

| Tool / prompt | Use |
|---|---|
| `setup-project` (tool and prompt) | Resumable setup: install bezel-kit, link a project, write `bezel.json`, fetch tokens, build, wire the CSS import, optional Crystal live preview. |
| `sync-project` (prompt) | Refresh `design-tokens.json` and `design-tokens-lock.json` from the linked project and version through `bezel sync`. Offers to push local edits first instead of overwriting them. |
| `push-project` (prompt) | Diff and push the repo's token edits to the linked project (asking the user first only when Bezel changed), then sync so `design-tokens-lock.json` moves to the new revision. |
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
| `get-design-tokens-file` | `projectId`, `version?` | `lockfileContent`: the full `design-tokens-lock.json` text (tokens + `revision`). Write it to `.bezel/sync.json` and run `npx bezel sync`. Unknown version -> list of available versions. |
| `preview-design-tokens-push` | `projectId`, `operations`, `baseRevision?`, `trackedVersion?` | Checks the edits from `npx bezel diff --json` against the working tokens: plan-limit problems, `conflict` (tokens edited here and in Bezel), themes the edits add (`addedContexts`), `behind` when Bezel moved on (those changes are kept), and a `confirmationPrompt`. Saves nothing; optional, for when the user wants to see a push first. |
| `push-design-tokens` | `projectId`, `operations`, `baseRevision?`, `trackedVersion?`, `confirmed?` | Saves the edits as a new revision when Bezel is still at `baseRevision`. If Bezel changed, saves nothing and returns `needs-confirmation` with a `confirmationPrompt`; call again with `confirmed: true` only after the user says yes. Returns the new `revision`. Sync right after it so the lockfile moves to that revision. |

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
