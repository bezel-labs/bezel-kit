/**
 * `design-tokens-lock.json`: what this repo last resolved from Bezel.
 *
 * Like `package-lock.json` next to `package.json`: `bezel.json` says which project and
 * version to track, the lockfile records the exact tokens and project revision the repo
 * last synced or pushed. Pushes diff `design-tokens.json` against the lockfile's tokens,
 * so only the edits travel. Committed to git, written only by Bezel Kit and the Bezel MCP.
 *
 * Pure: no `node:*`, so the Bezel MCP builds the same lockfile the CLI reads.
 */

export const LOCKFILE_NAME = "design-tokens-lock.json"
export const LOCKFILE_VERSION = 1
/** Where an agent writes the lockfile text the Bezel MCP returns, for `bezel sync` to apply. */
export const SYNC_STAGING_PATH = ".bezel/sync.json"

export interface TokensLockfile {
  lockfileVersion: typeof LOCKFILE_VERSION
  /** The Bezel project the tokens came from */
  projectId: string
  /** "latest" (working tokens) or the published semver that was synced */
  version: string
  /** The project revision the tokens belong to */
  revision: number
  /** The tokens exactly as Bezel holds them at `revision` */
  tokens: Record<string, unknown>
}

export function buildLockfile(input: {
  projectId: string
  version: string
  revision: number
  tokens: Record<string, unknown>
}): TokensLockfile {
  return {
    lockfileVersion: LOCKFILE_VERSION,
    projectId: input.projectId,
    version: input.version,
    revision: input.revision,
    tokens: input.tokens,
  }
}

/** The lockfile's on-disk text: 2-space JSON with a trailing newline. */
export function serializeLockfile(lockfile: TokensLockfile): string {
  return `${JSON.stringify(lockfile, null, 2)}\n`
}

/** The `design-tokens.json` text Bezel Kit writes: 2-space JSON with a trailing newline. */
export function serializeTokensFile(tokens: Record<string, unknown>): string {
  return `${JSON.stringify(tokens, null, 2)}\n`
}

export type LockfileProblem = "invalid-json" | "invalid-shape"

export type ParseLockfileResult =
  | { ok: true; lockfile: TokensLockfile }
  | { ok: false; reason: LockfileProblem; message: string }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** Parses lockfile text and checks its shape. */
export function parseLockfile(text: string, name = LOCKFILE_NAME): ParseLockfileResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    const merged = /^(<<<<<<<|=======|>>>>>>>)/m.test(text)
    return {
      ok: false,
      reason: "invalid-json",
      message: merged
        ? `${name} has git merge conflict markers. Do not resolve them by hand; sync from Bezel to rewrite it.`
        : `${name} is not valid JSON. Sync from Bezel to rewrite it.`,
    }
  }

  if (
    !isRecord(parsed) ||
    parsed["lockfileVersion"] !== LOCKFILE_VERSION ||
    typeof parsed["projectId"] !== "string" ||
    typeof parsed["version"] !== "string" ||
    typeof parsed["revision"] !== "number" ||
    !isRecord(parsed["tokens"])
  ) {
    return {
      ok: false,
      reason: "invalid-shape",
      message: `${name} is not a version ${LOCKFILE_VERSION} Bezel lockfile. Sync from Bezel to rewrite it.`,
    }
  }

  return { ok: true, lockfile: parsed as unknown as TokensLockfile }
}
