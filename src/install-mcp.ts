import { spawnSync } from "node:child_process"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { installSkills, reportInstallSkills, skillClientForMcpClient } from "./install-skills"

export const MCP_URL = "https://mcp.bezel.new/mcp"
export const CLIENTS = ["claude-code", "codex", "cursor", "vscode", "other"] as const
export type McpClient = (typeof CLIENTS)[number]

export function clientCommand(client: McpClient): { command: string; args: string[] } | undefined {
  if (client === "claude-code") {
    return {
      command: "claude",
      args: ["mcp", "add", "--transport", "http", "--scope", "project", "bezel", MCP_URL],
    }
  }
  if (client === "codex") {
    return { command: "codex", args: ["mcp", "add", "bezel", "--url", MCP_URL] }
  }
  return undefined
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function codexAlreadyConfigured(raw: string): boolean {
  const servers: unknown = JSON.parse(raw)
  if (
    !Array.isArray(servers) ||
    !servers.every((server) => object(server) && typeof server["name"] === "string")
  ) {
    throw new Error("Could not inspect Codex MCP configuration; no changes made.")
  }
  const existing = servers.find((server) => server["name"] === "bezel")
  if (!existing) return false
  if (
    !object(existing["transport"]) ||
    existing["transport"]["url"] !== MCP_URL ||
    existing["enabled"] === false
  ) {
    throw new Error(
      "An existing or disabled Bezel entry needs attention in Codex; no changes made.",
    )
  }
  return true
}

/** Preserve unrelated settings; reject conflicting or malformed configuration. */
export function mergeMcpConfig(raw: string, client: "cursor" | "vscode"): string {
  const config: unknown = JSON.parse(raw)
  if (!object(config)) throw new Error("MCP config must be a JSON object; no changes made.")
  const key = client === "cursor" ? "mcpServers" : "servers"
  const servers = config[key] ?? {}
  if (!object(servers)) throw new Error(`${key} must be a JSON object; no changes made.`)
  const entry = client === "cursor" ? { url: MCP_URL } : { type: "http", url: MCP_URL }
  if (servers["bezel"] !== undefined) {
    const existing = servers["bezel"]
    if (
      !object(existing) ||
      existing["url"] !== MCP_URL ||
      (existing["type"] !== undefined && existing["type"] !== "http") ||
      existing["command"] !== undefined
    ) {
      throw new Error("A different bezel server is already configured; no changes made.")
    }
    return raw
  }
  return `${JSON.stringify({ ...config, [key]: { ...servers, bezel: entry } }, null, 2)}\n`
}

export interface InstallMcpOptions {
  /**
   * Also install the Bezel agent skill for the same client. `true` installs without
   * asking, `false` skips, and `undefined` asks when stdin is a TTY.
   */
  skills?: boolean
}

export async function installMcp(
  clientName?: string,
  options: InstallMcpOptions = {},
): Promise<void> {
  let choice = clientName
  if (!choice) {
    if (!process.stdin.isTTY) {
      throw new Error(`Choose a client with --client ${CLIENTS.join("|")}.`)
    }
    const { default: select } = await import("@inquirer/select")
    try {
      choice = await select<McpClient>({
        message: "Connect Bezel to your coding tool:",
        choices: [
          { name: "Claude Code (this project)", value: "claude-code" },
          { name: "Codex (your user configuration)", value: "codex" },
          { name: "Cursor (this project)", value: "cursor" },
          { name: "VS Code (this project)", value: "vscode" },
          { name: "Other / hosted tool", value: "other" },
        ],
      })
    } catch (error) {
      if (error instanceof Error && error.name === "ExitPromptError") {
        console.log("Setup cancelled.")
        return
      }
      throw error
    }
  }
  if (!CLIENTS.includes(choice as McpClient))
    throw new Error(`Unknown client: ${choice}. Choose ${CLIENTS.join(", ")}.`)
  const client = choice as McpClient
  const invocation = clientCommand(client)
  if (invocation) {
    console.log(
      client === "codex"
        ? "Adding Bezel to Codex user configuration."
        : "Adding Bezel to this project's Claude Code configuration.",
    )
    let alreadyConfigured = false
    if (client === "codex") {
      const current = spawnSync("codex", ["mcp", "list", "--json"], {
        encoding: "utf8",
        shell: false,
      })
      if (current.error || current.status !== 0)
        throw new Error(
          "Could not inspect Codex MCP configuration. Ensure the Codex CLI is installed; no changes made.",
        )
      alreadyConfigured = codexAlreadyConfigured(current.stdout)
    }
    const result = alreadyConfigured
      ? { status: 0, error: undefined }
      : spawnSync(invocation.command, invocation.args, {
          stdio: "inherit",
          shell: false,
        })
    if (result.error || result.status !== 0) {
      throw new Error(
        `Could not configure ${client}. Ensure its CLI is installed and review any existing bezel entry. No existing server was removed. Manual setup: https://docs.bezel.new/docs/mcp-server/setup`,
      )
    }
  } else if (client === "cursor" || client === "vscode") {
    const path = resolve(client === "cursor" ? ".cursor/mcp.json" : ".vscode/mcp.json")
    let raw = "{}"
    let exists = false
    try {
      raw = await readFile(path, "utf8")
      exists = true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    }
    // JSONC is deliberately not rewritten: preserve comments by requesting manual setup.
    let merged: string
    try {
      merged = mergeMcpConfig(raw, client)
    } catch (error) {
      throw new Error(
        `${path}: ${error instanceof Error ? error.message : String(error)} For JSON with comments, add Bezel manually: https://docs.bezel.new/docs/mcp-server/setup`,
      )
    }
    if (merged !== raw) {
      await mkdir(dirname(path), { recursive: true })
      if (exists) await writeFile(`${path}.bezel-backup`, raw, { flag: "wx", mode: 0o600 })
      await writeFile(path, merged, { flag: exists ? "w" : "wx" })
    }
    console.log(`Bezel configured in ${path}`)
  } else {
    console.log(
      `In your tool's MCP/connector settings, add Bezel with URL ${MCP_URL}, Streamable HTTP transport, and OAuth authentication.\nClient instructions: https://docs.bezel.new/docs/mcp-server/setup`,
    )
  }
  console.log(
    client === "codex"
      ? "Next: run `codex mcp login bezel` and complete browser sign-in."
      : client === "claude-code"
        ? "Next: open Claude Code, run /mcp, select bezel, and sign in."
        : "Next: open or reload your coding tool and sign in to Bezel when prompted.",
  )
  console.log(
    '\nThen open your current project in the assistant and ask:\n"Set up Bezel in this project."',
  )

  if (await wantsSkills(options.skills)) {
    console.log("")
    reportInstallSkills(await installSkills({ client: skillClientForMcpClient(client) }))
  }
}

async function wantsSkills(flag: boolean | undefined): Promise<boolean> {
  if (flag !== undefined) return flag
  if (!process.stdin.isTTY) return false
  const { default: select } = await import("@inquirer/select")
  try {
    return await select<boolean>({
      message: "Also install the Bezel agent skill into this repo (SKILL.md + AGENTS.md rules)?",
      choices: [
        { name: "Yes (recommended)", value: true },
        { name: "Not now (run `bezel install-skills` later)", value: false },
      ],
    })
  } catch (error) {
    if (error instanceof Error && error.name === "ExitPromptError") return false
    throw error
  }
}
