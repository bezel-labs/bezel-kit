/**
 * bezel — isomorphic entry.
 *
 * The pure transform core: convert an in-memory W3C Design Tokens (DTCG) object
 * into a scoped `variables.css` string. Imports no `node:*`, so it runs anywhere
 * — browser, edge, Node. For the filesystem/CLI conveniences (reading a tokens
 * file, writing outputs), import from `bezel/node`.
 */
import { emitCss } from "./emit"
import { resolveCssOptions, type CssOptions } from "./options"
import type { DtcgNode } from "./types"

export type { CssOptions, ResolvedCssOptions } from "./options"
export type { DtcgNode, FlatToken, TokenValue, ColorValue, DimensionValue } from "./types"
export { DEFAULT_CONTEXTS, DEFAULT_NAME_EXTENSION } from "./defaults"
export { emitCss } from "./emit"
export { resolveCssOptions } from "./options"
export { getContexts, formatContextsModule, DEFAULT_CONTEXT_NAME } from "./contexts"
export { getFonts, formatFontsModule } from "./fonts"
export type { FontDef } from "./fonts"

/**
 * Convert a DTCG token object into a scoped `variables.css` string.
 *
 * Resolves each configured context (with `$root` fallback and reference
 * resolution) and emits one CSS scope per context — the base context in full,
 * others as override-only blocks. Pure: no filesystem access.
 *
 * @example
 * const css = tokensToCss(tokens)
 *
 * @example
 * const css = tokensToCss(tokens, { colorFormat: "hex", contexts: { $root: ":root" } })
 */
export function tokensToCss(tokens: DtcgNode, options: CssOptions = {}): string {
  return emitCss(tokens, resolveCssOptions(options))
}
