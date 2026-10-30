## Bezel design tokens

- `design-tokens.json` at the repo root is the source for every design token. Edit it to change a color, size, font, or radius, or to add a CSS variable (add an `exportName` under `$extensions["com.bezel.app"]`).
- Files under the Bezel output folder (`variablesOutput`, `contextsOutput`, `fontsOutput` in `bezel.json`; `src/bezel/` by default) are generated. Never edit them; they are overwritten on every build.
- After changing `design-tokens.json` or `bezel.json`, run `npm run tokens` (or `npx bezel build`) and check the outputs were rewritten.
- Dark mode and other contexts are keys inside each token (`$root`, `dark`, `light`). Add a value under the context key instead of writing a CSS override.
- The Bezel app is the source of truth. `design-tokens-lock.json` records what was last synced or pushed; never edit it, and commit it together with `design-tokens.json`. `npx bezel diff` lists local edits that are not in Bezel yet.
- Sync through the Bezel MCP: write `get-design-tokens-file`'s `lockfileContent` to `.bezel/sync.json`, then run `npx bezel sync` (it writes both files and refuses to drop unpushed edits). To push (only when asked), run `npx bezel diff --json`, call `push-design-tokens` with its operations, then sync to update the lockfile. If it returns `needs-confirmation` (Bezel changed meanwhile), show the confirmation prompt word for word and call again with `confirmed: true` only after the user says yes.
- Never run `bezel init --force`; it discards the existing `bezel.json`. Use `--project` or `--tokens-version` to update a single key.
- Full guidance: the `bezel` skill in `.claude/skills/bezel/SKILL.md` or `.agents/skills/bezel/SKILL.md`.
