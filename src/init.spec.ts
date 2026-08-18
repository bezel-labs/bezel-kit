import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { initConfig, readPackageScripts } from "./init"
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
    expect(await readConfig()).toEqual({ variablesOutput: "src/bezel/variables.css" })
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

    expect(await readConfig()).toEqual({ variablesOutput: "bezel/variables.css" })
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
