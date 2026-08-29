#!/usr/bin/env node
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { parseArgs } from "node:util"
import { relative, resolve } from "node:path"
import { generateVariablesCss } from "./node"
import { initConfig, readPackageScripts } from "./init"
import type { BezelOptions } from "./config"
import { DEFAULT_CONFIG_FILE, DEFAULT_VARIABLES_OUTPUT } from "./defaults"

const USAGE = `bezel — convert a W3C Design Tokens (DTCG) file into a scoped variables.css

Usage:
  bezel init [options]     Create a bezel.json for this project
  bezel build [options]    Generate the outputs (default command)

Reads design-tokens.json from the project root (the working directory).

init options:
      --dir <path>              Directory for all outputs
                                (default: src/bezel, or bezel with no src/)
      --variables-output <path> Override just the CSS path
      --contexts-output <path>  Override just the contexts module path
      --fonts-output <path>     Override just the fonts module path
      --no-contexts             Skip the generated CONTEXTS module
      --no-fonts                Skip the generated FONTS module
      --color <format>          Color output: oklch | hex (default: oklch)
      --unit <mode>             Dimension unit: preserve | rem (default: preserve)
      --project <uuid>          Link this repo to a Bezel project (writes projectId)
      --tokens-version <v>      Tokens version the Bezel MCP fetches: latest | semver (default: latest)
  -f, --force                   Overwrite an existing bezel.json

build options:
  -c, --config <path>           Config file (.json or .js exporting BezelOptions)
      --variables-output <path> Output CSS file (default: ${DEFAULT_VARIABLES_OUTPUT})
      --contexts-output <path>  Also write a generated TS module exporting CONTEXTS
      --fonts-output <path>     Also write a generated TS module exporting FONTS
      --color <format>          Color output: oklch | hex (default: oklch)
      --unit <mode>             Dimension unit: preserve | rem (default: preserve)
      --stdout                  Print CSS to stdout instead of writing the file
      --no-gitignore            Don't create/update .gitignore for generated files

  -h, --help                    Show this help

A ${DEFAULT_CONFIG_FILE} file in the working directory is loaded automatically when -c is omitted.
The contexts/fonts modules are TypeScript, so init only scaffolds them for a
TypeScript project unless you pass the paths explicitly.
--project and --tokens-version update only their own key in an existing bezel.json; no --force needed.
`

/** Load options from a `.json` or `.js`/`.mjs` config file. */
async function loadConfig(path: string): Promise<BezelOptions> {
  const abs = resolve(process.cwd(), path)
  if (/\.json$/.test(abs)) {
    return JSON.parse(await readFile(abs, "utf8")) as BezelOptions
  }
  const mod = (await import(pathToFileURL(abs).href)) as {
    default?: BezelOptions
  } & BezelOptions
  return (mod.default ?? mod) as BezelOptions
}

type Values = ReturnType<typeof parseArgs<{ options: typeof OPTIONS }>>["values"]

const OPTIONS = {
  config: { type: "string", short: "c" },
  dir: { type: "string" },
  "variables-output": { type: "string" },
  "contexts-output": { type: "string" },
  "fonts-output": { type: "string" },
  color: { type: "string" },
  unit: { type: "string" },
  project: { type: "string" },
  "tokens-version": { type: "string" },
  stdout: { type: "boolean" },
  "no-gitignore": { type: "boolean" },
  "no-contexts": { type: "boolean" },
  "no-fonts": { type: "boolean" },
  force: { type: "boolean", short: "f" },
  help: { type: "boolean", short: "h" },
} as const

const TOKENS_FILE_HINT =
  "Add design-tokens.json to the project root — ask your AI agent for it via the\n     Bezel MCP, or download it from your project."

/** `bezel init` — scaffold a bezel.json, then print what to do next. */
async function runInit(values: Values): Promise<void> {
  const cwd = process.cwd()
  const result = await initConfig({
    cwd,
    outputDir: values.dir,
    variablesOutput: values["variables-output"],
    contextsOutput: values["contexts-output"],
    fontsOutput: values["fonts-output"],
    contexts: values["no-contexts"] ? false : undefined,
    fonts: values["no-fonts"] ? false : undefined,
    colorFormat: values.color as BezelOptions["colorFormat"],
    dimensionUnit: values.unit as BezelOptions["dimensionUnit"],
    force: values.force,
    projectId: values.project,
    version: values["tokens-version"],
  })

  const configName = relative(cwd, result.configPath) || DEFAULT_CONFIG_FILE

  if (result.updated) {
    if (values.project) {
      const changed = result.previousProjectId && result.previousProjectId !== values.project
      process.stderr.write(
        changed
          ? `bezel: updated projectId in ${configName} (was ${result.previousProjectId})\n`
          : `bezel: set projectId in ${configName}\n`,
      )
    }
    if (result.config.version !== result.previousVersion) {
      process.stderr.write(`bezel: set version to ${result.config.version} in ${configName}\n`)
    }
    if (!result.hasTokensFile) {
      process.stderr.write(`\n${TOKENS_FILE_HINT}\n`)
    }
    return
  }

  if (!result.written) {
    process.stderr.write(
      `bezel: ${configName} already exists — leaving it alone. Re-run with --force to overwrite, or pass --project <uuid> / --tokens-version <v> to just update the project link.\n`,
    )
    process.exitCode = 1
    return
  }

  const outputs = [
    result.config.variablesOutput,
    result.config.contextsOutput,
    result.config.fontsOutput,
  ].filter((p): p is string => p !== undefined)

  process.stderr.write(`bezel: wrote ${configName}\n`)
  for (const output of outputs) {
    process.stderr.write(`bezel:   ${output}\n`)
  }

  const scripts = await readPackageScripts(cwd)
  const steps: string[] = []

  if (!result.hasTokensFile) {
    steps.push(TOKENS_FILE_HINT)
  }
  if (!scripts["tokens"]) {
    steps.push('Add "tokens": "bezel build" to your package.json scripts.')
  }
  steps.push(`Run the build, then import ${result.config.variablesOutput} in your entry file.`)

  process.stderr.write("\nNext:\n")
  steps.forEach((step, i) => process.stderr.write(`  ${i + 1}. ${step}\n`))
}

/** `bezel build` — generate the outputs. */
async function runBuild(values: Values): Promise<void> {
  const configPath =
    values.config ??
    (existsSync(resolve(process.cwd(), DEFAULT_CONFIG_FILE)) ? DEFAULT_CONFIG_FILE : undefined)
  const fileConfig = configPath ? await loadConfig(configPath) : {}

  const options: BezelOptions = { ...fileConfig }
  if (values["variables-output"]) options.variablesOutput = values["variables-output"]
  if (values["contexts-output"]) options.contextsOutput = values["contexts-output"]
  if (values["fonts-output"]) options.fontsOutput = values["fonts-output"]
  if (values.color) options.colorFormat = values.color as BezelOptions["colorFormat"]
  if (values.unit) options.dimensionUnit = values.unit as BezelOptions["dimensionUnit"]
  if (values.stdout) options.write = false
  if (values["no-gitignore"]) options.gitignore = false

  const css = await generateVariablesCss(options)

  if (values.stdout) {
    process.stdout.write(css)
  } else {
    process.stderr.write(`bezel: wrote ${options.variablesOutput ?? DEFAULT_VARIABLES_OUTPUT}\n`)
  }
}

async function main(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: OPTIONS,
  })

  if (values.help || positionals[0] === "help") {
    process.stdout.write(USAGE)
    return
  }

  const command = positionals[0] ?? "build"

  if (command === "init") {
    await runInit(values)
    return
  }

  if (command !== "build") {
    process.stderr.write(`bezel: unknown command "${command}".\n\n${USAGE}`)
    process.exitCode = 1
    return
  }

  await runBuild(values)
}

main(process.argv.slice(2)).catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
  process.exitCode = 1
})
