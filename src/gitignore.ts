/**
 * bezel — `.gitignore` managed-block merging.
 *
 * Given the existing `.gitignore` contents and the list of generated outputs to
 * ignore, produce the new contents. Bezel's entries live inside a marked block so
 * repeated runs rewrite just that span — renamed/removed outputs drop out
 * automatically and entries never duplicate, while the user's own rules outside the
 * markers are preserved. See {@link mergeManagedBlock} for the shared mechanics.
 */
import { mergeManagedBlock } from "./managed-block"

/** Opening marker for the Bezel-managed block. */
export const START = "# bezel:start (generated — do not edit)"
/** Closing marker for the Bezel-managed block. */
export const END = "# bezel:end"

/**
 * Merge Bezel's managed block into existing `.gitignore` contents.
 *
 * - Empty `existing` → just the block.
 * - An existing block (delimited by {@link START}…{@link END}) → replaced in place,
 *   preserving everything before and after.
 * - No block → appended after the existing content, separated by a blank line.
 *
 * The result always ends with a single trailing newline.
 */
export function mergeGitignore(existing: string, entries: string[]): string {
  return mergeManagedBlock(existing, entries, { start: START, end: END })
}
