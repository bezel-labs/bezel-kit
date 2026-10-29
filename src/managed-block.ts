/**
 * bezel — managed-block merging for text files Bezel shares with the user.
 *
 * Pure string transforms (no `node:fs`): given a file's existing contents and the
 * lines Bezel wants to own, produce the new contents. Bezel's lines live between a
 * start and end marker so repeated runs rewrite just that span — stale lines drop out,
 * nothing duplicates, and everything the user wrote outside the markers is preserved.
 * `.gitignore` uses `#` comment markers; `AGENTS.md` uses HTML comment markers.
 */

export interface BlockMarkers {
  /** Opening marker line. */
  start: string
  /** Closing marker line. */
  end: string
}

/**
 * Merge a managed block into existing file contents.
 *
 * - Empty `existing` → just the block.
 * - An existing block (delimited by the markers) → replaced in place, preserving
 *   everything before and after.
 * - No block → appended after the existing content, separated by a blank line.
 *
 * The result always ends with a single trailing newline.
 */
export function mergeManagedBlock(
  existing: string,
  lines: string[],
  markers: BlockMarkers,
): string {
  const block = [markers.start, ...lines, markers.end].join("\n")

  if (existing.trim() === "") return `${block}\n`

  const start = existing.indexOf(markers.start)
  if (start !== -1) {
    const endMarker = existing.indexOf(markers.end, start)
    if (endMarker !== -1) {
      const before = existing.slice(0, start).replace(/\n+$/, "")
      const after = existing.slice(endMarker + markers.end.length).replace(/^\n+/, "")
      const head = before === "" ? "" : `${before}\n\n`
      const tail = after === "" ? "" : `\n\n${after.replace(/\n+$/, "")}`
      return `${head}${block}${tail}\n`
    }
  }

  return `${existing.replace(/\n+$/, "")}\n\n${block}\n`
}
