import { existsSync } from "node:fs"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { applyPatch, deepClone } from "fast-json-patch"
import { buildLockfile, serializeLockfile, serializeTokensFile, LOCKFILE_NAME, SYNC_STAGING_PATH } from "./lockfile"
import { diffTokens, syncFromStaging } from "./tokens-sync"

const PROJECT = "0f7a4c2e-1b3d-4e5f-8a9b-0c1d2e3f4a5b"
const OTHER = "11111111-2222-4333-8444-555555555555"

const v1 = {
  color: {
    primary: { $type: "color", $root: { $value: "#ff8800" } },
    secondary: { $type: "color", $root: { $value: "#0088ff" } },
  },
}

let cwd: string
const write = (name: string, text: string) => writeFile(join(cwd, name), text)
const read = (name: string) => readFile(join(cwd, name), "utf8")
const stage = async (tokens: Record<string, unknown>, revision: number, projectId = PROJECT, version = "latest") => {
  await mkdir(join(cwd, ".bezel"), { recursive: true })
  await write(SYNC_STAGING_PATH, serializeLockfile(buildLockfile({ projectId, version, revision, tokens })))
}
const edit = (tokens: Record<string, unknown>, value: string) => {
  const next = deepClone(tokens) as typeof v1
  next.color.primary.$root.$value = value
  return next
}

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), "bezel-sync-"))
  await write("bezel.json", JSON.stringify({ projectId: PROJECT, version: "latest" }))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

describe("syncFromStaging", () => {
  it("writes the lockfile and design-tokens.json together and removes the staging file", async () => {
    await stage(v1, 1)

    const result = await syncFromStaging({ cwd })

    expect(result).toMatchObject({ ok: true, revision: 1, tokensChanged: true })
    expect(JSON.parse(await read("design-tokens.json"))).toEqual(v1)
    expect(JSON.parse(await read(LOCKFILE_NAME))).toMatchObject({ revision: 1, tokens: v1 })
    expect(existsSync(join(cwd, SYNC_STAGING_PATH))).toBe(false)
  })

  it("refuses to drop local edits Bezel does not have", async () => {
    await stage(v1, 1)
    await syncFromStaging({ cwd })
    await write("design-tokens.json", serializeTokensFile(edit(v1, "#000000")))
    await stage(v1, 2)

    const result = await syncFromStaging({ cwd })

    expect(result).toMatchObject({ ok: false, reason: "unpushed-edits", unpushedPaths: ["color.primary"] })
    expect(JSON.parse(await read(LOCKFILE_NAME)).revision).toBe(1)
    expect(existsSync(join(cwd, SYNC_STAGING_PATH))).toBe(true)
  })

  it("lets local edits through when the incoming tokens already contain them (after a push)", async () => {
    await stage(v1, 1)
    await syncFromStaging({ cwd })
    const pushed = edit(v1, "#000000")
    await write("design-tokens.json", serializeTokensFile(pushed))
    // Bezel kept someone else's change too.
    const bezel = deepClone(pushed) as typeof v1
    bezel.color.secondary.$root.$value = "#111111"
    await stage(bezel, 3)

    const result = await syncFromStaging({ cwd })

    expect(result).toMatchObject({ ok: true, revision: 3, discardedEdits: 0 })
    expect(JSON.parse(await read("design-tokens.json"))).toEqual(bezel)
    expect(JSON.parse(await read(LOCKFILE_NAME)).revision).toBe(3)
  })

  it("drops local edits with discardLocalEdits", async () => {
    await stage(v1, 1)
    await syncFromStaging({ cwd })
    await write("design-tokens.json", serializeTokensFile(edit(v1, "#000000")))
    await stage(v1, 2)

    const result = await syncFromStaging({ cwd, discardLocalEdits: true })

    expect(result).toMatchObject({ ok: true, revision: 2, discardedEdits: 1 })
    expect(JSON.parse(await read("design-tokens.json"))).toEqual(v1)
  })

  it("refuses an unknown local file when there is no lockfile", async () => {
    await write("design-tokens.json", serializeTokensFile(edit(v1, "#000000")))
    await stage(v1, 1)

    expect(await syncFromStaging({ cwd })).toMatchObject({ ok: false, reason: "unknown-local-edits" })
    expect(await syncFromStaging({ cwd, discardLocalEdits: true })).toMatchObject({ ok: true })
  })

  it("accepts an existing local file identical to Bezel's tokens without a lockfile", async () => {
    await write("design-tokens.json", serializeTokensFile(v1))
    await stage(v1, 4)

    expect(await syncFromStaging({ cwd })).toMatchObject({ ok: true, tokensChanged: false })
    expect(JSON.parse(await read(LOCKFILE_NAME)).revision).toBe(4)
  })

  it("rejects a malformed staging file and one for another project", async () => {
    await mkdir(join(cwd, ".bezel"), { recursive: true })
    await write(SYNC_STAGING_PATH, '{"lockfileVersion":1')
    expect(await syncFromStaging({ cwd })).toMatchObject({ ok: false, reason: "staging-invalid" })

    await stage(v1, 1, OTHER)
    expect(await syncFromStaging({ cwd })).toMatchObject({ ok: false, reason: "project-mismatch" })
  })
})

describe("diffTokens", () => {
  it("asks for a sync when there is no lockfile", async () => {
    await write("design-tokens.json", serializeTokensFile(v1))
    expect(await diffTokens({ cwd })).toMatchObject({ ok: false, reason: "no-lockfile" })
  })

  it("returns no operations right after a sync", async () => {
    await stage(v1, 1)
    await syncFromStaging({ cwd })
    expect(await diffTokens({ cwd })).toMatchObject({ ok: true, baseRevision: 1, operations: [] })
  })

  it("returns test-guarded operations that turn the lockfile tokens into the local file", async () => {
    await stage(v1, 1)
    await syncFromStaging({ cwd })
    const local = edit(v1, "#000000") as typeof v1 & { color: Record<string, unknown> }
    local.color["accent"] = { $type: "color", $root: { $value: "#ff00ff" } }
    await write("design-tokens.json", serializeTokensFile(local))

    const result = await diffTokens({ cwd })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const ops = result.operations.map((operation) => `${operation.op} ${operation.path}`)
    expect(ops).toEqual(
      expect.arrayContaining(["test /color/primary/$root/$value", "replace /color/primary/$root/$value", "add /color/accent"]),
    )
    expect(applyPatch(deepClone(v1), result.operations as Parameters<typeof applyPatch>[1], true).newDocument).toEqual(local)
  })

  it("flags a lockfile for another version or project", async () => {
    await stage(v1, 1)
    await syncFromStaging({ cwd })
    await write("bezel.json", JSON.stringify({ projectId: PROJECT, version: "1.0.0" }))
    expect(await diffTokens({ cwd })).toMatchObject({ ok: false, reason: "version-mismatch" })
    await write("bezel.json", JSON.stringify({ projectId: OTHER, version: "latest" }))
    expect(await diffTokens({ cwd })).toMatchObject({ ok: false, reason: "project-mismatch" })
  })

  it("flags a lockfile with merge conflict markers", async () => {
    await stage(v1, 1)
    await syncFromStaging({ cwd })
    await write(LOCKFILE_NAME, `<<<<<<< HEAD\n${await read(LOCKFILE_NAME)}>>>>>>> branch\n`)
    expect(await diffTokens({ cwd })).toMatchObject({ ok: false, reason: "lockfile-invalid" })
  })
})

describe("push then sync", () => {
  it("updates the lockfile to the pushed revision, keeping edits Bezel already has", async () => {
    await stage(v1, 1)
    await syncFromStaging({ cwd })
    const pushed = edit(v1, "#000000")
    await write("design-tokens.json", serializeTokensFile(pushed))
    // Bezel saved the push as revision 2: the sync after the push stages exactly that.
    await stage(pushed, 2)

    expect(await syncFromStaging({ cwd })).toMatchObject({ ok: true, revision: 2, tokensChanged: false })
    expect(await diffTokens({ cwd })).toMatchObject({ ok: true, baseRevision: 2, operations: [] })
  })
})
