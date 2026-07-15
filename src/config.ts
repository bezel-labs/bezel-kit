import { isAbsolute, resolve } from "node:path"
import { DEFAULT_INPUT, DEFAULT_VARIABLES_OUTPUT } from "./defaults"
import { resolveCssOptions, type CssOptions } from "./options"

export { DEFAULT_CONTEXTS, DEFAULT_INPUT, DEFAULT_VARIABLES_OUTPUT, DEFAULT_NAME_EXTENSION } from "./defaults"

/**
 * Options for {@link generateVariablesCss} — the Node, file-oriented surface.
 * Extends the pure {@link CssOptions} with input/output paths. All optional;
 * defaults make the zero-config case work.
 */
export interface BezelOptions extends CssOptions {
  /** Path to write the generated CSS. Default: `"variables.css"` (resolved from `cwd`). */
  variablesOutput?: string
  /** Base directory paths are resolved against. Default: `process.cwd()`. */
  cwd?: string
  /**
   * When set, also write a generated TypeScript module exporting `CONTEXTS` (the list of
   * context names derived from the tokens). Path resolved against `cwd`. Default: none.
   */
  contextsOutput?: string
  /**
   * When set, also write a generated TypeScript module exporting `FONTS` (the web fonts
   * derived from the tokens). Path resolved against `cwd`. Default: none.
   */
  fontsOutput?: string
  /** When `false`, return the CSS string without touching the filesystem. Default: `true`. */
  write?: boolean
  /**
   * Create/update a project `.gitignore` so the generated outputs are ignored. The
   * entries live in a marked block, rewritten on each run so renamed outputs are
   * cleaned up. Default: `true`.
   */
  gitignore?: boolean
  /** Path to the `.gitignore` to manage. Default: `".gitignore"` (resolved from `cwd`). */
  gitignorePath?: string
}

/** Fully-resolved options (no `undefined`), produced by {@link resolveOptions}. */
export interface ResolvedOptions {
  inputPath: string
  variablesOutputPath: string
  contexts: Record<string, string>
  colorFormat: "oklch" | "hex"
  dimensionUnit: "preserve" | "rem"
  nameExtension: string
  contextsOutput: string | null
  fontsOutput: string | null
  write: boolean
  gitignore: boolean
  gitignorePath: string
}

/** Apply defaults and resolve input/output paths against `cwd`. */
export function resolveOptions(options: BezelOptions = {}): ResolvedOptions {
  const cwd = options.cwd ?? process.cwd()
  const toAbs = (p: string) => (isAbsolute(p) ? p : resolve(cwd, p))

  const css = resolveCssOptions(options)

  return {
    // The tokens file is always `design-tokens.json` at the project root — not configurable.
    inputPath: toAbs(DEFAULT_INPUT),
    variablesOutputPath: toAbs(options.variablesOutput ?? DEFAULT_VARIABLES_OUTPUT),
    ...css,
    contextsOutput: options.contextsOutput ? toAbs(options.contextsOutput) : null,
    fontsOutput: options.fontsOutput ? toAbs(options.fontsOutput) : null,
    write: options.write ?? true,
    gitignore: options.gitignore ?? true,
    gitignorePath: toAbs(options.gitignorePath ?? ".gitignore"),
  }
}
