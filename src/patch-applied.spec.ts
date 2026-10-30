import { compare, applyPatch, deepClone } from "fast-json-patch"
import { isPatchApplied, unappliedOperations } from "./patch-applied"

const base = {
  color: {
    primary: { $type: "color", $root: { $value: "#ff8800" } },
    secondary: { $type: "color", $root: { $value: "#0088ff" } },
  },
}

const edited = {
  color: {
    primary: { $type: "color", $root: { $value: "#000000" } },
    accent: { $type: "color", $root: { $value: "#ff00ff" } },
  },
}

const ops = compare(base, edited, true)

describe("isPatchApplied", () => {
  it("is false against the base and true against the result", () => {
    expect(isPatchApplied(base, ops)).toBe(false)
    const applied = applyPatch(deepClone(base), ops).newDocument
    expect(isPatchApplied(applied, ops)).toBe(true)
  })

  it("is true when Bezel holds the edits plus unrelated changes", () => {
    const bezel = deepClone(edited) as typeof edited & { spacing?: unknown }
    bezel.spacing = { sm: { $type: "dimension", $root: { $value: "4px" } } }
    expect(isPatchApplied(bezel, ops)).toBe(true)
  })

  it("lists only the edits the document lacks", () => {
    const partial = deepClone(base) as typeof base
    partial.color.primary = { $type: "color", $root: { $value: "#000000" } }
    const missing = unappliedOperations(partial, ops).map((operation) => `${operation.op} ${operation.path}`)
    expect(missing).toEqual(expect.arrayContaining(["remove /color/secondary", "add /color/accent"]))
    expect(missing).not.toContain("replace /color/primary/$root/$value")
  })

  it("ignores test guards", () => {
    expect(isPatchApplied(base, [{ op: "test", path: "/nope", value: 1 }])).toBe(true)
  })
})
