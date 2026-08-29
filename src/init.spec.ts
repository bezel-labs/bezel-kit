import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { initConfig, isTokensVersion, isUuid, readPackageScripts } from "./init"
import type { BezelOptions } from "./config"

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), "bezel-init-"))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

const readConfig = async (): Promise<BezelOptions> =>
  JSON.parse(await readFile(join(cwd, "bezel.json"), "utf8")) as BezelOptions

describe("initConfig", () => {
  it("scaffolds src/bezel for a TypeScript project with a src/", async () => {
    await mkdir(join(cwd, "src"))
    await writeFile(join(cwd, "tsconfig.json"), "{}")

    const result = await initConfig({ cwd })

    expect(result.written).toBe(true)
    expect(result.isTypeScript).toBe(true)
    expect(await readConfig()).toEqual({
      version: "latest",
      variablesOutput: "src/bezel/variables.css",
      contextsOutput: "src/bezel/contexts.ts",
      fontsOutput: "src/bezel/fonts.ts",
    })
  })

  it("falls back to bezel/ when the project has no src/", async () => {
    await writeFile(join(cwd, "tsconfig.json"), "{}")

    await initConfig({ cwd })

    expect((await readConfig()).variablesOutput).toBe("bezel/variables.css")
  })

  it("omits the TS modules for a JavaScript project", async () => {
    await mkdir(join(cwd, "src"))

    const result = await initConfig({ cwd })

    expect(result.isTypeScript).toBe(false)
    expect(await readConfig()).toEqual({
      version: "latest",
      variablesOutput: "src/bezel/variables.css",
    })
  })

  it("scaffolds the TS modules for a JS project when the paths are explicit", async () => {
    await initConfig({ cwd, contextsOutput: "app/contexts.ts" })

    const config = await readConfig()
    expect(config.contextsOutput).toBe("app/contexts.ts")
    expect(config.fontsOutput).toBeUndefined()
  })

  it("honours --dir for every output", async () => {
    await writeFile(join(cwd, "tsconfig.json"), "{}")

    await initConfig({ cwd, outputDir: "packages/ui/src/bezel" })

    expect(await readConfig()).toEqual({
      version: "latest",
      variablesOutput: "packages/ui/src/bezel/variables.css",
      contextsOutput: "packages/ui/src/bezel/contexts.ts",
      fontsOutput: "packages/ui/src/bezel/fonts.ts",
    })
  })

  it("lets an explicit path win over the output directory", async () => {
    await writeFile(join(cwd, "tsconfig.json"), "{}")

    await initConfig({ cwd, outputDir: "generated", variablesOutput: "public/theme.css" })

    const config = await readConfig()
    expect(config.variablesOutput).toBe("public/theme.css")
    expect(config.contextsOutput).toBe("generated/contexts.ts")
  })

  it("drops outputs turned off explicitly", async () => {
    await writeFile(join(cwd, "tsconfig.json"), "{}")

    await initConfig({ cwd, contexts: false, fonts: false })

    expect(await readConfig()).toEqual({ version: "latest", variablesOutput: "bezel/variables.css" })
  })

  it("persists transform options only when they are set", async () => {
    await initConfig({ cwd, colorFormat: "hex", dimensionUnit: "rem" })

    const config = await readConfig()
    expect(config.colorFormat).toBe("hex")
    expect(config.dimensionUnit).toBe("rem")
  })

  it("never overwrites an existing bezel.json without force", async () => {
    await writeFile(join(cwd, "bezel.json"), '{"variablesOutput":"mine.css"}\n')

    const result = await initConfig({ cwd })

    expect(result.written).toBe(false)
    expect((await readConfig()).variablesOutput).toBe("mine.css")
  })

  it("overwrites with force", async () => {
    await writeFile(join(cwd, "bezel.json"), '{"variablesOutput":"mine.css"}\n')

    const result = await initConfig({ cwd, force: true })

    expect(result.written).toBe(true)
    expect((await readConfig()).variablesOutput).toBe("bezel/variables.css")
  })

  it("reports whether a tokens file is already present", async () => {
    expect((await initConfig({ cwd })).hasTokensFile).toBe(false)

    await writeFile(join(cwd, "design-tokens.json"), "{}")
    expect((await initConfig({ cwd, force: true })).hasTokensFile).toBe(true)
  })

  it("writes forward slashes and a trailing newline", async () => {
    const result = await initConfig({ cwd, outputDir: "a/b" })

    const raw = await readFile(result.configPath, "utf8")
    expect(raw).toContain('"a/b/variables.css"')
    expect(raw.endsWith("}\n")).toBe(true)
  })
})

describe("initConfig — project link", () => {
  const PROJECT = "0f7a4c2e-1b3d-4e5f-8a9b-0c1d2e3f4a5b"
  const OTHER = "9e8d7c6b-5a4f-4e3d-2c1b-0a9f8e7d6c5b"

  const readRawKeys = async (): Promise<string[]> =>
    Object.keys(JSON.parse(await readFile(join(cwd, "bezel.json"), "utf8")) as object)

  it("writes version: latest and no projectId on a fresh init", async () => {
    const result = await initConfig({ cwd })

    expect(result.updated).toBe(false)
    const config = await readConfig()
    expect(config.version).toBe("latest")
    expect(config.projectId).toBeUndefined()
    expect(await readRawKeys()).toEqual(["version", "variablesOutput"])
  })

  it("writes projectId first, then version, when both are given", async () => {
    await initConfig({ cwd, projectId: PROJECT, version: "1.4.0" })

    expect(await readRawKeys()).toEqual(["projectId", "version", "variablesOutput"])
    const config = await readConfig()
    expect(config.projectId).toBe(PROJECT)
    expect(config.version).toBe("1.4.0")
  })

  it("rejects a malformed projectId", async () => {
    await expect(initConfig({ cwd, projectId: "not-a-uuid" })).rejects.toThrow(
      'bezel: --project must be a UUID, got "not-a-uuid"',
    )
  })

  it("validates the tokens version", async () => {
    await expect(initConfig({ cwd, version: "v1" })).rejects.toThrow(
      'bezel: --tokens-version must be "latest" or a semver like 1.4.0, got "v1"',
    )
    await expect(initConfig({ cwd, version: "newest" })).rejects.toThrow(/--tokens-version/)

    expect(isTokensVersion("1.4.0")).toBe(true)
    expect(isTokensVersion("1.4.0-beta.1")).toBe(true)
    expect(isTokensVersion("latest")).toBe(true)
    expect(isUuid(PROJECT)).toBe(true)
    expect(isUuid(PROJECT.toUpperCase())).toBe(true)
    expect(isUuid("nope")).toBe(false)
  })

  it("merges projectId into an existing file without force, preserving other keys", async () => {
    await writeFile(
      join(cwd, "bezel.json"),
      '{"variablesOutput":"mine.css","colorFormat":"hex","fontsOutput":"f.ts"}\n',
    )

    const result = await initConfig({ cwd, projectId: PROJECT })

    expect(result.written).toBe(true)
    expect(result.updated).toBe(true)
    expect(result.previousProjectId).toBeUndefined()
    expect(result.previousVersion).toBeUndefined()
    expect(await readRawKeys()).toEqual([
      "projectId",
      "version",
      "variablesOutput",
      "colorFormat",
      "fontsOutput",
    ])
    expect(await readConfig()).toEqual({
      projectId: PROJECT,
      version: "latest",
      variablesOutput: "mine.css",
      colorFormat: "hex",
      fontsOutput: "f.ts",
    })
  })

  it("merges version alone, replacing the existing value", async () => {
    await writeFile(
      join(cwd, "bezel.json"),
      `{"projectId":"${PROJECT}","version":"1.0.0","variablesOutput":"mine.css"}\n`,
    )

    const result = await initConfig({ cwd, version: "2.0.0" })

    expect(result.updated).toBe(true)
    expect(result.previousVersion).toBe("1.0.0")
    expect(result.previousProjectId).toBe(PROJECT)
    expect(await readConfig()).toEqual({
      projectId: PROJECT,
      version: "2.0.0",
      variablesOutput: "mine.css",
    })
  })

  it("replaces an existing projectId and reports the previous one", async () => {
    await writeFile(
      join(cwd, "bezel.json"),
      `{"projectId":"${OTHER}","version":"latest","variablesOutput":"mine.css"}\n`,
    )

    const result = await initConfig({ cwd, projectId: PROJECT })

    expect(result.updated).toBe(true)
    expect(result.previousProjectId).toBe(OTHER)
    expect((await readConfig()).projectId).toBe(PROJECT)
  })

  it("rewrites everything with force even when projectId is given", async () => {
    await writeFile(join(cwd, "bezel.json"), '{"variablesOutput":"mine.css","colorFormat":"hex"}\n')

    const result = await initConfig({ cwd, force: true, projectId: PROJECT })

    expect(result.written).toBe(true)
    expect(result.updated).toBe(false)
    expect(await readConfig()).toEqual({
      projectId: PROJECT,
      version: "latest",
      variablesOutput: "bezel/variables.css",
    })
  })
})

describe("readPackageScripts", () => {
  it("returns the scripts block", async () => {
    await writeFile(join(cwd, "package.json"), JSON.stringify({ scripts: { tokens: "bezel build" } }))

    expect(await readPackageScripts(cwd)).toEqual({ tokens: "bezel build" })
  })

  it("returns an empty object when package.json is missing or unparsable", async () => {
    expect(await readPackageScripts(cwd)).toEqual({})

    await writeFile(join(cwd, "package.json"), "not json")
    expect(await readPackageScripts(cwd)).toEqual({})
  })
})
