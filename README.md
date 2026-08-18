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

`build` auto-loads `bezel.json` from the working directory when present. Run
`bezel --help` for all options.

Generated outputs live in their own directory because `build` overwrites them without
asking and adds them to `.gitignore` — keeping them out of a hand-written `src/styles`
means a generic name like `variables.css` can never clobber a file you wrote.

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
**except** building or providing a product that competes with [Bezel](https://bezel.new).
Open-source, internal, and commercial use are all permitted within that bound.
