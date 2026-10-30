/**
 * Keeps `design-tokens.json` and `design-tokens-lock.json` moving together.
 *
 * - `diffTokens`: the local edits, as RFC 6902 operations from the lockfile's tokens (what
 *   Bezel had at the last sync or push) to `design-tokens.json`. The Bezel MCP push sends
 *   exactly these, the same way the Bezel app saves.
 * - `syncFromStaging`: applies the lockfile the Bezel MCP returned (written by the agent to
 *   `.bezel/sync.json`): writes the lockfile, then `design-tokens.json` from it. Refuses to
 *   drop local edits Bezel does not have; edits Bezel already has (a push) pass through.
 *
 * Every sync and every push ends with `syncFromStaging`, and it is the only writer of both
 * files, so they cannot drift apart.
 */
import { existsSync } from "node:fs"
import { readFile, rm, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import jsonPatch from "fast-json-patch"
import { DEFAULT_CONFIG_FILE, DEFAULT_INPUT } from "./defaults"
import {
  LOCKFILE_NAME,
  SYNC_STAGING_PATH,
  parseLockfile,
  serializeLockfile,
  serializeTokensFile,
  type TokensLockfile,
} from "./lockfile"
import { jsonEqual, unappliedOperations, type JsonPatchOperation } from "./patch-applied"

// fast-json-patch ships CommonJS; Node's ESM loader only exposes its default export.
const { compare } = jsonPatch

export type SyncProblemReason =
  | "no-config"
  | "no-project"
  | "no-lockfile"
  | "lockfile-invalid"
  | "project-mismatch"
  | "version-mismatch"
  | "no-tokens-file"
  | "tokens-file-invalid"
  | "no-staging"
  | "staging-invalid"
  | "unpushed-edits"
  | "unknown-local-edits"

export type SyncProblem = { ok: false; reason: SyncProblemReason; message: string }

const SYNC_HINT = 'Sync from Bezel (ask your agent to "sync my Bezel tokens").'

type Link = { projectId: string; version: string }

async function readLink(cwd: string): Promise<{ ok: true; link: Link } | SyncProblem> {
  const path = resolve(cwd, DEFAULT_CONFIG_FILE)
  if (!existsSync(path)) {
    return { ok: false, reason: "no-config", message: `No ${DEFAULT_CONFIG_FILE} here. Run "bezel init --project <uuid>" first.` }
  }
  let config: { projectId?: unknown; version?: unknown }
  try {
    config = JSON.parse(await readFile(path, "utf8")) as typeof config
  } catch {
    return { ok: false, reason: "no-config", message: `${DEFAULT_CONFIG_FILE} is not valid JSON.` }
  }
  if (typeof config.projectId !== "string" || config.projectId === "") {
    return {
      ok: false,
      reason: "no-project",
      message: `${DEFAULT_CONFIG_FILE} has no projectId. Link the repo with "bezel init --project <uuid>".`,
    }
  }
  const version = typeof config.version === "string" && config.version !== "" ? config.version : "latest"
  return { ok: true, link: { projectId: config.projectId, version } }
}

async function readTokensFile(cwd: string): Promise<{ ok: true; tokens: Record<string, unknown> } | SyncProblem> {
  const path = resolve(cwd, DEFAULT_INPUT)
  if (!existsSync(path)) {
    return { ok: false, reason: "no-tokens-file", message: `No ${DEFAULT_INPUT} here. ${SYNC_HINT}` }
  }
  try {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"))
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("not an object")
    return { ok: true, tokens: parsed as Record<string, unknown> }
  } catch {
    return {
      ok: false,
      reason: "tokens-file-invalid",
      message: `${DEFAULT_INPUT} is not a JSON object. Fix the file (or sync from Bezel to replace it).`,
    }
  }
}

/** The lockfile, `null` when there is none, or the problem with it. */
async function readCurrentLockfile(cwd: string): Promise<{ ok: true; lockfile: TokensLockfile | null } | SyncProblem> {
  const path = resolve(cwd, LOCKFILE_NAME)
  if (!existsSync(path)) return { ok: true, lockfile: null }
  const parsed = parseLockfile(await readFile(path, "utf8"))
  if (parsed.ok === false) return { ok: false, reason: "lockfile-invalid", message: parsed.message }
  return { ok: true, lockfile: parsed.lockfile }
}

function checkLockMatchesLink(lockfile: TokensLockfile, link: Link, name: string): SyncProblem | null {
  if (lockfile.projectId !== link.projectId) {
    return {
      ok: false,
      reason: "project-mismatch",
      message: `${name} is for project ${lockfile.projectId}, but ${DEFAULT_CONFIG_FILE} links ${link.projectId}. ${SYNC_HINT}`,
    }
  }
  if (lockfile.version !== link.version) {
    return {
      ok: false,
      reason: "version-mismatch",
      message: `${name} holds version "${lockfile.version}", but ${DEFAULT_CONFIG_FILE} tracks "${link.version}". ${SYNC_HINT}`,
    }
  }
  return null
}

/**
 * Dotted token-ish paths an operation list touches, for human summaries: the pointer up to
 * the first `$` key (`/color/primary/$root/$value` -> `color.primary`), deduped.
 */
export function changedPaths(operations: JsonPatchOperation[]): string[] {
  const paths = new Set<string>()
  for (const operation of operations) {
    if (operation.op === "test") continue
    const segments: string[] = []
    for (const raw of operation.path.split("/").slice(1)) {
      const segment = raw.replace(/~1/g, "/").replace(/~0/g, "~")
      if (segment.startsWith("$")) break
      segments.push(segment)
    }
    paths.add(segments.length > 0 ? segments.join(".") : "(root)")
  }
  return [...paths]
}

export type DiffTokensResult =
  | {
      ok: true
      projectId: string
      version: string
      /** The revision the lockfile records: what Bezel had when these edits started */
      baseRevision: number
      /** RFC 6902 operations, with `test` guards, from the lockfile's tokens to design-tokens.json */
      operations: JsonPatchOperation[]
    }
  | SyncProblem

/** Local edits to push: `compare(lockfile.tokens, design-tokens.json, true)`, like the Bezel app's save. */
export async function diffTokens({ cwd = process.cwd() }: { cwd?: string } = {}): Promise<DiffTokensResult> {
  const link = await readLink(cwd)
  if (link.ok === false) return link

  const current = await readCurrentLockfile(cwd)
  if (current.ok === false) return current
  if (current.lockfile === null) {
    return {
      ok: false,
      reason: "no-lockfile",
      message: `No ${LOCKFILE_NAME} yet, so local edits cannot be told apart from Bezel's tokens. ${SYNC_HINT}`,
    }
  }
  const mismatch = checkLockMatchesLink(current.lockfile, link.link, LOCKFILE_NAME)
  if (mismatch) return mismatch

  const local = await readTokensFile(cwd)
  if (local.ok === false) return local

  const operations = compare(current.lockfile.tokens, local.tokens, true) as JsonPatchOperation[]
  return {
    ok: true,
    projectId: current.lockfile.projectId,
    version: current.lockfile.version,
    baseRevision: current.lockfile.revision,
    operations,
  }
}

export type SyncFromStagingResult =
  | {
      ok: true
      projectId: string
      version: string
      revision: number
      /** False when design-tokens.json already held these tokens */
      tokensChanged: boolean
      /** Local edits that were dropped because `discardLocalEdits` was set */
      discardedEdits: number
    }
  | (SyncProblem & { unpushedPaths?: string[] })

/**
 * Applies `.bezel/sync.json` (the lockfile text the Bezel MCP returned): checks it, refuses
 * when design-tokens.json has edits the incoming tokens lack (unless `discardLocalEdits`),
 * writes design-tokens-lock.json and then design-tokens.json, and removes the staging file.
 */
export async function syncFromStaging({
  cwd = process.cwd(),
  discardLocalEdits = false,
}: { cwd?: string; discardLocalEdits?: boolean } = {}): Promise<SyncFromStagingResult> {
  const stagingPath = resolve(cwd, SYNC_STAGING_PATH)
  if (!existsSync(stagingPath)) {
    return {
      ok: false,
      reason: "no-staging",
      message: `Nothing to sync: ${SYNC_STAGING_PATH} is missing. Write the "lockfileContent" from the Bezel MCP's get-design-tokens-file there first.`,
    }
  }
  const incoming = parseLockfile(await readFile(stagingPath, "utf8"), SYNC_STAGING_PATH)
  if (incoming.ok === false) {
    return {
      ok: false,
      reason: "staging-invalid",
      message: `${incoming.message.replace(/ Sync from Bezel to rewrite it\.$/, "")} Write the "lockfileContent" from get-design-tokens-file to ${SYNC_STAGING_PATH} exactly as returned, then run "bezel sync" again.`,
    }
  }
  const next = incoming.lockfile

  const link = await readLink(cwd)
  if (link.ok === false) return link
  const mismatch = checkLockMatchesLink(next, link.link, SYNC_STAGING_PATH)
  if (mismatch) {
    return {
      ...mismatch,
      message: `${SYNC_STAGING_PATH} is for project ${next.projectId} version "${next.version}", but ${DEFAULT_CONFIG_FILE} links ${link.link.projectId} version "${link.link.version}". Fetch the tokens for the linked project and version, or relink with "bezel init --project <uuid> --tokens-version <v>".`,
    }
  }

  const tokensPath = resolve(cwd, DEFAULT_INPUT)
  let discardedEdits = 0
  let tokensChanged = true

  if (existsSync(tokensPath)) {
    const local = await readTokensFile(cwd)
    if (local.ok === true) {
      tokensChanged = !jsonEqual(local.tokens, next.tokens)
      const current = await readCurrentLockfile(cwd)
      const base =
        current.ok === true && current.lockfile !== null && checkLockMatchesLink(current.lockfile, link.link, LOCKFILE_NAME) === null
          ? current.lockfile
          : null

      if (tokensChanged) {
        if (base === null) {
          // No usable lockfile: the local file cannot be told apart from older Bezel tokens.
          if (!discardLocalEdits) {
            return {
              ok: false,
              reason: "unknown-local-edits",
              message: `${DEFAULT_INPUT} differs from Bezel's tokens and there is no usable ${LOCKFILE_NAME} to tell local edits from older Bezel tokens. If the file has no edits worth keeping, run "bezel sync --discard-local-edits" to replace it.`,
            }
          }
        } else {
          const localEdits = compare(base.tokens, local.tokens, true) as JsonPatchOperation[]
          const unpushed = unappliedOperations(next.tokens, localEdits)
          if (unpushed.length > 0 && !discardLocalEdits) {
            const paths = changedPaths(unpushed)
            return {
              ok: false,
              reason: "unpushed-edits",
              unpushedPaths: paths,
              message: `${DEFAULT_INPUT} has ${unpushed.length} local ${unpushed.length === 1 ? "edit" : "edits"} Bezel does not have (${paths.slice(0, 10).join(", ")}${paths.length > 10 ? ", ..." : ""}). Push them to Bezel first, or run "bezel sync --discard-local-edits" to drop them.`,
            }
          }
          discardedEdits = unpushed.length
        }
      }
    } else if (!discardLocalEdits) {
      return {
        ...local,
        message: `${local.message.replace(/ \(or sync from Bezel to replace it\)/, "")} Or run "bezel sync --discard-local-edits" to replace it with Bezel's tokens.`,
      }
    }
  }

  // Lockfile first, tokens last: an interrupted sync shows up as local edits and a rerun fixes it.
  await writeFile(resolve(cwd, LOCKFILE_NAME), serializeLockfile(next), "utf8")
  if (tokensChanged) await writeFile(tokensPath, serializeTokensFile(next.tokens), "utf8")
  await rm(stagingPath, { force: true })

  return { ok: true, projectId: next.projectId, version: next.version, revision: next.revision, tokensChanged, discardedEdits }
}

/** Deletes a lockfile that belongs to another project (used when `bezel init` relinks). */
export async function removeLockfileForOtherProject(cwd: string, projectId: string): Promise<boolean> {
  const path = resolve(cwd, LOCKFILE_NAME)
  if (!existsSync(path)) return false
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as { projectId?: unknown }
    if (parsed.projectId === projectId) return false
  } catch {
    // An unreadable lockfile is no use for the new project either.
  }
  await rm(path, { force: true })
  return true
}
