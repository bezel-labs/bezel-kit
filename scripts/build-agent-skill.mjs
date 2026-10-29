// Generates src/agent-skill.ts from the markdown under skill/bezel so the skill text
// ships inside the package (CLI install-skills, Bezel MCP server) with the markdown
// files as the single source of truth. Run with `npm run gen:skill`.
import { readdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const skillDir = join(root, "skill", "bezel")
const outFile = join(root, "src", "agent-skill.ts")

const AGENTS_MD_BLOCK_FILE = "agents-md-block.md"
const SUMMARY_SECTION = "## Hard rules"

async function listMarkdown(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...(await listMarkdown(path)))
    else if (entry.name.endsWith(".md")) files.push(path)
  }
  return files.sort()
}

function frontmatter(markdown) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(markdown)
  if (!match) throw new Error("SKILL.md must start with YAML frontmatter")
  const fields = {}
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":")
    if (idx === -1) continue
    fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  if (!fields.name || !fields.description) throw new Error("frontmatter needs name and description")
  return fields
}

function section(markdown, heading) {
  const start = markdown.indexOf(`\n${heading}\n`)
  if (start === -1) throw new Error(`SKILL.md is missing the "${heading}" section`)
  const bodyStart = start + 1
  const next = markdown.indexOf("\n## ", bodyStart)
  return markdown.slice(bodyStart, next === -1 ? undefined : next).trim()
}

const files = {}
let agentsMdBlock = ""
for (const path of await listMarkdown(skillDir)) {
  const key = relative(skillDir, path).split(sep).join("/")
  const text = await readFile(path, "utf8")
  if (key === AGENTS_MD_BLOCK_FILE) agentsMdBlock = text.trim()
  else files[key] = text
}

const skillMd = files["SKILL.md"]
if (!skillMd) throw new Error("skill/bezel/SKILL.md not found")
if (!agentsMdBlock) throw new Error(`skill/bezel/${AGENTS_MD_BLOCK_FILE} not found`)

const { name, description } = frontmatter(skillMd)
const summary = `${description}\n\n${section(skillMd, SUMMARY_SECTION)}`

const literal = (value) => JSON.stringify(value, null, 2)

const output = `/* Generated from skill/bezel by scripts/build-agent-skill.mjs — do not edit by hand. */

/** The Bezel agent skill, embedded so it can be installed into a repo or served by the Bezel MCP. */
export interface AgentSkill {
  /** Skill name; also the folder name under \`.claude/skills\` or \`.agents/skills\`. */
  name: string
  /** Frontmatter description: when the skill applies. */
  description: string
  /** Skill files keyed by path relative to the skill folder (\`SKILL.md\`, \`references/...\`). */
  files: Record<string, string>
  /** Markdown placed inside the managed block of AGENTS.md. */
  agentsMdBlock: string
  /** Description plus the hard rules, sized for an MCP \`instructions\` field. */
  summary: string
}

export const AGENT_SKILL: AgentSkill = {
  name: ${literal(name)},
  description: ${literal(description)},
  files: ${literal(files).replace(/\n/g, "\n  ")},
  agentsMdBlock: ${literal(agentsMdBlock)},
  summary: ${literal(summary)},
}
`

await writeFile(outFile, output, "utf8")
process.stderr.write(`bezel: wrote ${relative(root, outFile)} (${Object.keys(files).length} skill files, summary ${summary.length} chars)\n`)
