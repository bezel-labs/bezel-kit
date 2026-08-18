/**
 * bezel — `bezel.json` scaffolding.
 *
 * Writes the config file `bezel build` auto-loads, so a project doesn't have to
 * hand-author it. Defaults are derived from the project itself: outputs land in
 * `src/bezel/` when there's a `src/` (otherwise `bezel/`), and the TypeScript
 * modules are only scaffolded for a TypeScript project — `contexts.ts`/`fonts.ts`
 * are emitted as TS (`as const`, `export type`) and would be dead weight in a
 * JavaScript one.
 *
 * Non-destructive: an existing `bezel.json` is never overwritten without `force`.
 */
import { existsSync } from "node:fs"
import { readFile, writeFile } from "node:fs/promises"
import { isAbsolute, resolve } from "node:path"
import type { BezelOptions } from "./config"
import {
  CONTEXTS_FILE,
  DEFAULT_CONFIG_FILE,
  DEFAULT_INPUT,
  DEFAULT_OUTPUT_DIR,
  FALLBACK_OUTPUT_DIR,
  FONTS_FILE,
  VARIABLES_FILE,
} from "./defaults"

/** Options for {@link initConfig}. All optional — the zero-arg call is the happy path. */
export interface InitOptions {
  /** Project root to scaffold into. Default: `process.cwd()`. */
  cwd?: string
  /**
   * Directory for all three outputs, relative to `cwd`. Default: `"src/bezel"` when
   * the project has a `src/`, otherwise `"bezel"`. Ignored for any output whose path
   * is set explicitly.
   */
  outputDir?: string
  /** Explicit path for the generated CSS. Overrides {@link InitOptions.outputDir}. */
  variablesOutput?: string
  /** Explicit path for the generated contexts module. Implies `contexts: true`. */
  contextsOutput?: string
  /** Explicit path for the generated fonts module. Implies `fonts: true`. */
  fontsOutput?: string
  /** Include `contextsOutput`. Default: true for a TypeScript project. */
  contexts?: boolean
  /** Include `fontsOutput`. Default: true for a TypeScript project. */
  fonts?: boolean
  /** Written to the config only when set — otherwise the build default applies. */
  colorFormat?: "oklch" | "hex"
  /** Written to the config only when set — otherwise the build default applies. */
  dimensionUnit?: "preserve" | "rem"
  /** Overwrite an existing `bezel.json`. Default: `false`. */
  force?: boolean
}

/** Outcome of {@link initConfig}. */
export interface InitResult {
  /** Absolute path of the config file. */
  configPath: string
  /** The config that was written — or the one that would have been, when `written` is false. */
  config: BezelOptions
  /** False when an existing `bezel.json` was left untouched (no `force`). */
  written: boolean
  /** Whether a `design-tokens.json` is already present at the project root. */
  hasTokensFile: boolean
  /** Whether the project looks like TypeScript (drives the contexts/fonts defaults). */
  isTypeScript: boolean
}

/**
 * Join config path segments with forward slashes.
 *
 * Config values are portable JSON, so they always use `/` — `node:path.join` would
 * emit backslashes on Windows and bake a platform into a committed file.
 */
const joinPath = (dir: string, file: string): string =>
  dir === "" ? file : `${dir.replace(/\/+$/, "")}/${file}`

/**
 * Create a `bezel.json` in the project root, inferring sensible defaults from the
 * project layout.
 *
 * @example
 * // src/bezel/{variables.css,contexts.ts,fonts.ts} for a TS project with a src/
 * await initConfig()
 *
 * @example
 * await initConfig({ outputDir: "packages/ui/src/bezel", fonts: false })
 */
export async function initConfig(options: InitOptions = {}): Promise<InitResult> {
  const cwd = options.cwd ?? process.cwd()
  const toAbs = (p: string) => (isAbsolute(p) ? p : resolve(cwd, p))

  const configPath = toAbs(DEFAULT_CONFIG_FILE)
  const hasTokensFile = existsSync(toAbs(DEFAULT_INPUT))
  const isTypeScript = existsSync(toAbs("tsconfig.json"))

  const hasSrc = existsSync(toAbs("src"))
  const outputDir = options.outputDir ?? (hasSrc ? DEFAULT_OUTPUT_DIR : FALLBACK_OUTPUT_DIR)

  // An explicit path is itself an opt-in; otherwise TypeScript projects get the
  // generated modules and JavaScript ones don't.
  const wantsContexts = options.contextsOutput !== undefined || (options.contexts ?? isTypeScript)
  const wantsFonts = options.fontsOutput !== undefined || (options.fonts ?? isTypeScript)

  const config: BezelOptions = {
    variablesOutput: options.variablesOutput ?? joinPath(outputDir, VARIABLES_FILE),
  }
  if (wantsContexts) {
    config.contextsOutput = options.contextsOutput ?? joinPath(outputDir, CONTEXTS_FILE)
  }
  if (wantsFonts) {
    config.fontsOutput = options.fontsOutput ?? joinPath(outputDir, FONTS_FILE)
  }
  // Only persist the transform options that were asked for, so the file stays minimal
  // and keeps tracking the library defaults for everything else.
  if (options.colorFormat) config.colorFormat = options.colorFormat
  if (options.dimensionUnit) config.dimensionUnit = options.dimensionUnit

  if (existsSync(configPath) && !options.force) {
    return { configPath, config, written: false, hasTokensFile, isTypeScript }
  }

  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8")

  return { configPath, config, written: true, hasTokensFile, isTypeScript }
}

/**
 * Read the `"scripts"` block of the project's `package.json`, if there is one.
 * Used only to tailor the post-init hint — a missing or unparsable file is not an error.
 */
export async function readPackageScripts(cwd: string): Promise<Record<string, string>> {
  try {
    const raw = await readFile(resolve(cwd, "package.json"), "utf8")
    const parsed = JSON.parse(raw) as { scripts?: Record<string, string> }
    return parsed.scripts ?? {}
  } catch {
    return {}
  }
}
