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

// reads ./design-tokens.json, writes ./variables.css
await generateVariablesCss()
```

### CLI

```sh
bezel build [options]
```

Auto-loads a `bezel.json` config from the working directory when present. Run
`bezel --help` for all options.

## API

- **Core (`.`):** `tokensToCss`, `emitCss`, `resolveCssOptions`, `getContexts`,
  `formatContextsModule`, `getFonts`, `formatFontsModule`, the `DEFAULT_CONTEXTS` /
  `DEFAULT_NAME_EXTENSION` defaults, plus the related types.
- **Node (`./node`):** everything above, plus `generateVariablesCss` and `resolveOptions`.

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
