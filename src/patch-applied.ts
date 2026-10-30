/**
 * Whether RFC 6902 operations are already reflected in a document, without applying them.
 *
 * Two places need this. `bezel sync` uses it to tell local edits Bezel already has (a push
 * that landed) from edits that would be lost. The Bezel MCP uses it to recognize a push
 * that was already saved, so a repeat is "no changes" instead of a false conflict. Pure:
 * no dependencies, safe in any runtime.
 */

/** One RFC 6902 operation, as produced by `fast-json-patch`'s `compare`. */
export interface JsonPatchOperation {
  op: "add" | "remove" | "replace" | "move" | "copy" | "test"
  path: string
  value?: unknown
  from?: string
}

/** Anything shaped like an operation, so `fast-json-patch`'s wider `Operation` type fits too. */
export interface PatchOperationLike {
  op: string
  path: string
  value?: unknown
  from?: string
}

const MISSING = Symbol("missing")

const decodeSegment = (segment: string) => segment.replace(/~1/g, "/").replace(/~0/g, "~")

/** The value at a JSON pointer, or `MISSING`. */
function valueAt(document: unknown, pointer: string): unknown {
  if (pointer === "") return document
  let node: unknown = document
  for (const raw of pointer.split("/").slice(1)) {
    const segment = decodeSegment(raw)
    if (Array.isArray(node)) {
      const index = Number(segment)
      if (!Number.isInteger(index) || index < 0 || index >= node.length) return MISSING
      node = node[index]
    } else if (typeof node === "object" && node !== null && Object.prototype.hasOwnProperty.call(node, segment)) {
      node = (node as Record<string, unknown>)[segment]
    } else {
      return MISSING
    }
  }
  return node
}

/** Structural equality for JSON values; object key order does not matter. */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => jsonEqual(item, b[i]))
  }
  const aKeys = Object.keys(a as object)
  const bKeys = Object.keys(b as object)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(b, key) &&
      jsonEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  )
}

/** True when the document already holds the result of this one operation. `test` is always true. */
export function isOperationApplied(document: unknown, operation: PatchOperationLike): boolean {
  switch (operation.op) {
    case "test":
      return true
    case "add":
    case "replace": {
      const current = valueAt(document, operation.path)
      return current !== MISSING && jsonEqual(current, operation.value)
    }
    case "remove":
      return valueAt(document, operation.path) === MISSING
    case "copy": {
      const target = valueAt(document, operation.path)
      return target !== MISSING && jsonEqual(target, valueAt(document, operation.from ?? ""))
    }
    case "move":
      return (
        valueAt(document, operation.path) !== MISSING &&
        (operation.from === undefined || valueAt(document, operation.from) === MISSING)
      )
    default:
      return false
  }
}

/** The operations (ignoring `test` guards) the document does not reflect yet. */
export function unappliedOperations<T extends PatchOperationLike>(document: unknown, operations: readonly T[]): T[] {
  return operations.filter((operation) => operation.op !== "test" && !isOperationApplied(document, operation))
}

/** True when every non-`test` operation is already reflected in the document. */
export function isPatchApplied(document: unknown, operations: readonly PatchOperationLike[]): boolean {
  return unappliedOperations(document, operations).length === 0
}
