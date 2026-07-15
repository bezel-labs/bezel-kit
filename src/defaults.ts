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
export const DEFAULT_VARIABLES_OUTPUT = "variables.css"
export const DEFAULT_NAME_EXTENSION = "com.tokendesigner.app"
