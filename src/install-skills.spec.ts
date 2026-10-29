import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AGENT_SKILL } from "./agent-skill"
import {
  AGENTS_MD_END,
  AGENTS_MD_START,
  installSkills,
  mergeAgentsMd,
  skillClientForMcpClient,
  skillDirectories,
} from "./install-skills"

let cwd: string

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), "bezel-skills-"))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

const read = (path: string) => readFile(join(cwd, path), "utf8")
const exists = (path: string) =>
  stat(join(cwd, path)).then(
    () => true,
    () => false,
  )

describe("skillDirectories", () => {
  it("maps each client to the folders it reads", () => {
    expect(skillDirectories("claude-code")).toEqual([".claude/skills"])
    expect(skillDirectories("codex")).toEqual([".agents/skills"])
    expect(skillDirectories("cursor")).toEqual([".agents/skills"])
    expect(skillDirectories("all")).toEqual([".claude/skills", ".agents/skills"])
  })

  it("maps install-mcp clients onto skill clients", () => {
    expect(skillClientForMcpClient("claude-code")).toBe("claude-code")
    expect(skillClientForMcpClient("codex")).toBe("codex")
    expect(skillClientForMcpClient("cursor")).toBe("cursor")
    expect(skillClientForMcpClient("vscode")).toBe("all")
    expect(skillClientForMcpClient("other")).toBe("all")
  })
})

describe("installSkills", () => {
  it("writes every skill file and AGENTS.md on a fresh install", async () => {
    const result = await installSkills({ cwd, client: "all" })

    const skillFiles = Object.keys(AGENT_SKILL.files)
    expect(result.written.sort()).toEqual(
      [
        ...skillFiles.map((f) => `.claude/skills/bezel/${f}`),
        ...skillFiles.map((f) => `.agents/skills/bezel/${f}`),
        "AGENTS.md",
      ].sort(),
    )
    expect(result.unchanged).toEqual([])
    expect(result.backedUp).toEqual([])
    expect(await read(".claude/skills/bezel/SKILL.md")).toBe(AGENT_SKILL.files["SKILL.md"])
    expect(await read(".agents/skills/bezel/references/bezel-json.md")).toBe(
      AGENT_SKILL.files["references/bezel-json.md"],
    )
    expect(await read("AGENTS.md")).toBe(
      `${AGENTS_MD_START}\n${AGENT_SKILL.agentsMdBlock}\n${AGENTS_MD_END}\n`,
    )
  })

  it("only writes the chosen client's folder", async () => {
    await installSkills({ cwd, client: "claude-code" })
    expect(await exists(".claude/skills/bezel/SKILL.md")).toBe(true)
    expect(await exists(".agents/skills/bezel/SKILL.md")).toBe(false)
  })

  it("is idempotent — a second run writes nothing", async () => {
    await installSkills({ cwd, client: "all" })
    const second = await installSkills({ cwd, client: "all" })
    expect(second.written).toEqual([])
    expect(second.backedUp).toEqual([])
    expect(second.unchanged).toContain("AGENTS.md")
    expect(second.unchanged).toContain(".claude/skills/bezel/SKILL.md")
  })

  it("backs up a modified skill file once before replacing it", async () => {
    await installSkills({ cwd, client: "claude-code" })
    await writeFile(join(cwd, ".claude/skills/bezel/SKILL.md"), "my edits\n")

    const result = await installSkills({ cwd, client: "claude-code" })
    expect(result.written).toEqual([".claude/skills/bezel/SKILL.md"])
    expect(result.backedUp).toEqual([".claude/skills/bezel/SKILL.md"])
    expect(await read(".claude/skills/bezel/SKILL.md.bezel-backup")).toBe("my edits\n")
    expect(await read(".claude/skills/bezel/SKILL.md")).toBe(AGENT_SKILL.files["SKILL.md"])

    // A later overwrite keeps the original backup.
    await writeFile(join(cwd, ".claude/skills/bezel/SKILL.md"), "newer edits\n")
    const again = await installSkills({ cwd, client: "claude-code" })
    expect(again.backedUp).toEqual([])
    expect(await read(".claude/skills/bezel/SKILL.md.bezel-backup")).toBe("my edits\n")
  })

  it("preserves the user's AGENTS.md content around the block", async () => {
    await writeFile(join(cwd, "AGENTS.md"), "# My repo\n\nRun `npm test`.\n")
    await installSkills({ cwd, client: "codex" })

    const agents = await read("AGENTS.md")
    expect(agents.startsWith("# My repo\n\nRun `npm test`.\n\n")).toBe(true)
    expect(agents).toContain(AGENTS_MD_START)
    expect(agents.endsWith(`${AGENTS_MD_END}\n`)).toBe(true)
    expect(mergeAgentsMd(agents)).toBe(agents)
  })

  it("replaces a stale block in place", async () => {
    await writeFile(
      join(cwd, "AGENTS.md"),
      `# Repo\n\n${AGENTS_MD_START}\nold rules\n${AGENTS_MD_END}\n\n## After\n`,
    )
    await installSkills({ cwd, client: "codex" })
    const agents = await read("AGENTS.md")
    expect(agents).not.toContain("old rules")
    expect(agents).toContain(AGENT_SKILL.agentsMdBlock)
    expect(agents.endsWith("## After\n")).toBe(true)
  })

  it("leaves AGENTS.md alone with agentsMd: false", async () => {
    await installSkills({ cwd, client: "claude-code", agentsMd: false })
    expect(await exists("AGENTS.md")).toBe(false)
  })

  it("hints when CLAUDE.md does not include AGENTS.md", async () => {
    await writeFile(join(cwd, "CLAUDE.md"), "# Claude\n")
    const result = await installSkills({ cwd, client: "claude-code" })
    expect(result.hints).toHaveLength(1)
    expect(result.hints[0]).toContain("@AGENTS.md")
    expect(await read("CLAUDE.md")).toBe("# Claude\n")

    await writeFile(join(cwd, "CLAUDE.md"), "# Claude\n@AGENTS.md\n")
    const next = await installSkills({ cwd, client: "claude-code" })
    expect(next.hints).toEqual([])
  })
})
