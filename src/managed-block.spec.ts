import { mergeManagedBlock } from "./managed-block"

const MARKERS = { start: "<!-- x:start -->", end: "<!-- x:end -->" }
const LINES = ["## Rules", "", "- one", "- two"]
const BLOCK = `${MARKERS.start}\n${LINES.join("\n")}\n${MARKERS.end}`

describe("mergeManagedBlock", () => {
  it("returns just the block for empty input", () => {
    expect(mergeManagedBlock("", LINES, MARKERS)).toBe(`${BLOCK}\n`)
  })

  it("appends after existing content with a blank line", () => {
    expect(mergeManagedBlock("# Repo\n\nHello.\n", LINES, MARKERS)).toBe(`# Repo\n\nHello.\n\n${BLOCK}\n`)
  })

  it("replaces an existing block in place, keeping text on both sides", () => {
    const existing = `# Repo\n\n${MARKERS.start}\nold\n${MARKERS.end}\n\n## Mine\n`
    expect(mergeManagedBlock(existing, LINES, MARKERS)).toBe(`# Repo\n\n${BLOCK}\n\n## Mine\n`)
  })

  it("is idempotent", () => {
    const once = mergeManagedBlock("# Repo\n", LINES, MARKERS)
    expect(mergeManagedBlock(once, LINES, MARKERS)).toBe(once)
  })

  it("leaves a different tool's markers alone", () => {
    const other = "<!-- other:start -->\nstuff\n<!-- other:end -->\n"
    expect(mergeManagedBlock(other, LINES, MARKERS)).toBe(`${other.trimEnd()}\n\n${BLOCK}\n`)
  })
})
