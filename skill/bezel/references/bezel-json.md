# bezel.json reference

`bezel.json` lives at the repo root (or the working directory `bezel build` runs in). `bezel build` loads it automatically; `bezel init` writes it. The tokens input is always `design-tokens.json` in that same directory and is not configurable.

| Field | Default | Used by | Meaning |
|---|---|---|---|
| `projectId` | none | MCP | UUID of the Bezel project this repo tracks. Set with `npx bezel init --project <uuid>`. |
| `version` | `"latest"` | MCP | Which tokens snapshot to fetch: `"latest"` or a published semver such as `"1.4.0"`. Set with `--tokens-version`. |
| `variablesOutput` | `"src/bezel/variables.css"` | build | Generated CSS file. Import this from the app entry. |
| `contextsOutput` | none | build | When set, writes a TypeScript module exporting `CONTEXTS` (the context names). |
| `fontsOutput` | none | build | When set, writes a TypeScript module exporting `FONTS` (web fonts derived from the tokens). |
| `contexts` | `{ "$root": ":root", "dark": ".dark", "light": ".light" }` | build | Context name -> CSS selector. The first entry is the base context and is emitted in full; the rest are override-only blocks. |
| `colorFormat` | `"oklch"` | build | `"oklch"` or `"hex"`. |
| `dimensionUnit` | `"preserve"` | build | `"preserve"` keeps authored units; `"rem"` converts `px` to `rem`. |
| `nameExtension` | `"com.bezel.app"` | build | The `$extensions` key that holds `exportName`. Only change for files exported before the 0.3.0 rename. |
| `includeAll` | `false` | build | Also emit a variable for every token without an `exportName`, named by its kebab-cased path (`--base-color-primary-500`). |
| `write` | `true` | build | `false` returns the CSS without writing files (programmatic use). |
| `gitignore` | `true` | build | Maintain a `# bezel:start` ... `# bezel:end` block in `.gitignore` listing the generated outputs. |
| `gitignorePath` | `".gitignore"` | build | Which `.gitignore` to manage. |
| `cwd` | process cwd | build | Base directory paths resolve against. |

`projectId` and `version` are ignored by `bezel build`; everything else is ignored by the MCP. The synced revision lives in `design-tokens-lock.json`, not here.

## design-tokens-lock.json

Committed next to `design-tokens.json`, like `package-lock.json` next to `package.json`. It records the tokens and project revision this repo last synced or pushed: `lockfileVersion`, `projectId`, `version`, `revision`, and `tokens`. `bezel diff` compares `design-tokens.json` against it to find local edits. Only `bezel sync` writes it, after every sync and every push; never edit it. `bezel init --project` deletes a lockfile that belongs to a different project.

## CLI

```
bezel init [--project <uuid>] [--tokens-version <v>] [--dir <path>] ...   create or update bezel.json
bezel build [--stdout] [--no-gitignore] ...                                generate the outputs (default command)
bezel install-mcp [--client <name>]                                        connect an AI coding tool to the Bezel MCP
bezel install-skills [--client <name>] [--no-agents-md]                    install this skill into the repo
bezel diff [--json]                                                        local edits vs design-tokens-lock.json (--json: JSON Patch operations for a push)
bezel sync [--discard-local-edits]                                         apply .bezel/sync.json: write the lockfile and design-tokens.json, then build
```

`bezel sync` exits with code 2 when `design-tokens.json` has edits Bezel does not have; other problems exit with 1.

`bezel init` on an existing `bezel.json` with `--project` or `--tokens-version` updates only those keys. Any other re-run leaves the file alone unless `--force` is passed, which agents must not do.
