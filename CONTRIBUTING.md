# Contributing to Bezel Kit

Bug reports, feature requests, documentation improvements, and pull requests are welcome.

## Before starting

Use the issue templates for bugs and feature requests. Use [Discussions](https://github.com/bezel-labs/bezel-kit/discussions) for questions and early ideas. Discuss substantial API or compiler changes before implementing them.

Keep example token documents small and remove private project data. Report security problems privately through the [security reporting form](https://github.com/bezel-labs/bezel-kit/security/advisories/new).

## Development

Use Node.js 22.13 or newer and npm.

```sh
npm ci
npm run typecheck
npm run build
npm test
```

The build generates the agent skill assets and the package outputs. Include tests for changed behavior and update the README or examples when the public API or CLI changes.

## Pull requests

Open a focused pull request against `main`. Explain the problem, resulting behavior, and how you verified it. Use a Conventional Commits title, such as `fix: preserve context scopes` or `feat(cli): add an export option`. Pull requests are squash-merged using their title.

Bezel Kit retains the license in [LICENSE](LICENSE). Review it before using or contributing to this project.
