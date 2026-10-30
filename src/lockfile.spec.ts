import { buildLockfile, parseLockfile, serializeLockfile } from "./lockfile"

const PROJECT = "0f7a4c2e-1b3d-4e5f-8a9b-0c1d2e3f4a5b"
const tokens = { color: { primary: { $type: "color", $root: { $value: "#ff8800" } } } }

describe("parseLockfile", () => {
  const text = serializeLockfile(buildLockfile({ projectId: PROJECT, version: "latest", revision: 3, tokens }))

  it("round-trips a built lockfile", () => {
    const parsed = parseLockfile(text)
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.lockfile).toEqual({ lockfileVersion: 1, projectId: PROJECT, version: "latest", revision: 3, tokens })
    expect(text.endsWith("}\n")).toBe(true)
  })

  it("explains git merge conflict markers", () => {
    const merged = `<<<<<<< HEAD\n${text}=======\n${text}>>>>>>> branch\n`
    const parsed = parseLockfile(merged)
    expect(parsed).toMatchObject({ ok: false, reason: "invalid-json" })
    if (!parsed.ok) expect(parsed.message).toContain("merge conflict markers")
  })

  it("rejects other JSON shapes", () => {
    expect(parseLockfile(JSON.stringify({ projectId: PROJECT }))).toMatchObject({ ok: false, reason: "invalid-shape" })
  })
})
