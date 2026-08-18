/**
 * Pure default constants shared by the isomorphic core and the Node layer.
 * Kept free of `node:*` imports so the browser/edge entry can use them.
 */

/** Default context → selector mapping. The first key is the base context. */
export const DEFAULT_CONTEXTS: Record<string, string> = {
  $root: ":root",
  dark: ".dark",
  light: ".light",
}

/**
 * The DTCG input file the CLI reads from the project root. This is a cross-system
 * contract: it MUST stay in sync with the platform's `TOKENS_FILE_NAME` constant
 * (gundam: libs/keypuncher/data/constants/src/lib/tokens-file.ts) so any repo/app
 * the platform connects to resolves its tokens at the same name + location.
 */
export const DEFAULT_INPUT = "design-tokens.json"

/**
 * Directory generated outputs are written to, relative to the project root.
 *
 * Everything Bezel emits is generated and gitignored, and `bezel build` overwrites
 * without asking — so outputs live in their own directory rather than alongside
 * hand-written files, where a generic name like `variables.css` or `fonts.ts` could
 * silently clobber something the user wrote. {@link FALLBACK_OUTPUT_DIR} is used by
 * `bezel init` for projects with no `src/`.
 */
export const DEFAULT_OUTPUT_DIR = "src/bezel"
/** Output directory `bezel init` picks when the project has no `src/`. */
export const FALLBACK_OUTPUT_DIR = "bezel"

/** Generated output filenames, joined onto the output directory. */
export const VARIABLES_FILE = "variables.css"
export const CONTEXTS_FILE = "contexts.ts"
export const FONTS_FILE = "fonts.ts"

export const DEFAULT_VARIABLES_OUTPUT = `${DEFAULT_OUTPUT_DIR}/${VARIABLES_FILE}`
export const DEFAULT_NAME_EXTENSION = "com.tokendesigner.app"

/** The config file `bezel init` writes and `bezel build` auto-loads from the project root. */
export const DEFAULT_CONFIG_FILE = "bezel.json"
