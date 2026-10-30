#!/usr/bin/env node
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { parseArgs } from "node:util"
import { relative, resolve } from "node:path"
import { generateVariablesCss } from "./node"
import { installMcp } from "./install-mcp"
import { installSkillsCommand, skillDirectories } from "./install-skills"
import { initConfig, readPackageScripts } from "./init"
import { changedPaths, diffTokens, syncFromStaging } from "./tokens-sync"
import { LOCKFILE_NAME, SYNC_STAGING_PATH } from "./lockfile"
import type { BezelOptions } from "./config"
import { DEFAULT_CONFIG_FILE, DEFAULT_VARIABLES_OUTPUT } from "./defaults"

const USAGE = `bezel — convert a W3C Design Tokens (DTCG) file into a scoped variables.css

Usage:
  bezel install-mcp [--client <name>] [--skills]
                           Connect claude-code, codex, cursor, vscode, or other
  bezel install-skills [--client <name>] [--no-agents-md]
                           Teach claude-code, codex, cursor, or all about Bezel
  bezel init [options]     Create a bezel.json for this project
  bezel build [options]    Generate the outputs (default command)
  bezel diff [--json]      Local edits not in Bezel yet (vs ${LOCKFILE_NAME});
                           --json prints them as JSON Patch operations for a push
  bezel sync [--discard-local-edits]
                           Apply the tokens the Bezel MCP returned (${SYNC_STAGING_PATH}):
                           writes ${LOCKFILE_NAME} and design-tokens.json, then builds.
                           Run after every sync and every push.

Reads design-tokens.json from the project root (the working directory).
Commit design-tokens.json and ${LOCKFILE_NAME} together; never edit the lockfile by hand.

install-mcp options:
      --skills                  Also run install-skills for the same client (skips the question)

install-skills options:
      --client <name>           claude-code | codex | cursor | all (asked when omitted)
      --no-agents-md            Only write the skill folder; leave AGENTS.md alone

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
      --include-all             Also emit variables for tokens without an exportName
                                (kebab-cased full path, e.g. --base-color-primary-500)
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
      --include-all             Also emit variables for tokens without an exportName
                                (kebab-cased full path, e.g. --base-color-primary-500)
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
  client: { type: "string" },
  config: { type: "string", short: "c" },
  dir: { type: "string" },
  "variables-output": { type: "string" },
  "contexts-output": { type: "string" },
  "fonts-output": { type: "string" },
  color: { type: "string" },
  unit: { type: "string" },
  "include-all": { type: "boolean" },
  project: { type: "string" },
  "tokens-version": { type: "string" },
  stdout: { type: "boolean" },
  "no-gitignore": { type: "boolean" },
  "no-agents-md": { type: "boolean" },
  skills: { type: "boolean" },
  "no-contexts": { type: "boolean" },
  "no-fonts": { type: "boolean" },
  force: { type: "boolean", short: "f" },
  json: { type: "boolean" },
  "discard-local-edits": { type: "boolean" },
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
    includeAll: values["include-all"],
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
    if (result.removedLockfile) {
      process.stderr.write(`bezel: removed ${LOCKFILE_NAME} (it belonged to the previous project)\n`)
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
  if (!skillDirectories("all").some((dir) => existsSync(resolve(cwd, dir, "bezel")))) {
    steps.push("Teach your AI coding agent about Bezel: npx bezel install-skills")
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
  if (values["include-all"]) options.includeAll = true
  if (values.stdout) options.write = false
  if (values["no-gitignore"]) options.gitignore = false

  const css = await generateVariablesCss(options)

  if (values.stdout) {
    process.stdout.write(css)
  } else {
    process.stderr.write(`bezel: wrote ${options.variablesOutput ?? DEFAULT_VARIABLES_OUTPUT}\n`)
  }
}

/** Exit code for a sync refused because it would drop local edits (distinct from errors). */
const EXIT_UNPUSHED_EDITS = 2

/** `bezel diff` — local edits relative to the lockfile. */
async function runDiff(values: Values): Promise<void> {
  const result = await diffTokens({ cwd: process.cwd() })
  const json = values.json

  if (result.ok === false) {
    if (json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    process.stderr.write(`bezel: ${result.message}\n`)
    process.exitCode = 1
    return
  }

  if (json) {
    const { projectId, version, baseRevision, operations } = result
    process.stdout.write(`${JSON.stringify({ ok: true, projectId, version, baseRevision, operations })}\n`)
    return
  }

  const edits = result.operations.filter((operation) => operation.op !== "test")
  if (edits.length === 0) {
    process.stdout.write(`In sync with Bezel revision ${result.baseRevision} (${result.version}). No local edits.\n`)
    return
  }
  const paths = changedPaths(result.operations)
  process.stdout.write(
    `${edits.length} local ${edits.length === 1 ? "edit" : "edits"} not in Bezel yet (based on revision ${result.baseRevision}):\n`,
  )
  for (const path of paths.slice(0, 50)) process.stdout.write(`  ${path}\n`)
  if (paths.length > 50) process.stdout.write(`  ...and ${paths.length - 50} more\n`)
  process.stdout.write('Push them with the Bezel MCP ("push my token changes to Bezel").\n')
}

/** `bezel sync` — apply the staged lockfile, then build. */
async function runSync(values: Values): Promise<void> {
  const result = await syncFromStaging({ cwd: process.cwd(), discardLocalEdits: values["discard-local-edits"] })
  if (result.ok === false) {
    process.stderr.write(`bezel: ${result.message}\n`)
    process.exitCode =
      result.reason === "unpushed-edits" || result.reason === "unknown-local-edits" ? EXIT_UNPUSHED_EDITS : 1
    return
  }
  process.stderr.write(
    `bezel: synced revision ${result.revision} (${result.version}) of project ${result.projectId} into ${LOCKFILE_NAME}${result.tokensChanged ? " and design-tokens.json" : "; design-tokens.json already matched"}\n`,
  )
  if (result.discardedEdits > 0) {
    process.stderr.write(`bezel: discarded ${result.discardedEdits} local ${result.discardedEdits === 1 ? "edit" : "edits"}\n`)
  }
  await runBuild(values)
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

  if (command === "install-mcp") {
    await installMcp(values.client, { skills: values.skills })
    return
  }

  if (command === "install-skills") {
    await installSkillsCommand(values.client, { agentsMd: !values["no-agents-md"] })
    return
  }

  if (command === "init") {
    await runInit(values)
    return
  }

  if (command === "diff") {
    await runDiff(values)
    return
  }

  if (command === "sync") {
    await runSync(values)
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
