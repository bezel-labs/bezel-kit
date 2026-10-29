import { readdirSync, readFileSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { AGENT_SKILL } from "./agent-skill"

const skillDir = join(__dirname, "..", "skill", "bezel")

const listMarkdown = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory() ? listMarkdown(join(dir, entry.name)) : [join(dir, entry.name)],
    )
    .filter((path) => path.endsWith(".md"))
    .sort()

describe("AGENT_SKILL (generated from skill/bezel)", () => {
  it("matches the markdown on disk — run `npm run gen:skill` after editing skill/bezel", () => {
    const expected: Record<string, string> = {}
    let block = ""
    for (const path of listMarkdown(skillDir)) {
      const key = relative(skillDir, path).split(sep).join("/")
      const text = readFileSync(path, "utf8")
      if (key === "agents-md-block.md") block = text.trim()
      else expected[key] = text
    }
    expect(AGENT_SKILL.files).toEqual(expected)
    expect(AGENT_SKILL.agentsMdBlock).toBe(block)
  })

  it("has frontmatter the agents accept", () => {
    expect(AGENT_SKILL.name).toBe("bezel")
    expect(AGENT_SKILL.files["SKILL.md"]).toMatch(/^---\nname: bezel\n/)
    expect(AGENT_SKILL.description.length).toBeLessThanOrEqual(1024)
    expect(AGENT_SKILL.description).toMatch(/^Use when/)
  })

  it("only ships SKILL.md and references", () => {
    for (const key of Object.keys(AGENT_SKILL.files)) {
      expect(key === "SKILL.md" || key.startsWith("references/")).toBe(true)
    }
  })

  it("has a summary that fits an MCP instructions field", () => {
    expect(AGENT_SKILL.summary.startsWith(AGENT_SKILL.description)).toBe(true)
    expect(AGENT_SKILL.summary).toContain("## Hard rules")
    expect(AGENT_SKILL.summary.length).toBeLessThanOrEqual(3500)
  })

  it("keeps SKILL.md under the recommended size", () => {
    expect(AGENT_SKILL.files["SKILL.md"].split("\n").length).toBeLessThan(500)
  })
})
