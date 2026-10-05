# @bezel-labs/bezel-kit

Convert a [W3C Design Tokens (DTCG)](https://tr.designtokens.org/) file into a scoped
`variables.css` — one CSS scope per context (e.g. `:root`, `.dark`, `.light`). Token
references are resolved to literal values, and every non-base context is emitted as an
override-only block.

The core is isomorphic (browser / edge / Node) and imports no `node:*`. An optional Node
entry and a `bezel` CLI add file-system conveniences for build-time generation.

## Install

```sh
npm install @bezel-labs/bezel-kit
```

## Usage

### Core — `tokensToCss` (isomorphic, no file system)

```ts
import { tokensToCss, type DtcgNode } from "@bezel-labs/bezel-kit"

const css: string = tokensToCss(tokens)
const hexCss = tokensToCss(tokens, { colorFormat: "hex" })
const allCss = tokensToCss(tokens, { includeAll: true }) // see "Variable names" below
```

### Node — `generateVariablesCss` (reads/writes files)

The tokens file is always read from `design-tokens.json` at the project root — its name and
location are fixed and not configurable.

```ts
import { generateVariablesCss } from "@bezel-labs/bezel-kit/node"

// reads ./design-tokens.json, writes ./src/bezel/variables.css
await generateVariablesCss()
```

### CLI

```sh
bezel init [options]    # create a bezel.json for this project
bezel build [options]   # generate the outputs (default command)
```

`init` writes the config so you don't have to author it by hand, picking defaults from
the project: outputs go to `src/bezel/` (or `bezel/` with no `src/`), and the generated
`contexts.ts`/`fonts.ts` modules are only scaffolded for a TypeScript project. Override
any of it with `--dir`, `--variables-output`, `--contexts-output`, `--fonts-output`,
`--no-contexts`, `--no-fonts`, `--color`, `--unit`. An existing `bezel.json` is never
overwritten without `--force`.

Link the repo to a Bezel project with `--project <uuid>`, and pin which tokens the Bezel
MCP fetches with `--tokens-version <v>` (`latest` or a published semver like `1.4.0`;
default `latest`). These two flags update only their own key in an existing `bezel.json`,
so no `--force` is needed:

```sh
bezel init --project 0f7a4c2e-1b3d-4e5f-8a9b-0c1d2e3f4a5b --tokens-version 1.4.0
```

`build` auto-loads `bezel.json` from the working directory when present. Run
`bezel --help` for all options.

### Config — `bezel.json`

Any `BezelOptions` key can be set in `bezel.json` (`variablesOutput`, `contextsOutput`,
`fontsOutput`, `colorFormat`, `dimensionUnit`, `nameExtension`, `includeAll`, ...). Two keys describe
the project link rather than the build:

- `projectId` (optional) — the Bezel project this repo is linked to (a UUID).
- `version` (recommended, default `latest`) — the tokens the Bezel MCP fetches: `latest`
  for the project's latest snapshot, or a published semver like `1.4.0`.

Both are read only by the Bezel MCP and ignored by `build`.

```json
{
  "projectId": "0f7a4c2e-1b3d-4e5f-8a9b-0c1d2e3f4a5b",
  "version": "latest",
  "variablesOutput": "src/bezel/variables.css"
}
```

Generated outputs live in their own directory because `build` overwrites them without
asking and adds them to `.gitignore` — keeping them out of a hand-written `src/styles`
means a generic name like `variables.css` can never clobber a file you wrote.

## Variable names

Bezel tokens carry an `exportName` list (under the `nameExtension` key) that names their CSS
variables — one token can emit several (`foreground`, `card-foreground`, ...). By default only
tokens with an `exportName` emit a variable; the rest (for example the `base.*` color ramps)
exist only as reference targets, and references to them are resolved to literal values.

Set `includeAll` (`--include-all` on the CLI, `"includeAll": true` in `bezel.json`) to also
emit a variable for every token without an `exportName`, named by kebab-casing its full path:

```css
:root {
  --primary: oklch(0.8 0.18 151.7);                 /* exportName: primary */
  --base-color-green-500: oklch(0.8 0.18 151.7);    /* generated from base.color.green.500 */
}
```

- Tokens that have an `exportName` keep only their export names; they are not duplicated under
  their path.
- An export name always wins if it equals a generated name, and the first token wins among
  generated names.
- A token whose `exportName` is only empty strings counts as having no name, so it is emitted
  under its path.
- If no token in the file has an `exportName` at all, every token is already emitted with a
  path-derived name (`--color-primary-default`), and `includeAll` changes nothing.
- Per-context blocks work as before: they contain only the variables whose value differs from
  `:root`.

## Upgrading to 0.3.0

The default `$extensions` namespace changed from `com.tokendesigner.app` to
`com.bezel.app`. Tokens still carrying the old key no longer match the default, so
`bezel build` falls back to path-derived names (`--color-primary-default` instead of
the authored `--primary`).

Either re-export `design-tokens.json` from Bezel, or pin the old key in `bezel.json`:

```json
{ "nameExtension": "com.tokendesigner.app" }
```

## API

- **Core (`.`):** `tokensToCss`, `emitCss`, `resolveCssOptions`, `getContexts`,
  `formatContextsModule`, `getFonts`, `formatFontsModule`, the `DEFAULT_CONTEXTS` /
  `DEFAULT_NAME_EXTENSION` defaults, plus the related types.
- **Node (`./node`):** everything above, plus `generateVariablesCss`, `resolveOptions`,
  `initConfig`, and the `DEFAULT_OUTPUT_DIR` / `DEFAULT_CONFIG_FILE` defaults.

## Development

```bash
npm install     # install deps
npm run build   # bundle ESM + CJS + types (index, node, cli) with tsup
npm test        # run the Jest test suite
npm run typecheck
```

## License

[PolyForm Shield 1.0.0](./LICENSE) — free to use, modify, and redistribute for any purpose
**except** building or providing a product that competes with [Bezel](https://bezel.new/?utm_source=github&utm_medium=referral&utm_content=bezel-kit-readme).
Open-source, internal, and commercial use are all permitted within that bound.
