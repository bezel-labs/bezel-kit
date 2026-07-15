#!/usr/bin/env node
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { parseArgs } from "node:util"
import { resolve } from "node:path"
import { generateVariablesCss } from "./node"
import type { BezelOptions } from "./config"

const USAGE = `bezel — convert a W3C Design Tokens (DTCG) file into a scoped variables.css

Usage:
  bezel build [options]

Reads design-tokens.json from the project root (the working directory).

Options:
  -c, --config <path>           Config file (.json or .js exporting BezelOptions)
      --variables-output <path> Output CSS file (default: variables.css)
      --contexts-output <path>  Also write a generated TS module exporting CONTEXTS
      --fonts-output <path>     Also write a generated TS module exporting FONTS
      --color <format>          Color output: oklch | hex (default: oklch)
      --unit <mode>             Dimension unit: preserve | rem (default: preserve)
      --stdout                  Print CSS to stdout instead of writing the file
      --no-gitignore            Don't create/update .gitignore for generated files
  -h, --help                    Show this help

A bezel.json file in the working directory is loaded automatically when -c is omitted.
`

/** Default config file auto-loaded from the working directory when no -c is given. */
const DEFAULT_CONFIG_FILE = "bezel.json"

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

async function main(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      config: { type: "string", short: "c" },
      "variables-output": { type: "string" },
      "contexts-output": { type: "string" },
      "fonts-output": { type: "string" },
      color: { type: "string" },
      unit: { type: "string" },
      stdout: { type: "boolean" },
      "no-gitignore": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  })

  if (values.help || positionals[0] === "help") {
    process.stdout.write(USAGE)
    return
  }

  const command = positionals[0] ?? "build"
  if (command !== "build") {
    process.stderr.write(`bezel: unknown command "${command}".\n\n${USAGE}`)
    process.exitCode = 1
    return
  }

  const configPath =
    values.config ??
    (existsSync(resolve(process.cwd(), DEFAULT_CONFIG_FILE))
      ? DEFAULT_CONFIG_FILE
      : undefined)
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
    process.stderr.write(`bezel: wrote ${options.variablesOutput ?? "variables.css"}\n`)
  }
}

main(process.argv.slice(2)).catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
  process.exitCode = 1
})
