## Bezel design tokens

- `design-tokens.json` at the repo root is the source for every design token. Edit it to change a color, size, font, or radius, or to add a CSS variable (add an `exportName` under `$extensions["com.bezel.app"]`).
- Files under the Bezel output folder (`variablesOutput`, `contextsOutput`, `fontsOutput` in `bezel.json`; `src/bezel/` by default) are generated. Never edit them; they are overwritten on every build.
- After changing `design-tokens.json` or `bezel.json`, run `npm run tokens` (or `npx bezel build`) and check the outputs were rewritten.
- Dark mode and other contexts are keys inside each token (`$root`, `dark`, `light`). Add a value under the context key instead of writing a CSS override.
- The Bezel app is the source of truth. Local token edits are replaced by the next sync (`get-design-tokens-file` via the Bezel MCP, or a download from the app), so tell the user when a change should be made in Bezel.
- Never run `bezel init --force`; it discards the existing `bezel.json`. Use `--project` or `--tokens-version` to update a single key.
- Full guidance: the `bezel` skill in `.claude/skills/bezel/SKILL.md` or `.agents/skills/bezel/SKILL.md`.
