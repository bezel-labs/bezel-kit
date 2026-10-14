import { clientCommand, codexAlreadyConfigured, MCP_URL, mergeMcpConfig } from "./install-mcp"

describe("MCP installer", () => {
  it.each(["cursor", "vscode"] as const)(
    "preserves existing %s settings and is idempotent",
    (client) => {
      const key = client === "cursor" ? "mcpServers" : "servers"
      const raw = JSON.stringify({
        inputs: [{ id: "secret" }],
        [key]: { existing: { command: "local" } },
      })
      const output = mergeMcpConfig(raw, client)
      expect(JSON.parse(output)).toEqual({
        inputs: [{ id: "secret" }],
        [key]: {
          existing: { command: "local" },
          bezel: client === "cursor" ? { url: MCP_URL } : { type: "http", url: MCP_URL },
        },
      })
      expect(mergeMcpConfig(output, client)).toBe(output)
    },
  )

  it.each([
    "[]",
    '{"servers":[]}',
    '{"servers":{"bezel":{"url":"https://other.example"}}}',
    '{"servers":{"bezel":{"url":"https://mcp.bezel.new/mcp","command":"local"}}}',
    "{ /* keep my comment */ }",
  ])("rejects unsafe or unsupported configuration without rewriting it: %s", (raw) => {
    expect(() => mergeMcpConfig(raw, "vscode")).toThrow()
  })

  it("preserves custom options on an existing Bezel entry", () => {
    const raw = JSON.stringify({
      servers: { bezel: { type: "http", url: MCP_URL, headers: { custom: "value" } } },
    })
    expect(mergeMcpConfig(raw, "vscode")).toBe(raw)
  })

  it("uses native client commands with explicit scope and separate arguments", () => {
    expect(clientCommand("claude-code")).toEqual({
      command: "claude",
      args: ["mcp", "add", "--transport", "http", "--scope", "project", "bezel", MCP_URL],
    })
    expect(clientCommand("codex")).toEqual({
      command: "codex",
      args: ["mcp", "add", "bezel", "--url", MCP_URL],
    })
    expect(clientCommand("other")).toBeUndefined()
  })
})

describe("existing Codex configuration", () => {
  it("skips a matching server and permits a missing entry", () => {
    expect(codexAlreadyConfigured("[]")).toBe(false)
    expect(
      codexAlreadyConfigured(
        JSON.stringify([{ name: "bezel", enabled: true, transport: { url: MCP_URL } }]),
      ),
    ).toBe(true)
  })
  it.each([
    "{}",
    "[{}]",
    '[{"name":"bezel","transport":{"url":"https://other.example"}}]',
    '[{"name":"bezel","enabled":false}]',
  ])("refuses to overwrite incompatible configuration: %s", (raw) => {
    expect(() => codexAlreadyConfigured(raw)).toThrow()
  })
})
