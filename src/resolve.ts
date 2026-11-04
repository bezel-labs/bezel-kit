import { ROOT_CONTEXT } from "./collapse"
import type { FlatToken, TokenValue } from "./types"

const REFERENCE_RE = /^\{([^{}]+)\}$/

/** Returns the referenced path if `value` is a whole-value DTCG alias `"{a.b.c}"`, else `null`. */
export function aliasTarget(value: TokenValue): string | null {
  if (typeof value !== "string") return null
  const match = REFERENCE_RE.exec(value.trim())
  return match ? match[1]!.trim() : null
}

/**
 * Resolve whole-value references in a flattened, single-context token map, in place.
 *
 * An alias names a token. In the flat map a token is keyed by its path with the context layer
 * removed, so three alias forms are followed:
 *  - `{a.b}` where `a.b` is a simple token (a direct `$value`).
 *  - `{a.b.$root}`: the token's value for the active context, with the `$root` fallback that
 *    `flattenForContext` already applied.
 *  - `{a.b.<context>}`: that one context's value, whatever context is being emitted.
 *
 * Multi-hop aliases are followed, results memoized, and cycles guarded against.
 */
export function resolveReferences(tokens: Map<string, FlatToken>): Map<string, FlatToken> {
  const resolved = new Map<string, TokenValue>()

  const lookup = (target: string): TokenValue | undefined => {
    const simple = tokens.get(target)
    if (simple) return simple.value
    const dot = target.lastIndexOf(".")
    if (dot < 0) return undefined
    const token = tokens.get(target.slice(0, dot))
    if (!token) return undefined
    const member = target.slice(dot + 1)
    return member === ROOT_CONTEXT ? token.value : token.contexts?.[member]
  }

  const resolveValue = (value: TokenValue, seen: Set<string>): TokenValue => {
    const target = aliasTarget(value)
    if (target === null) return value

    if (resolved.has(target)) return resolved.get(target)!
    if (seen.has(target)) {
      throw new Error(`bezel: circular token reference detected at "{${target}}".`)
    }

    const found = lookup(target)
    if (found === undefined) {
      throw new Error(`bezel: unresolved token reference "{${target}}".`)
    }

    seen.add(target)
    const value2 = resolveValue(found, seen)
    seen.delete(target)
    resolved.set(target, value2)
    return value2
  }

  for (const token of tokens.values()) {
    token.value = resolveValue(token.value, new Set())
  }
  return tokens
}
